import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DisposableDatabase, subprocessEnvironment, verifyCurrentTestDatabase, postgresEnvironment, verifyArchiveEntries } from "../../helpers/databaseSafety.mjs";

function recoveryFailure(stage: string, error: unknown): Error {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = Number.isInteger(value.status) && Number(value.status) >= 0 && Number(value.status) <= 255
    ? `; exit status ${value.status}` : "";
  const signal = typeof value.signal === "string" && ["SIGTERM", "SIGKILL", "SIGINT", "SIGABRT", "SIGSEGV"].includes(value.signal)
    ? `; signal ${value.signal}` : "";
  const code = typeof value.code === "string" && (/^[0-9A-Z]{5}$/.test(value.code) || ["ENOENT", "ETIMEDOUT", "ECONNREFUSED"].includes(value.code))
    ? `; code ${value.code}` : "";
  return new Error(`Isolated recovery failed; stage: ${stage}${status}${signal}${code}. Unverified schemas are retained, not deleted.`);
}

function validateRecoveryArchive(entries: string[], schema: string) {
  verifyArchiveEntries(entries, schema);
  // This fixture restores only the known migration baseline object kinds.
  // Do not let a schema-shaped EXTENSION or another unexpected TOC kind pass
  // the shared namespace check when restoring the complete archive.
  let schemaEntries = 0;
  for (const line of entries) {
    if (!line.trim() || line.startsWith(";")) continue;
    const item = /^\d+;\s+\d+\s+\d+\s+(.+)$/.exec(line)?.[1] ?? "";
    if (/^(ENCODING - ENCODING|STDSTRINGS - STDSTRINGS|SEARCHPATH - SEARCHPATH)(?: |$)/.test(item)) continue;
    if (item.startsWith(`SCHEMA - ${schema} `)) { schemaEntries++; continue; }
    if (item.startsWith(`COMMENT - SCHEMA ${schema} `) || item.startsWith(`ACL - SCHEMA ${schema} `)) continue;
    if (new RegExp(`^(TYPE|TABLE|TABLE DATA|SEQUENCE|SEQUENCE OWNED BY|SEQUENCE SET|DEFAULT|CONSTRAINT|FK CONSTRAINT|CHECK CONSTRAINT|INDEX|COMMENT|ACL) ${schema} `).test(item)) continue;
    throw new Error("Unexpected object kind in recovery archive; refusing restore.");
  }
  if (schemaEntries !== 1) throw new Error("Recovery archive must contain exactly one owned schema creation entry.");
}

export function migrationDatabase() {
  const database = new DisposableDatabase("lab4_history");
  const server = fileURLToPath(new URL("../../..", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "toktickit-history-"));
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  cpSync(join(server, "prisma/schema.prisma"), join(directory, "schema.prisma"));
  cpSync(join(server, "prisma/migrations/migration_lock.toml"), join(migrations, "migration_lock.toml"));
  const prisma = database.prisma;
  async function deploy(stage: "lab3" | "lab4") {
    // Auxiliary fixtures may only start from the registered primary worker.
    const parent = new (await import("@prisma/client")).PrismaClient();
    try { await verifyCurrentTestDatabase(parent); } finally { await parent.$disconnect(); }
    await database.create();
    await database.verify();
    for (const entry of readdirSync(join(server, "prisma/migrations"), { withFileTypes: true })) {
      if (entry.isDirectory() && (stage === "lab4" || entry.name < "20261023")) {
        cpSync(join(server, "prisma/migrations", entry.name), join(migrations, entry.name), { recursive: true });
      }
    }
    try {
      execFileSync(process.execPath, [join(server, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
        cwd: directory, env: subprocessEnvironment(database), stdio: "pipe", timeout: 60_000,
      });
    } catch { throw new Error(`Historical fixture ${stage} migration failed; subprocess output withheld to avoid connection-string disclosure.`); }
  }
  async function seed() {
    await database.verify();
    try {
      // Keep subprocess output private to avoid exposing connection details on failure.
      execFileSync(process.execPath, [join(server, "node_modules/tsx/dist/cli.mjs"), join(server, "prisma/seed.ts")], {
        cwd: directory, env: subprocessEnvironment(database), stdio: "pipe", timeout: 60_000,
      });
    } catch { throw new Error("Seed failed in historical fixture; secret-bearing output withheld."); }
  }
  async function dispose() {
    try {
      await database.dispose();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  async function backup() {
    await database.verify();
    const env = postgresEnvironment(database);
    const archive = join(directory, "before-lab4.dump");
    try {
      execFileSync("pg_dump", ["--format=custom", "--schema", database.schema, "--file", archive], { env, stdio: "pipe", timeout: 60_000 });
    } catch { throw new Error("Isolated schema backup failed; subprocess output withheld."); }
    const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
    // Validate the archive table of contents before permitting recovery DDL.
    let entries: string[];
    try {
      entries = execFileSync("pg_restore", ["--list", archive], { env, encoding: "utf8", stdio: "pipe", timeout: 30_000 }).split("\n");
    } catch (error) { throw recoveryFailure("archive inspection", error); }
    validateRecoveryArchive(entries, database.schema);
    return async () => {
      await database.verify();
      if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== digest) throw new Error("Recovery archive changed; refusing restore.");
      validateRecoveryArchive(entries, database.schema);
      await database.dropForRecovery();
      try {
        execFileSync("pg_restore", ["--dbname", env.PGDATABASE!, "--exit-on-error", "--no-owner", "--no-privileges", archive], { env, stdio: "pipe", timeout: 60_000 });
      } catch (error) { throw recoveryFailure("pg_restore execution", error); }
      try {
        await database.registerRestored();
      } catch (error) { throw recoveryFailure("restored-schema identity verification", error); }
    };
  }
  return { prisma, directory, deploy, seed, backup, dispose };
}
