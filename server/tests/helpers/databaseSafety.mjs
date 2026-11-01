import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE = 'toktickit_e2e_test';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function explicitTestUrl(source = process.env.TOKTICKIT_TEST_DATABASE_URL) {
  if (!source) throw new Error('Set TOKTICKIT_TEST_DATABASE_URL explicitly; environment-file fallback is forbidden.');
  let url;
  try { url = new URL(source); } catch { throw new Error('Invalid explicit test database URL; value withheld.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== `/${TEST_DATABASE}` || !url.hostname || !url.username) {
    throw new Error('Only an explicit PostgreSQL connection to toktickit_e2e_test is allowed.');
  }
  // Reject driver/libpq overrides that could redirect a verified connection.
  const allowed = ['schema', 'sslmode', 'sslcert', 'sslidentity', 'sslpassword', 'sslaccept', 'connect_timeout', 'pool_timeout', 'connection_limit', 'pgbouncer', 'application_name', 'statement_cache_size'];
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Unsupported or repeated test connection option; refusing connection override.');
  }
  if (url.searchParams.get('schema') === 'public') throw new Error('The public schema is forbidden for test connections.');
  return url;
}
export function testRunId(value = process.env.TOKTICKIT_TEST_RUN_ID) {
  if (!value || !uuid.test(value)) throw new Error('Missing or invalid test run identity.');
  return value;
}

export async function databaseIdentity(prisma) {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_user AS role`;
  if (!identity || identity.database !== TEST_DATABASE) throw new Error('Connected database is not toktickit_e2e_test.');
  return identity;
}

// Optional, read-only information, never an acceptance gate. Superuser access
// cannot provide a privilege-enforced sandbox; operation-level guards below
// apply equally to every role.
export async function inspectTestRole(prisma) {
  const identity = await databaseIdentity(prisma);
  const [role] = await prisma.$queryRaw`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`;
  if (!role) throw new Error('Could not identify the connected PostgreSQL role.');
  return {
    database: identity.database,
    superuser: Boolean(role.rolsuper),
    limitations: [
      'Isolation relies on trusted test code and operation-level database/schema checks, not PostgreSQL permissions.',
      'A superuser can access other databases and bypass permissions; arbitrary SQL, security-definer functions and extension code are not sandboxed.',
    ],
  };
}

const quoteIdentifier = name => '"' + name.replaceAll('"', '""') + '"';

async function cleanupObjects(tx, schema, kind) {
  // Inventory is refreshed after each group: dropping a table can remove its
  // internal indexes, constraints and owned serial sequence automatically.
  if (kind === 'TABLE' || kind === 'SEQUENCE') {
    const kinds = kind === 'TABLE' ? ['r', 'p'] : ['S'];
    return tx.$queryRaw`SELECT c.oid::text AS oid, n.nspname AS schema, c.relname AS name,
      pg_has_role(current_user,c.relowner,'USAGE') AS owned
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=${schema} AND c.relkind::text=ANY(${kinds}::text[]) ORDER BY c.oid`;
  }
  if (kind === 'ROUTINE') return tx.$queryRaw`SELECT p.oid::text AS oid, n.nspname AS schema, p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS arguments, pg_has_role(current_user,p.proowner,'USAGE') AS owned
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=${schema} AND p.prokind IN ('f','p') ORDER BY p.oid`;
  return tx.$queryRaw`SELECT t.oid::text AS oid, n.nspname AS schema, t.typname AS name,
    pg_has_role(current_user,t.typowner,'USAGE') AS owned
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${schema} AND t.typtype='e' ORDER BY t.oid`;
}

async function refuseExternalDependencies(tx, schema) {
  // RESTRICT alone is not sufficient: internal/automatic dependencies (for
  // example a serial sequence moved to another schema) may otherwise be removed.
  // Follow dependency edges from the namespace and resolve table-owned objects
  // back to their containing relation. Unknown namespaces fail closed too.
  const outside = await tx.$queryRaw`WITH RECURSIVE dependent(classid,objid,objsubid) AS (
    SELECT 'pg_namespace'::regclass::oid,n.oid,0 FROM pg_namespace n WHERE n.nspname=${schema}
    UNION
    SELECT d.classid,d.objid,d.objsubid FROM pg_depend d JOIN dependent parent
      ON d.refclassid=parent.classid AND d.refobjid=parent.objid
  ), owned_toast AS (
    -- A physical pg_toast namespace alone never establishes ownership.
    SELECT toast.oid,toast.reltype,toast.relowner FROM pg_class base
    JOIN pg_namespace base_ns ON base_ns.oid=base.relnamespace
    JOIN pg_class toast ON toast.oid=base.reltoastrelid
    JOIN pg_namespace toast_ns ON toast_ns.oid=toast.relnamespace
    WHERE base_ns.nspname=${schema} AND base.relkind IN ('r','p')
      AND pg_get_userbyid(base.relowner)=current_user
      AND toast.relkind='t' AND toast_ns.nspname='pg_toast'
      AND toast.relowner=base.relowner
      AND EXISTS (SELECT 1 FROM pg_depend link
        WHERE link.classid='pg_class'::regclass AND link.objid=toast.oid AND link.objsubid=0
          AND link.refclassid='pg_class'::regclass AND link.refobjid=base.oid AND link.refobjsubid=0
          AND link.deptype='i')
  ), toast_relations AS (
    SELECT oid,reltype,relowner FROM owned_toast
    UNION
    SELECT idx.oid,idx.reltype,idx.relowner FROM owned_toast toast
    JOIN pg_index link ON link.indrelid=toast.oid
    JOIN pg_class idx ON idx.oid=link.indexrelid
    JOIN pg_namespace ns ON ns.oid=idx.relnamespace
    WHERE idx.relkind='i' AND ns.nspname='pg_toast' AND idx.relowner=toast.relowner
  ), toast_types AS (
    SELECT t.oid,t.typarray,t.typowner FROM toast_relations relation
    JOIN pg_type t ON t.oid=relation.reltype AND t.typrelid=relation.oid
    JOIN pg_namespace ns ON ns.oid=t.typnamespace
    WHERE ns.nspname='pg_toast' AND t.typowner=relation.relowner
  ), trusted_internal(classid,objid) AS (
    SELECT 'pg_class'::regclass::oid,oid FROM toast_relations
    UNION
    SELECT 'pg_type'::regclass::oid,oid FROM toast_types
    UNION
    SELECT 'pg_type'::regclass::oid,arr.oid FROM toast_types element
    JOIN pg_type arr ON arr.oid=element.typarray AND arr.typelem=element.oid
    JOIN pg_namespace ns ON ns.oid=arr.typnamespace
    WHERE ns.nspname='pg_toast' AND arr.typowner=element.typowner
  ), locations AS (
    SELECT d.classid,d.objid,COALESCE(
      CASE WHEN d.classid='pg_namespace'::regclass THEN (SELECT nspname FROM pg_namespace WHERE oid=d.objid) END,
      CASE WHEN d.classid='pg_class'::regclass THEN (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=d.objid) END,
      CASE WHEN d.classid='pg_constraint'::regclass THEN (SELECT n.nspname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.oid=d.objid) END,
      CASE WHEN d.classid='pg_attrdef'::regclass THEN (SELECT n.nspname FROM pg_attrdef a JOIN pg_class c ON c.oid=a.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.oid=d.objid) END,
      CASE WHEN d.classid='pg_rewrite'::regclass THEN (SELECT n.nspname FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.oid=d.objid) END,
      CASE WHEN d.classid='pg_trigger'::regclass THEN (SELECT n.nspname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.oid=d.objid) END,
      CASE WHEN d.classid='pg_policy'::regclass THEN (SELECT n.nspname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE p.oid=d.objid) END,
      (pg_identify_object(d.classid,d.objid,d.objsubid)).schema
    ) AS namespace FROM dependent d
  ) SELECT classid::text,objid::text FROM locations WHERE namespace IS DISTINCT FROM ${schema}
    AND NOT EXISTS (SELECT 1 FROM trusted_internal trusted
      WHERE trusted.classid=locations.classid AND trusted.objid=locations.objid) LIMIT 1`;
  if (outside.length) throw new Error('External or unresolved dependency; preserving schema.');
}

const registry = new Map();
export class DisposableDatabase {
  constructor(prefix, source = process.env.TOKTICKIT_TEST_DATABASE_URL) {
    if (!/^(issue8_test|issue7_test|issue8_history|lab4_history)$/.test(prefix)) throw new Error('Unapproved test schema prefix.');
    this.runId = testRunId();
    this.schema = `${prefix}_${randomUUID().replaceAll('-', '')}`;
    this.url = explicitTestUrl(source);
    this.url.searchParams.set('schema', this.schema);
    this.prisma = new PrismaClient({ datasources: { db: { url: this.url.toString() } } });
    this.marker = `toktickit-test:${this.runId}:${randomUUID()}`;
    this.owned = undefined;
    this.restoring = false;
  }
  async namespace() {
    const [row] = await this.prisma.$queryRaw`SELECT n.oid::text AS oid, obj_description(n.oid,'pg_namespace') AS marker,
      pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname=${this.schema}`;
    return row;
  }
  async create() {
    if (this.owned) return this.verify();
    if (this.restoring) throw new Error('Recovery must finish before further schema operations.');
    await databaseIdentity(this.prisma);
    if (await this.namespace()) throw new Error('Schema already exists; refusing to reuse or delete it.');
    // CREATE (without IF NOT EXISTS), comment, and ownership registration are atomic.
    await this.prisma.$transaction(async tx => {
      await databaseIdentity(tx);
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${this.schema}"`);
      await tx.$executeRawUnsafe(`COMMENT ON SCHEMA "${this.schema}" IS '${this.marker}'`);
      const [row] = await tx.$queryRaw`SELECT n.oid::text AS oid, obj_description(n.oid,'pg_namespace') AS marker,
        pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname=${this.schema}`;
      const identity = await databaseIdentity(tx);
      if (!row || row.marker !== this.marker || row.owner !== identity.role || identity.schema !== this.schema) throw new Error('Created schema identity verification failed.');
      this.pending = row;
    });
    this.owned = this.pending;
    this.pending = undefined;
    registry.set(this.schema, this);
    await this.verify();
  }
  async verify(prisma = this.prisma) {
    if (!this.owned || registry.get(this.schema) !== this || this.runId !== testRunId()) throw new Error('Schema is not registered to this run.');
    const identity = await databaseIdentity(prisma);
    const [row] = await prisma.$queryRaw`SELECT n.oid::text AS oid, obj_description(n.oid,'pg_namespace') AS marker,
      pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n WHERE n.nspname=${this.schema}`;
    if (identity.schema !== this.schema || this.schema === 'public' || !row || row.oid !== this.owned.oid ||
        row.marker !== this.marker || row.owner !== this.owned.owner || row.owner !== identity.role) {
      throw new Error('Database/schema ownership verification failed; refusing mutation or cleanup.');
    }
    return identity;
  }
  async drop() {
    if (!this.owned) return; // Failed setup never authorizes cleanup of an existing namespace.
    await this.verify();
    let stage = 'transaction start';
    try {
      // Every cleanup statement is restrictive and transactional. A dependency,
      // unsupported object or ownership change rolls the entire cleanup back.
      await this.prisma.$transaction(async tx => {
        stage = 'transaction identity verification';
        await this.verify(tx);
        stage = 'external dependency inspection';
        await refuseExternalDependencies(tx, this.schema);
        for (const kind of ['TABLE', 'ROUTINE', 'SEQUENCE', 'TYPE']) {
          stage = `${kind} identity verification`;
          await this.verify(tx);
          stage = `${kind} inventory`;
          const objects = await cleanupObjects(tx, this.schema, kind);
          if (objects.some(object => !object.owned || object.schema !== this.schema)) throw new Error('Unowned cleanup object.');
          if (!objects.length) continue;
          const names = objects.map(object => `${quoteIdentifier(this.schema)}.${quoteIdentifier(object.name)}${kind === 'ROUTINE' ? `(${object.arguments})` : ''}`);
          stage = `${kind} drop`;
          await tx.$executeRawUnsafe(`DROP ${kind} ${names.join(', ')} RESTRICT`);
        }
        stage = 'SCHEMA identity verification';
        await this.verify(tx);
        stage = 'SCHEMA drop';
        await tx.$executeRawUnsafe(`DROP SCHEMA "${this.schema}" RESTRICT`);
        stage = 'transaction commit';
      });
    } catch (error) {
      // Never forward driver messages, detail, SQL or causes: they may contain
      // connection strings. Only validated SQLSTATE/Prisma code tokens are safe.
      const sqlstate = error?.meta?.code ?? error?.code;
      const postgresCode = typeof sqlstate === 'string' && /^[0-9A-Z]{5}$/.test(sqlstate) && (error?.meta?.code !== undefined || !/^P[0-9]{4}$/.test(sqlstate))
        ? `; PostgreSQL ${sqlstate}` : '';
      const prismaCode = typeof error?.code === 'string' && /^P[0-9]{4}$/.test(error.code)
        ? `; Prisma ${error.code}` : '';
      throw new Error(`Safe cleanup refused for ${this.schema}; schema preserved. Stage: ${stage}${postgresCode}${prismaCode}.`);
    }
    registry.delete(this.schema);
    this.owned = undefined;
  }
  async dispose() {
    try { await this.drop(); } finally { await this.prisma.$disconnect(); }
  }
  async dropForRecovery() {
    await this.verify();
    await this.drop();
    this.restoring = true;
    await this.prisma.$disconnect();
  }
  async registerRestored() {
    if (!this.restoring) throw new Error('No owned recovery operation is in progress.');
    const identity = await databaseIdentity(this.prisma);
    const row = await this.namespace();
    if (!row || row.marker !== this.marker || row.owner !== identity.role || identity.schema !== this.schema) throw new Error('Restored schema ownership does not match; refusing adoption.');
    this.owned = row;
    this.restoring = false;
    registry.set(this.schema, this);
    await this.verify();
  }
}
export async function verifyCurrentTestDatabase(prisma) {
  const url = explicitTestUrl(process.env.DATABASE_URL);
  const schema = url.searchParams.get('schema');
  const handle = registry.get(schema);
  if (!handle) throw new Error('Connection schema is not registered to this test run.');
  return handle.verify(prisma);
}
export function subprocessEnvironment(handle) {
  explicitTestUrl(handle.url.toString());
  if (!handle.owned || registry.get(handle.schema) !== handle) throw new Error('Cannot run subprocess for unowned schema.');
  // Never forward libpq service/options defaults that could redirect subprocesses.
  const env = { ...process.env, DATABASE_URL: handle.url.toString() };
  for (const key of Object.keys(env)) if (key.startsWith('PG') || key === 'PRISMA_SCHEMA' || key === 'NODE_OPTIONS') delete env[key];
  return env;
}

export function postgresEnvironment(handle) {
  const env = subprocessEnvironment(handle);
  const url = explicitTestUrl(handle.url.toString());
  // Prisma identity bundles are not interchangeable with libpq certificate files.
  if (url.searchParams.has('sslidentity') || url.searchParams.has('sslpassword') || url.searchParams.has('sslaccept') || url.searchParams.has('pgbouncer')) {
    throw new Error('Recovery requires a direct libpq-compatible test connection; refusing transport fallback.');
  }
  return { ...env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: TEST_DATABASE,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
    ...(url.searchParams.has('sslcert') ? { PGSSLROOTCERT: url.searchParams.get('sslcert') } : {}),
    PGCONNECT_TIMEOUT: '10', PGOPTIONS: `-c search_path=${handle.schema}` };
}

export function verifyArchiveEntries(entries, schema) {
  if (!/^(issue8_test|issue7_test|issue8_history|lab4_history)_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe recovery schema.');
  let selected = 0;
  for (const line of entries) {
    if (!line.trim() || line.startsWith(';')) continue;
    const match = /^\d+;\s+\d+\s+\d+\s+(.+)$/.exec(line);
    if (!match) throw new Error('Unrecognized recovery archive entry.');
    const item = match[1];
    if (/^(ENCODING - ENCODING|STDSTRINGS - STDSTRINGS|SEARCHPATH - SEARCHPATH)(?: |$)/.test(item)) continue;
    if (new RegExp(`^SCHEMA - ${schema}(?: |$)`).test(item) ||
        new RegExp(`^(COMMENT|ACL) - SCHEMA ${schema}(?: |$)`).test(item) ||
        new RegExp(`^[A-Z][A-Z ]* ${schema} `).test(item)) { selected++; continue; }
    throw new Error('Recovery archive contains an entry outside the owned schema.');
  }
  if (!selected) throw new Error('Empty recovery archive.');
}

export async function verifiedSqlObject(prisma, name) {
  const identity = await verifyCurrentTestDatabase(prisma);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Invalid test SQL object name.');
  return `"${identity.schema}"."${name}"`;
}
