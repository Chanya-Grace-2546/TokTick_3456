import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { startProcess, stopOwnedProcesses } from './processes';
import { prepareFixtures } from './lab-04/fixtures';
export default async function setup() {
  const { DisposableDatabase, explicitTestUrl, subprocessEnvironment }=await import('../server/tests/helpers/databaseSafety.mjs');
  explicitTestUrl(); // Refuse before creating files/processes when connection is absent.
  process.env.TOKTICKIT_TEST_RUN_ID=randomUUID();
  const database=new DisposableDatabase('issue8_test');
  const directory=mkdtempSync(path.join(tmpdir(),'toktickit-e2e-'));
  const cleanup=async()=>{
    // Any stop failure prevents schema deletion. No unrelated process is signalled.
    await stopOwnedProcesses();
    await database.dispose();
    rmSync(directory,{recursive:true,force:true});
  };
  try {
    await database.create();await database.verify();
    const env=subprocessEnvironment(database);
    execFileSync(process.execPath,[path.resolve(__dirname,'../server/node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:path.resolve(__dirname,'../server'),env,stdio:'pipe',timeout:60000});
    await database.verify();
    const [identity]=await database.prisma.$queryRaw<any[]>`SELECT n.oid::text AS oid, pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname=${database.schema}`;
    const proof=JSON.stringify({...identity,schema:database.schema,marker:database.marker,runId:database.runId});
    Object.assign(process.env,env,{TOKTICKIT_E2E_SCHEMA_PROOF:proof,TOKTICKIT_E2E_WORKDIR:directory});
    await prepareFixtures(database);
    // Reserve an OS-assigned port, then refuse rather than switch/reuse if it
    // becomes occupied before Vite binds it. No development server is reused.
    const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
    const address=reservation.address();if(!address||typeof address==='string')throw new Error('Could not reserve frontend port.');
    await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
    process.env.CLIENT_ORIGIN=`http://localhost:${address.port}`;
    process.env.TOKTICKIT_E2E_FRONTEND_PORT=String(address.port);
    const backend=await startProcess('backend',process.env);
    process.env.VITE_API_URL=backend.origin;
    const finalFrontend=await startProcess('frontend',process.env);
    if(finalFrontend.origin!==process.env.CLIENT_ORIGIN)throw new Error('Owned frontend origin changed.');
    process.env.TOKTICKIT_E2E_API_URL=backend.origin;
    process.env.TOKTICKIT_E2E_BASE_URL=finalFrontend.origin;
    const health=await fetch(`${backend.origin}/api/health`,{signal:AbortSignal.timeout(5000)});
    if(!health.ok || (await health.json()).service!=='TokTickIT API')throw new Error('Owned backend health verification failed.');
    execFileSync(process.execPath,['--import',path.resolve(__dirname,'../server/node_modules/tsx/dist/loader.mjs'),path.resolve(__dirname,'../server/scripts/prepare-e2e-users.ts')],{cwd:directory,env:process.env,stdio:'pipe',timeout:60000});
    return cleanup;
  } catch {
    await cleanup();
    throw new Error('Isolated E2E setup failed; sensitive subprocess output withheld.');
  }
}
