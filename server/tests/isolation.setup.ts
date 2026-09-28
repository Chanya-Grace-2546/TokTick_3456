import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll } from "vitest";

const serverDirectory = fileURLToPath(new URL("..", import.meta.url));
const source = process.env.DATABASE_URL;
if (!source) throw new Error("Tests require a PostgreSQL DATABASE_URL; no database operations were performed.");
const schema = `issue8_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(source);
url.searchParams.set("schema", schema);
process.env.DATABASE_URL = url.toString();
process.env.CLIENT_ORIGIN = "http://localhost:5173";

// Production upload storage is relative to cwd. Keep actual multer/filesystem
// behavior, but redirect it into a disposable directory before app imports.
const originalDirectory = process.cwd();
const directory = mkdtempSync(join(tmpdir(), "toktickit-issue8-"));
process.chdir(directory);
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

beforeAll(async () => {
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      cwd: serverDirectory, env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: "pipe", timeout: 60_000,
    });
  } catch {
    throw new Error("Could not migrate disposable Issue 8 schema. Check PostgreSQL connectivity/schema permissions.");
  }
  const current = await prisma.$queryRawUnsafe<{ schema: string }[]>("SELECT current_schema() AS schema");
  if (current[0]?.schema !== schema) throw new Error("Refusing fixture writes outside the generated test schema.");
  // Preserve the existing Lab 1 reference-data assertion, without executing
  // the product seed or importing any development accounts/tickets.
  for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
    await prisma.category.create({ data: { name } });
  }
  for (const name of ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"]) {
    await prisma.relatedSystem.create({ data: { name } });
  }
}, 65_000);

afterAll(async () => {
  try {
    // Only this locally generated identifier can reach DROP SCHEMA.
    if (!/^issue8_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema identifier.");
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});
