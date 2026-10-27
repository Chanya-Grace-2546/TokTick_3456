import { expect, it, vi } from 'vitest';
import { verifyE2ETarget } from './e2eSafety.mjs';
const runId='11111111-1111-4111-8111-111111111111',schema=`issue8_test_${'a'.repeat(32)}`;
const proof={runId,schema,oid:'123',marker:`toktickit-test:${runId}:marker`,owner:'test_role'};
const env={TOKTICKIT_TEST_RUN_ID:runId,TOKTICKIT_TEST_DATABASE_URL:'postgresql://test@localhost/toktickit_e2e_test',DATABASE_URL:`postgresql://test@localhost/toktickit_e2e_test?schema=${schema}`,TOKTICKIT_E2E_SCHEMA_PROOF:JSON.stringify(proof)};
function db(row={...proof},identity={database:'toktickit_e2e_test',schema,role:'test_role'}) { return {$queryRaw:vi.fn().mockResolvedValueOnce([identity]).mockResolvedValueOnce([row])}; }
it('accepts only the verified child connection identity',async()=>{await expect(verifyE2ETarget(db(),env)).resolves.toMatchObject({schema});});
it.each(['toktickit','other'])('rejects database %s before a connection',async name=>{const prisma=db();await expect(verifyE2ETarget(prisma,{...env,DATABASE_URL:`postgresql://test@localhost/${name}`})).rejects.toThrow();expect(prisma.$queryRaw).not.toHaveBeenCalled();});
it('requires explicit test URL with no development fallback',async()=>{await expect(verifyE2ETarget(db(),{...env,TOKTICKIT_TEST_DATABASE_URL:undefined})).rejects.toThrow();});
it('rejects redirection to another server before SQL',async()=>{const prisma=db();await expect(verifyE2ETarget(prisma,{...env,DATABASE_URL:env.DATABASE_URL.replace('localhost','other-host')})).rejects.toThrow();expect(prisma.$queryRaw).not.toHaveBeenCalled();});
it.each(['public','unrelated'])('rejects schema %s before SQL',async name=>{const prisma=db();await expect(verifyE2ETarget(prisma,{...env,DATABASE_URL:`postgresql://test@localhost/toktickit_e2e_test?schema=${name}`})).rejects.toThrow();expect(prisma.$queryRaw).not.toHaveBeenCalled();});
it.each(['oid','marker','owner'])('rejects changed %s',async field=>{await expect(verifyE2ETarget(db({...proof,[field]:'changed'}),env)).rejects.toThrow();});
it('rejects a connected schema mismatch',async()=>{await expect(verifyE2ETarget(db(proof,{database:'toktickit_e2e_test',schema:'public',role:'test_role'}),env)).rejects.toThrow();});
