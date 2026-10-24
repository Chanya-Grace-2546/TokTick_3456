import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const schema = `lab4_history_${"a".repeat(32)}`;
  const state = {
    events: [] as string[], archive: "unchanged archive", entries: "",
    restoreError: undefined as unknown, identityError: undefined as unknown,
  };
  const database = {
    schema, prisma: {},
    verify: vi.fn(async () => { state.events.push("verify"); }),
    dropForRecovery: vi.fn(async () => { state.events.push("guarded drop"); }),
    registerRestored: vi.fn(async () => {
      state.events.push("restored identity");
      if (state.identityError) throw state.identityError;
    }),
    dispose: vi.fn(async () => {}),
  };
  return { schema, state, database, exec: vi.fn(), validate: vi.fn() };
});
vi.mock("node:child_process", () => ({ execFileSync: mock.exec }));
vi.mock("node:fs", async importOriginal => ({
  ...await importOriginal<typeof import("node:fs")>(),
  mkdtempSync: vi.fn(() => "/mock/recovery"), mkdirSync: vi.fn(), cpSync: vi.fn(), rmSync: vi.fn(),
  readFileSync: vi.fn(() => { mock.state.events.push("archive hash"); return Buffer.from(mock.state.archive); }),
}));
vi.mock("./databaseSafety.mjs", async importOriginal => {
  const actual = await importOriginal<typeof import("./databaseSafety.mjs")>();
  return {
    ...actual,
    DisposableDatabase: class { constructor() { return mock.database; } },
    postgresEnvironment: vi.fn(() => ({ PGDATABASE: "toktickit_e2e_test", PGOPTIONS: `-c search_path=${mock.schema}` })),
    verifyArchiveEntries: mock.validate.mockImplementation((entries: string[], schema: string) => {
      mock.state.events.push("archive validation"); actual.verifyArchiveEntries(entries, schema);
    }),
  };
});
import { migrationDatabase } from "../lab-04/helpers/migrationDatabase.js";

const schemaEntry = () => `1; 2615 1 SCHEMA - ${mock.schema} chanya`;
const validEntries = () => [
  "; archive", schemaEntry(), `2; 0 0 COMMENT - SCHEMA ${mock.schema} chanya`,
  `3; 1259 3 TABLE ${mock.schema} Ticket chanya`,
  `4; 0 3 TABLE DATA ${mock.schema} Ticket chanya`,
  `5; 1247 5 TYPE ${mock.schema} Role chanya`,
  `6; 1259 6 SEQUENCE ${mock.schema} Ticket_id_seq chanya`,
  `7; 0 6 SEQUENCE SET ${mock.schema} Ticket_id_seq chanya`,
].join("\n");
beforeEach(() => {
  vi.clearAllMocks();
  mock.state.events = []; mock.state.archive = "unchanged archive";
  mock.state.entries = validEntries(); mock.state.restoreError = undefined; mock.state.identityError = undefined;
  mock.exec.mockImplementation((command: string, args: string[]) => {
    if (command === "pg_dump") { mock.state.events.push("dump"); return Buffer.from(""); }
    if (command === "pg_restore" && args.includes("--list")) {
      mock.state.events.push("inspect archive"); return mock.state.entries;
    }
    if (command === "pg_restore") {
      mock.state.events.push("restore");
      if (mock.state.restoreError) throw mock.state.restoreError;
      return Buffer.from("");
    }
    throw new Error("Unexpected subprocess in mock-only recovery test");
  });
});

describe("migration recovery with mocked subprocesses and database handles", () => {
  it("dumps only its schema and restores the entire validated archive with fixed arguments", async () => {
    const restore = await migrationDatabase().backup(); await restore();
    expect(mock.exec.mock.calls[0]).toEqual(["pg_dump", ["--format=custom", "--schema", mock.schema, "--file", "/mock/recovery/before-lab4.dump"],
      expect.objectContaining({ env: expect.objectContaining({ PGDATABASE: "toktickit_e2e_test" }), stdio: "pipe", timeout: 60_000 })]);
    expect(mock.exec.mock.calls[2]).toEqual(["pg_restore", ["--dbname", "toktickit_e2e_test", "--exit-on-error", "--no-owner", "--no-privileges", "/mock/recovery/before-lab4.dump"],
      expect.objectContaining({ env: expect.objectContaining({ PGDATABASE: "toktickit_e2e_test" }), stdio: "pipe", timeout: 60_000 })]);
    expect(mock.state.events).toEqual(["verify", "dump", "archive hash", "inspect archive", "archive validation",
      "verify", "archive hash", "archive validation", "guarded drop", "restore", "restored identity"]);
  });
  it.each([
    "8; 1259 8 TABLE public Ticket chanya",
    "8; 1259 8 TABLE other_schema Ticket chanya",
    "8; 1262 8 DATABASE - toktickit_e2e_test chanya",
    "8; 3079 8 EXTENSION - some_extension chanya",
    `8; 3079 8 EXTENSION ${mock.schema} some_extension chanya`,
    `8; 1255 8 FUNCTION ${mock.schema} unrelated() chanya`,
  ])("rejects an unexpected archive entry before destructive operations: %s", async entry => {
    mock.state.entries += `\n${entry}`;
    await expect(migrationDatabase().backup()).rejects.toThrow();
    expect(mock.database.dropForRecovery).not.toHaveBeenCalled();
    expect(mock.database.registerRestored).not.toHaveBeenCalled();
    expect(mock.state.events).not.toContain("restore");
  });
  it("requires the schema creation entry", async () => {
    mock.state.entries = validEntries().split("\n").filter(line => line !== schemaEntry()).join("\n");
    await expect(migrationDatabase().backup()).rejects.toThrow("exactly one owned schema");
    expect(mock.database.dropForRecovery).not.toHaveBeenCalled();
  });
  it("checks archive integrity again before dropping anything", async () => {
    const restore = await migrationDatabase().backup(); mock.state.archive = "changed archive";
    await expect(restore()).rejects.toThrow("archive changed");
    expect(mock.database.dropForRecovery).not.toHaveBeenCalled();
    expect(mock.state.events).not.toContain("restore");
  });
  it("revalidates the selected entries before dropping anything", async () => {
    const restore = await migrationDatabase().backup();
    mock.validate.mockImplementationOnce(() => { throw new Error("Archive validation refused"); });
    await expect(restore()).rejects.toThrow("Archive validation refused");
    expect(mock.database.dropForRecovery).not.toHaveBeenCalled();
  });
  it("stops before archive access or deletion when identity verification fails", async () => {
    const restore = await migrationDatabase().backup();
    mock.database.verify.mockRejectedValueOnce(new Error("Identity mismatch"));
    await expect(restore()).rejects.toThrow("Identity mismatch");
    expect(mock.database.dropForRecovery).not.toHaveBeenCalled();
  });
  it("does not restore if guarded cleanup refuses", async () => {
    const restore = await migrationDatabase().backup();
    mock.database.dropForRecovery.mockRejectedValueOnce(new Error("Cleanup refused"));
    await expect(restore()).rejects.toThrow("Cleanup refused");
    expect(mock.state.events).not.toContain("restore");
  });
  it("reports restore execution failure safely and never adopts or deletes the failed restore", async () => {
    const restore = await migrationDatabase().backup();
    mock.state.restoreError = Object.assign(new Error("postgresql://user:secret@localhost/database"), { status: 1, stderr: "password=secret", code: "ENOENT" });
    const error = await restore().catch(error => error as Error);
    if (!(error instanceof Error)) throw new Error("Expected recovery failure");
    expect(error.message).toContain("stage: pg_restore execution; exit status 1; code ENOENT");
    expect(error.message).not.toMatch(/secret|postgresql|password/); expect(error.cause).toBeUndefined();
    expect(mock.database.registerRestored).not.toHaveBeenCalled();
    expect(mock.database.dropForRecovery).toHaveBeenCalledTimes(1); expect(mock.database.dispose).not.toHaveBeenCalled();
  });
  it("distinguishes restored identity failure from subprocess failure", async () => {
    const restore = await migrationDatabase().backup();
    mock.state.identityError = Object.assign(new Error("postgresql://user:secret@localhost/database"), { code: "P2010" });
    const error = await restore().catch(error => error as Error);
    if (!(error instanceof Error)) throw new Error("Expected recovery failure");
    expect(error.message).toContain("stage: restored-schema identity verification; code P2010");
    expect(error.message).not.toMatch(/secret|postgresql|password/); expect(error.cause).toBeUndefined();
    expect(mock.database.dropForRecovery).toHaveBeenCalledTimes(1); expect(mock.database.dispose).not.toHaveBeenCalled();
  });
  it("does not print malformed diagnostic fields", async () => {
    const restore = await migrationDatabase().backup();
    mock.state.restoreError = { status: "secret", code: "postgresql://secret", signal: "password=secret", stderr: "secret" };
    const error = await restore().catch(error => error as Error);
    if (!(error instanceof Error)) throw new Error("Expected recovery failure");
    expect(error.message).toBe("Isolated recovery failed; stage: pg_restore execution. Unverified schemas are retained, not deleted.");
  });
});
