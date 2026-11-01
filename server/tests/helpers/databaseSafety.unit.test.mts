import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// A catalog/DDL simulator: no real Prisma engine or connection is instantiated.
const fake = vi.hoisted(() => {
  const state = { database: "toktickit_e2e_test", role: "test_role", elevated: false,
    externalDependency: false, cleanupFailure: false, cleanupError: undefined as unknown,
    toast: undefined as undefined | { kind: 'table' | 'index' | 'type' | 'array'; linked: boolean; sameOwner: boolean; parentSchema: string },
    objects: {} as Record<string, { oid: string; schema: string; name: string; owned: boolean; arguments?: string }[]>, namespaces: new Map<string, { oid: string; owner: string; marker: string }>(), writes: [] as string[], nextOid: 1 };
  class Client {
    schema: string;
    constructor(options: { datasources: { db: { url: string } } }) { this.schema = new URL(options.datasources.db.url).searchParams.get("schema")!; }
    async $queryRaw(parts: TemplateStringsArray, ...values: unknown[]) {
      const sql = parts.join("?");
      if (sql.startsWith("WITH RECURSIVE")) {
        // Model catalog evidence rather than accepting the pg_toast namespace.
        // Assert the actual SQL retains each relationship used by this model.
        if (state.toast) {
          for (const clause of ["toast.oid=base.reltoastrelid", "base_ns.nspname=?", "pg_get_userbyid(base.relowner)=current_user",
            "toast.relowner=base.relowner", "link.refobjid=base.oid", "link.deptype='i'",
            "link.indrelid=toast.oid", "idx.oid=link.indexrelid", "idx.relowner=toast.relowner",
            "t.oid=relation.reltype AND t.typrelid=relation.oid", "t.typowner=relation.relowner",
            "arr.oid=element.typarray AND arr.typelem=element.oid", "arr.typowner=element.typowner",
            "trusted.classid=locations.classid AND trusted.objid=locations.objid"]) expect(sql).toContain(clause);
          if (!state.toast.linked || !state.toast.sameOwner || state.toast.parentSchema !== this.schema) return [{ classid: "1259", objid: "99" }];
        }
        return state.externalDependency ? [{ classid: "1259", objid: "99" }] : [];
      }
      if (sql.startsWith("SELECT current_database()")) return [{ database: state.database, schema: state.namespaces.has(this.schema) ? this.schema : null, role: state.role }];
      if (sql.includes("obj_description")) return state.namespaces.has(values[0] as string) ? [state.namespaces.get(values[0] as string)] : [];
      if (sql.includes("FROM pg_roles WHERE")) return [{ rolname: state.role, rolsuper: state.elevated, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false }];
      if (sql.includes("pg_get_function_identity_arguments")) return state.objects.ROUTINE ?? [];
      if (sql.includes("SELECT c.oid::text")) return state.objects[(values[1] as string[])[0] === "S" ? "SEQUENCE" : "TABLE"] ?? [];
      if (sql.includes("SELECT t.oid::text")) return state.objects.TYPE ?? [];
      throw new Error("Unexpected mock query");
    }
    async $executeRawUnsafe(sql: string) {
      state.writes.push(sql);
      const schema = /(?:CREATE|DROP) SCHEMA "([^"]+)"/.exec(sql)?.[1];
      if (sql.startsWith("CREATE SCHEMA")) {
        if (state.namespaces.has(schema!)) throw new Error("Duplicate schema");
        state.namespaces.set(schema!, { oid: String(state.nextOid++), owner: state.role, marker: "" });
      } else if (sql.startsWith("DROP SCHEMA")) {
        if (!sql.endsWith(" RESTRICT")) throw new Error("Unrestricted schema deletion");
        if (Object.values(state.objects).some(objects => objects.length)) throw new Error("Schema not empty");
        state.namespaces.delete(schema!);
      } else if (/^DROP (TABLE|ROUTINE|SEQUENCE|TYPE) /.test(sql)) {
        if (!sql.endsWith(" RESTRICT")) throw new Error("Unrestricted object deletion");
        const kind = /^DROP (TABLE|ROUTINE|SEQUENCE|TYPE) /.exec(sql)![1];
        if (state.cleanupFailure && kind === "TYPE") throw state.cleanupError ?? new Error("Dependency blocked removal");
        state.objects[kind] = [];
      }
      else if (sql.startsWith("COMMENT ON SCHEMA")) {
        const match = /COMMENT ON SCHEMA "([^"]+)" IS '([^']+)'/.exec(sql)!;
        state.namespaces.get(match[1])!.marker = match[2];
      }
    }
    async $transaction<T>(work: (client: Client) => Promise<T>) {
      const before = new Map([...state.namespaces].map(([name, item]) => [name, { ...item }]));
      const objectsBefore = structuredClone(state.objects);
      try { return await work(this); } catch (error) { state.namespaces = before; state.objects = objectsBefore; throw error; }
    }
    async $disconnect() {}
  }
  return { state, Client };
});
vi.mock("@prisma/client", () => ({ PrismaClient: fake.Client }));
import { DisposableDatabase, explicitTestUrl, inspectTestRole, postgresEnvironment, subprocessEnvironment,
  testRunId, verifyArchiveEntries, verifyCurrentTestDatabase, verifiedSqlObject } from "./databaseSafety.mjs";

beforeEach(() => {
  fake.state.database = "toktickit_e2e_test"; fake.state.elevated = false; fake.state.role = "test_role";
  fake.state.externalDependency = false; fake.state.cleanupFailure = false; fake.state.cleanupError = undefined; fake.state.toast = undefined; fake.state.objects = {};
  fake.state.namespaces.clear(); fake.state.writes = [];
  vi.stubEnv("TOKTICKIT_TEST_DATABASE_URL", "postgresql://test:dummy@localhost/toktickit_e2e_test");
  vi.stubEnv("TOKTICKIT_TEST_RUN_ID", randomUUID());
});

describe("test safety with mocked catalogs only", () => {
  it("requires explicit settings despite DATABASE_URL being set", () => {
    vi.stubEnv("TOKTICKIT_TEST_DATABASE_URL", ""); vi.stubEnv("DATABASE_URL", "postgresql://test:dummy@localhost/toktickit");
    expect(() => explicitTestUrl()).toThrow("explicitly");
  });
  it.each(["postgresql://test:dummy@localhost/toktickit", "postgresql://test:dummy@localhost/postgres", "https://localhost/toktickit_e2e_test", "bad-url", "postgresql://localhost/toktickit_e2e_test",
    "postgresql://test:dummy@localhost/toktickit_e2e_test?schema=a&schema=b",
    "postgresql://test:dummy@localhost/toktickit_e2e_test?schema=public",
    "postgresql://test:dummy@localhost/toktickit_e2e_test?options=-csearch_path=public", "postgresql://test:dummy@localhost/toktickit_e2e_test?host=other"])("rejects wrong target/redirection %s", value => expect(() => explicitTestUrl(value)).toThrow());
  it("requires run identity and fixed prefixes", () => {
    expect(() => testRunId("public")).toThrow(); expect(() => new DisposableDatabase("public")).toThrow();
  });
  it("generates unique schemas and does not clean up an uncreated schema", async () => {
    const a = new DisposableDatabase("issue8_test"), b = new DisposableDatabase("issue8_test");
    expect(a.schema).not.toBe(b.schema); expect(a.schema).toMatch(/^issue8_test_[a-f0-9]{32}$/);
    await a.dispose(); await b.dispose(); expect(fake.state.writes).toEqual([]);
  });
  it("checks the actual database before DDL", async () => {
    const db = new DisposableDatabase("issue8_test"); fake.state.database = "toktickit";
    await expect(db.create()).rejects.toThrow("Connected database"); expect(fake.state.writes).toEqual([]);
  });
  it.each(["issue8_test", "issue7_test", "issue8_history", "lab4_history"])("permits the existing superuser with registered isolation (%s)", async prefix => {
    fake.state.elevated = true; fake.state.role = "chanya";
    const db = new DisposableDatabase(prefix);
    await db.create(); await db.verify(); await db.dispose();
    expect(fake.state.namespaces.has(db.schema)).toBe(false);
    expect(fake.state.writes.filter(sql => sql.startsWith("DROP"))).toEqual([`DROP SCHEMA "${db.schema}" RESTRICT`]);
  });
  it("still rejects the actual development database for a superuser before DDL", async () => {
    fake.state.elevated = true; fake.state.role = "chanya"; fake.state.database = "toktickit";
    await expect(new DisposableDatabase("issue8_test").create()).rejects.toThrow("Connected database");
    expect(fake.state.writes).toEqual([]);
  });
  it("never adopts or deletes a pre-existing schema", async () => {
    const db = new DisposableDatabase("issue8_test");
    fake.state.namespaces.set(db.schema, { oid: "old", owner: "test_role", marker: "pre-existing" });
    await expect(db.create()).rejects.toThrow("already exists"); await db.dispose();
    expect(fake.state.namespaces.has(db.schema)).toBe(true); expect(fake.state.writes).toEqual([]);
  });
  it("registers identity before permitting fixtures/subprocesses/cleanup", async () => {
    const db = new DisposableDatabase("issue8_test"); expect(() => subprocessEnvironment(db)).toThrow("unowned");
    await db.create(); vi.stubEnv("DATABASE_URL", db.url.toString()); await verifyCurrentTestDatabase(db.prisma);
    expect(await verifiedSqlObject(db.prisma, "ActionTakenHistory")).toBe(`"${db.schema}"."ActionTakenHistory"`);
    expect(subprocessEnvironment(db).DATABASE_URL).toBe(db.url.toString()); await db.dispose();
    expect(fake.state.namespaces.has(db.schema)).toBe(false);
  });
  it.each(["oid", "marker", "owner"] as const)("refuses cleanup after %s changes", async key => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.namespaces.set(db.schema, { ...fake.state.namespaces.get(db.schema)!, [key]: "changed" });
    const before = fake.state.writes.length; await expect(db.dispose()).rejects.toThrow("ownership");
    expect(fake.state.writes.length).toBe(before); expect(fake.state.namespaces.has(db.schema)).toBe(true);
  });
  it("refuses cleanup after actual database changes", async () => {
    const db = new DisposableDatabase("issue8_test"); await db.create(); fake.state.database = "toktickit";
    const before = fake.state.writes.length; await expect(db.dispose()).rejects.toThrow("Connected database"); expect(fake.state.writes.length).toBe(before);
  });
  it("verifies recovery ownership before dropping and after restoration", async () => {
    const db = new DisposableDatabase("lab4_history"); await expect(db.dropForRecovery()).rejects.toThrow("registered");
    await db.create(); await db.dropForRecovery();
    fake.state.namespaces.set(db.schema, { oid: "restored", owner: "test_role", marker: "wrong" });
    await expect(db.registerRestored()).rejects.toThrow("Restored schema");
    fake.state.namespaces.set(db.schema, { oid: "restored", owner: "test_role", marker: db.marker });
    await db.registerRestored(); await db.dispose();
  });
  it("accepts only archive entries within the owned schema", () => {
    const schema = `lab4_history_${"a".repeat(32)}`;
    expect(() => verifyArchiveEntries([`; archive`, `1; 2615 1 SCHEMA - ${schema} test_role`, `2; 1259 2 TABLE ${schema} Ticket test_role`], schema)).not.toThrow();
    for (const entry of ["1; 1259 1 TABLE public Ticket owner", "1; 1262 1 DATABASE - toktickit owner", "1; 1259 1 TABLE other Ticket owner"]) expect(() => verifyArchiveEntries([entry], schema)).toThrow();
    expect(() => verifyArchiveEntries([], schema)).toThrow();
  });
  it("clears libpq redirection and pins recovery database/search path", async () => {
    const db = new DisposableDatabase("lab4_history"); await db.create();
    vi.stubEnv("PGSERVICE", "development"); vi.stubEnv("PGOPTIONS", "-c search_path=public");
    const env = postgresEnvironment(db); expect(env.PGSERVICE).toBeUndefined(); expect(env.PGDATABASE).toBe("toktickit_e2e_test");
    expect(env.PGOPTIONS).toBe(`-c search_path=${db.schema}`); await db.dispose();
  });
  it.each([false, true])("reports superuser status without DDL or an acceptance gate (%s)", async superuser => {
    fake.state.elevated = superuser;
    const report = await inspectTestRole(new DisposableDatabase("issue8_test").prisma);
    expect(report.database).toBe("toktickit_e2e_test");
    expect(report.superuser).toBe(superuser);
    expect(report.limitations).toEqual(expect.arrayContaining([expect.stringContaining("trusted test code"), expect.stringContaining("not sandboxed")]));
    expect(fake.state.writes).toEqual([]);
  });
  it.each(["oid", "marker", "owner", "schema", "run"])("superuser cannot bypass %s verification", async changed => {
    fake.state.elevated = true; fake.state.role = "chanya";
    const db = new DisposableDatabase("issue8_test"); await db.create();
    if (changed === "schema") (db.prisma as unknown as { schema: string }).schema = "public";
    else if (changed === "run") vi.stubEnv("TOKTICKIT_TEST_RUN_ID", randomUUID());
    else fake.state.namespaces.set(db.schema, { ...fake.state.namespaces.get(db.schema)!, [changed]: "changed" });
    const before = fake.state.writes.length;
    await expect(db.drop()).rejects.toThrow();
    expect(fake.state.writes.length).toBe(before);
    expect(fake.state.namespaces.has(db.schema)).toBe(true);
  });
  it("preserves a registered schema when dependencies cross or cannot be resolved", async () => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.externalDependency = true;
    const before = fake.state.writes.length;
    await expect(db.drop()).rejects.toThrow("schema preserved");
    expect(fake.state.writes.length).toBe(before); expect(fake.state.namespaces.has(db.schema)).toBe(true);
  });
  it.each(['table', 'index', 'type', 'array'] as const)("accepts a proven internal TOAST %s", async kind => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.objects.TABLE = [{ oid: "10", schema: db.schema, name: "ActionTaken", owned: true }];
    fake.state.toast = { kind, linked: true, sameOwner: true, parentSchema: db.schema };
    await db.drop();
    expect(fake.state.namespaces.has(db.schema)).toBe(false);
    expect(fake.state.writes.filter(sql => sql.startsWith("DROP"))).toEqual([
      `DROP TABLE "${db.schema}"."ActionTaken" RESTRICT`, `DROP SCHEMA "${db.schema}" RESTRICT`,
    ]);
  });
  it.each(['table', 'index', 'type', 'array'] as const)("refuses an unrelated TOAST %s even in pg_toast", async kind => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.toast = { kind, linked: true, sameOwner: true, parentSchema: "public" };
    const before = fake.state.writes.length;
    await expect(db.drop()).rejects.toThrow("Stage: external dependency inspection");
    expect(fake.state.writes.length).toBe(before); expect(fake.state.namespaces.has(db.schema)).toBe(true);
  });
  it.each(['linked', 'sameOwner'] as const)("refuses unproven TOAST ownership (%s)", async missing => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.toast = { kind: 'table', linked: true, sameOwner: true, parentSchema: db.schema, [missing]: false };
    await expect(db.drop()).rejects.toThrow("Stage: external dependency inspection");
    expect(fake.state.writes.some(sql => sql.startsWith("DROP"))).toBe(false);
  });
  it("does not let legitimate TOAST storage mask a genuine external dependency", async () => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.toast = { kind: 'index', linked: true, sameOwner: true, parentSchema: db.schema };
    fake.state.externalDependency = true;
    await expect(db.drop()).rejects.toThrow("Stage: external dependency inspection");
    expect(fake.state.writes.some(sql => sql.startsWith("DROP"))).toBe(false);
  });
  it.each([
    { code: "P2010", meta: { code: "2BP01" }, expected: "PostgreSQL 2BP01; Prisma P2010" },
    { code: "42501", expected: "PostgreSQL 42501" },
    { code: "postgresql://secret", meta: { code: "password=secret" }, expected: "Stage: TYPE drop." },
  ])("reports a safe failing stage/code and rolls back after valid TOAST inspection ($expected)", async details => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.toast = { kind: 'table', linked: true, sameOwner: true, parentSchema: db.schema };
    fake.state.objects.TABLE = [{ oid: "10", schema: db.schema, name: "Ticket", owned: true }];
    fake.state.objects.TYPE = [{ oid: "11", schema: db.schema, name: "ActionState", owned: true }];
    fake.state.cleanupFailure = true;
    fake.state.cleanupError = Object.assign(new Error("postgresql://password=secret"), details);
    const error = await db.drop().catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(details.expected);
    expect((error as Error).message).not.toMatch(/secret|password|postgresql:\/\//);
    expect((error as Error).cause).toBeUndefined();
    expect(fake.state.namespaces.has(db.schema)).toBe(true);
    expect(fake.state.objects.TABLE).toHaveLength(1); expect(fake.state.objects.TYPE).toHaveLength(1);
    await db.verify();
  });
  it("removes only verified owned objects, using RESTRICT for every drop", async () => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.objects = {
      TABLE: [{ oid: "10", schema: db.schema, name: "Ticket", owned: true }, { oid: "11", schema: db.schema, name: "ActionTaken", owned: true }],
      ROUTINE: [{ oid: "12", schema: db.schema, name: "audit_trigger", owned: true, arguments: "" }],
      SEQUENCE: [{ oid: "13", schema: db.schema, name: "remaining_sequence", owned: true }],
      TYPE: [{ oid: "14", schema: db.schema, name: "ActionState", owned: true }],
    };
    await db.drop();
    const statements = fake.state.writes.filter(sql => sql.startsWith("DROP"));
    expect(statements).toHaveLength(5);
    for (const sql of statements) { expect(sql).toContain(`"${db.schema}"`); expect(sql).toMatch(/ RESTRICT$/); expect(sql).not.toContain("CASCADE"); }
    expect(fake.state.namespaces.has(db.schema)).toBe(false);
  });
  it.each([false, true])("refuses cleanup of unowned or differently scoped objects (%s)", async otherSchema => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.objects.TABLE = [{ oid: "10", schema: otherSchema ? "public" : db.schema, name: "Ticket", owned: otherSchema }];
    const before = fake.state.writes.length;
    await expect(db.drop()).rejects.toThrow("schema preserved");
    expect(fake.state.writes.length).toBe(before); expect(fake.state.namespaces.has(db.schema)).toBe(true);
  });
  it("rolls all cleanup back if a restrictive object drop fails", async () => {
    const db = new DisposableDatabase("issue8_test"); await db.create();
    fake.state.objects.TABLE = [{ oid: "10", schema: db.schema, name: "Ticket", owned: true }];
    fake.state.objects.TYPE = [{ oid: "11", schema: db.schema, name: "ActionState", owned: true }];
    fake.state.cleanupFailure = true;
    await expect(db.drop()).rejects.toThrow("schema preserved");
    expect(fake.state.namespaces.has(db.schema)).toBe(true);
    expect(fake.state.objects.TABLE).toHaveLength(1); expect(fake.state.objects.TYPE).toHaveLength(1);
    await db.verify();
  });
  it("applies the same external-dependency refusal to recovery", async () => {
    const db = new DisposableDatabase("lab4_history"); await db.create(); fake.state.externalDependency = true;
    await expect(db.dropForRecovery()).rejects.toThrow("schema preserved");
    expect(fake.state.namespaces.has(db.schema)).toBe(true);
    await expect(db.registerRestored()).rejects.toThrow("No owned recovery");
  });

});
