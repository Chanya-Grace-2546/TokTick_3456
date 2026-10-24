import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DisposableDatabase, subprocessEnvironment, verifyCurrentTestDatabase } from "../../helpers/databaseSafety.mjs";

export function historicalDatabase() {
  const database = new DisposableDatabase("issue8_history");
  const server = fileURLToPath(new URL("../../..", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "toktickit-history-"));
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  cpSync(join(server, "prisma/schema.prisma"), join(directory, "schema.prisma"));
  cpSync(join(server, "prisma/migrations/migration_lock.toml"), join(migrations, "migration_lock.toml"));
  const prisma = database.prisma;
  async function deploy(stage: "lab2" | "lab3") {
    // Auxiliary fixtures may only start from the registered primary worker.
    const parent = new (await import("@prisma/client")).PrismaClient();
    try { await verifyCurrentTestDatabase(parent); } finally { await parent.$disconnect(); }
    await database.create();
    await database.verify();
    for (const entry of readdirSync(join(server, "prisma/migrations"), { withFileTypes: true })) {
      if (entry.isDirectory() && (stage === "lab3" || entry.name < "20260916")) {
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
      // Capture rather than publish seed stdout: current seed prints its password.
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
  return { prisma, directory, deploy, seed, dispose };
}
