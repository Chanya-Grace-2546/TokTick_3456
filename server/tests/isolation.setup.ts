import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DisposableDatabase, subprocessEnvironment } from "./helpers/databaseSafety.mjs";
import { afterAll, beforeAll, beforeEach } from "vitest";

const serverDirectory = fileURLToPath(new URL("..", import.meta.url));
const database = new DisposableDatabase("issue8_test");
process.env.DATABASE_URL = database.url.toString();
process.env.CLIENT_ORIGIN = "http://localhost:5173";

// Production upload storage is relative to cwd. Keep actual multer/filesystem
// behavior, but redirect it into a disposable directory before app imports.
const originalDirectory = process.cwd();
const directory = mkdtempSync(join(tmpdir(), "toktickit-issue8-"));
process.chdir(directory);
const prisma = database.prisma;

beforeAll(async () => {
  await database.create();
  await database.verify();
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      cwd: serverDirectory, env: subprocessEnvironment(database),
      stdio: "pipe", timeout: 60_000,
    });
  } catch {
    throw new Error("Could not migrate disposable Issue 8 schema. Check PostgreSQL connectivity/schema permissions.");
  }
  await database.verify();
  // Preserve the existing Lab 1 reference-data assertion, without executing
  // the product seed or importing any development accounts/tickets.
  for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
    await prisma.category.create({ data: { name } });
  }
  for (const name of ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"]) {
    await prisma.relatedSystem.create({ data: { name } });
  }
}, 65_000);

// Runs before each test, including tests issuing raw SQL or deleting fixtures.
beforeEach(() => database.verify());

afterAll(async () => {
  try {
    await database.dispose();
  } finally {
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});
