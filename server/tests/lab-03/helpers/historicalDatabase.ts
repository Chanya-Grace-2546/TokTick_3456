import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

export function historicalDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!/^issue8_test_[a-f0-9]{32}$/.test(url.searchParams.get("schema") ?? "")) {
    throw new Error("Historical fixtures require the Issue 8 isolation setup.");
  }
  const schema = `issue8_history_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  const server = fileURLToPath(new URL("../../..", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "toktickit-history-"));
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  cpSync(join(server, "prisma/schema.prisma"), join(directory, "schema.prisma"));
  cpSync(join(server, "prisma/migrations/migration_lock.toml"), join(migrations, "migration_lock.toml"));
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  function deploy(stage: "lab2" | "lab3") {
    for (const entry of readdirSync(join(server, "prisma/migrations"), { withFileTypes: true })) {
      if (entry.isDirectory() && (stage === "lab3" || entry.name < "20260916")) {
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
      // Capture rather than publish seed stdout: current seed prints its password.
      execFileSync(process.execPath, [join(server, "node_modules/tsx/dist/cli.mjs"), join(server, "prisma/seed.ts")], {
        cwd: directory, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
      });
    } catch { throw new Error("Seed failed in historical fixture; secret-bearing output withheld."); }
  }
  async function dispose() {
    try {
      if (!/^issue8_history_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe historical schema identifier.");
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await prisma.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
  return { prisma, directory, deploy, seed, dispose };
}
