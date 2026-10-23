import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

export function migrationDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!/^issue8_test_[a-f0-9]{32}$/.test(url.searchParams.get("schema") ?? "")) {
    throw new Error("Historical fixtures require the Issue 8 isolation setup.");
  }
  const schema = `lab4_history_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  const server = fileURLToPath(new URL("../../..", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "toktickit-history-"));
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  cpSync(join(server, "prisma/schema.prisma"), join(directory, "schema.prisma"));
  cpSync(join(server, "prisma/migrations/migration_lock.toml"), join(migrations, "migration_lock.toml"));
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  function deploy(stage: "lab3" | "lab4") {
    for (const entry of readdirSync(join(server, "prisma/migrations"), { withFileTypes: true })) {
      if (entry.isDirectory() && (stage === "lab4" || entry.name < "20261023")) {
        cpSync(join(server, "prisma/migrations", entry.name), join(migrations, entry.name), { recursive: true });
      }
    }
    try {
      execFileSync(process.execPath, [join(server, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], {
        cwd: directory, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
      });
    } catch { throw new Error(`Historical fixture ${stage} migration failed; subprocess output withheld to avoid connection-string disclosure.`); }
  }
  function seed() {
    try {
      // Keep subprocess output private to avoid exposing connection details on failure.
      execFileSync(process.execPath, [join(server, "node_modules/tsx/dist/cli.mjs"), join(server, "prisma/seed.ts")], {
        cwd: directory, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
      });
    } catch { throw new Error("Seed failed in historical fixture; secret-bearing output withheld."); }
  }
  async function dispose() {
    try {
      if (!/^lab4_history_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe historical schema identifier.");
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await prisma.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
  function backup() {
    const connection = new URL(url);
    connection.search = "";
    const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || "5432",
      PGDATABASE: decodeURIComponent(connection.pathname.slice(1)), PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password) };
    const archive = join(directory, "before-lab4.dump");
    execFileSync("pg_dump", ["--format=custom", "--schema", schema, "--file", archive], { env, stdio: "pipe" });
    return async () => {
      if (!/^lab4_history_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe recovery schema.");
      await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await prisma.$disconnect();
      execFileSync("pg_restore", ["--dbname", env.PGDATABASE, "--exit-on-error", "--no-owner", archive], { env, stdio: "pipe" });
    };
  }
  return { prisma, directory, deploy, seed, backup, dispose };
}
