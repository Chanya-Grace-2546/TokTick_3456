import { explicitTestUrl, databaseIdentity, testRunId } from './databaseSafety.mjs';

// Child processes cannot inherit the parent's in-memory registry. Pass only its
// verified schema identity, then compare every field with PostgreSQL before writes.
export async function verifyE2ETarget(prisma, env = process.env) {
  const source = explicitTestUrl(env.TOKTICKIT_TEST_DATABASE_URL);
  const url = explicitTestUrl(env.DATABASE_URL);
  source.searchParams.delete('schema');
  const target = new URL(url); target.searchParams.delete('schema');
  source.searchParams.sort(); target.searchParams.sort();
  if (source.toString() !== target.toString()) throw new Error('E2E connection differs from the explicit test target.');
  let proof;
  try { proof = JSON.parse(env.TOKTICKIT_E2E_SCHEMA_PROOF); } catch { throw new Error('Missing E2E schema ownership proof.'); }
  const run = testRunId(env.TOKTICKIT_TEST_RUN_ID);
  if (!proof || proof.runId !== run || !/^issue8_test_[a-f0-9]{32}$/.test(proof.schema) ||
      url.searchParams.get('schema') !== proof.schema || !/^\d+$/.test(proof.oid) ||
      typeof proof.marker !== 'string' || !proof.marker.startsWith(`toktickit-test:${run}:`)) {
    throw new Error('Invalid E2E schema ownership proof.');
  }
  const identity = await databaseIdentity(prisma);
  const [row] = await prisma.$queryRaw`SELECT n.oid::text AS oid, obj_description(n.oid,'pg_namespace') AS marker,
    pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname=${proof.schema}`;
  if (identity.schema !== proof.schema || !row || row.oid !== proof.oid || row.marker !== proof.marker ||
      row.owner !== proof.owner || identity.role !== proof.owner) throw new Error('E2E schema identity mismatch; refusing writes.');
  return identity;
}
