import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { DisposableDatabase, subprocessEnvironment } from "../../helpers/databaseSafety.mjs";

// Each test file gets its own migrated schema. Never alter seeded/development
// administrators to simulate the last-active-admin boundary.
const database = new DisposableDatabase("issue7_test");
export const prisma = database.prisma;
export const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
export const password = "AdminTest!123";
export const replacementPassword = "Replacement!456";
let passwordHash: string;

export async function createUser(overrides: Partial<Pick<User, "name" | "email" | "role" | "isActive" | "mustChangePassword">> = {}) {
  await database.verify();
  return prisma.user.create({ data: {
    name: "Test Person", email: `${randomUUID()}@example.test`,
    passwordHash, role: "REQUESTER", isActive: true,
    mustChangePassword: false, ...overrides,
  } });
}

export async function sessionFor(user: User, options: { expired?: boolean; invalidated?: boolean } = {}) {
  await database.verify();
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: {
    userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 3_600_000)),
    invalidatedAt: options.invalidated ? new Date() : null,
  } });
  return `toktickit_session=${token}`;
}

export async function createTicket(requesterId: number, ownerId: number | null = null) {
  await database.verify();
  const category = await prisma.category.create({ data: { name: randomUUID() } });
  const system = await prisma.relatedSystem.create({ data: { name: randomUUID() } });
  return prisma.ticket.create({ data: {
    ticketNumber: `ISSUE7-${randomUUID()}`, requesterId, ownerId,
    categoryId: category.id, relatedSystemId: system.id,
    summary: "Preserved request", description: "Issue 7 historical references fixture",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM",
  } });
}

export function expectSafeUser(value: unknown) {
  expect(value).toEqual({
    id: expect.any(Number), name: expect.any(String), email: expect.any(String),
    role: expect.stringMatching(/^(REQUESTER|IT_STAFF|ADMINISTRATOR)$/),
    isActive: expect.any(Boolean), mustChangePassword: expect.any(Boolean),
  });
}

export function useAdminDatabase() {
  const fixture = {} as {
    admin: User; staff: User; requester: User; inactive: User;
    initialAdmin: User; adminCookie: string;
  };

  beforeAll(async () => {
    await database.create();
    await database.verify();
    const serverDirectory = fileURLToPath(new URL("../../..", import.meta.url));
    try {
      execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
        cwd: serverDirectory,
        env: subprocessEnvironment(database),
        stdio: "pipe", timeout: 60_000,
      });
    } catch {
      // Do not echo connection strings or migration subprocess environment.
      throw new Error("Could not migrate the isolated Issue 7 test schema. Check PostgreSQL connectivity and schema permissions.");
    }
    await database.verify();
    passwordHash = await bcrypt.hash(password, 12);
  }, 65_000);

  beforeEach(async () => {
    await database.verify();
    await prisma.internalNote.deleteMany();
    await prisma.publicComment.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();
    await prisma.relatedSystem.deleteMany();
    fixture.admin = await createUser({ name: "Admin Person", email: "admin@example.test", role: Role.ADMINISTRATOR });
    fixture.staff = await createUser({ name: "Alex Support", email: "support@example.test", role: Role.IT_STAFF });
    fixture.requester = await createUser({ name: "Alex Requester", email: "requester@example.test" });
    fixture.inactive = await createUser({ name: "Inactive Person", email: "inactive@example.test", isActive: false });
    // Inactive so it must never count toward the last-active-admin invariant.
    fixture.initialAdmin = await createUser({ role: Role.ADMINISTRATOR, isActive: false, mustChangePassword: true });
    fixture.adminCookie = await sessionFor(fixture.admin);
  });

  afterAll(() => database.dispose());
  return fixture;
}
