import { randomUUID } from "node:crypto";
import { Role, User } from "@prisma/client";
import { verifyCurrentTestDatabase } from "../../helpers/databaseSafety.mjs";
import { getPrisma } from "../../../src/prisma.js";
import { generateSessionToken, hashSessionToken } from "../../../src/auth.js";

export const prisma = getPrisma();
export const origin = "http://localhost:5173";
export async function actionUser(role: Role, overrides: Partial<Pick<User, "isActive" | "mustChangePassword">> = {}) {
  await verifyCurrentTestDatabase(prisma);
  const user = await prisma.user.create({ data: { name: `${role} fixture`, email: `${randomUUID()}@actions.test`,
    passwordHash: "fixture-only-not-a-login-password", role, mustChangePassword: false, ...overrides } });
  const token = generateSessionToken();
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3600000) } });
  return { user, session, cookie: `toktickit_session=${token}` };
}
export async function actionTicket(requesterId: number, ownerId: number | null = null) {
  await verifyCurrentTestDatabase(prisma);
  return prisma.ticket.create({ data: {
    ticketNumber: `ACTION-${randomUUID()}`, requesterId, ownerId,
    categoryId: (await prisma.category.findFirstOrThrow()).id,
    relatedSystemId: (await prisma.relatedSystem.findFirstOrThrow()).id,
    summary: "Action API fixture", description: "Preserve Ticket workflow", requestedPriority: "MEDIUM",
  } });
}
