import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ActionState, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let ticketId: number;
let actorId: number;
let assigneeId: number;
const create = (data = {}) => prisma.actionTaken.create({ data: {
  ticketId, performedByUserId: actorId, description: "Database fixture", ...data,
} });

beforeAll(async () => {
  const user = (email: string) => prisma.user.create({ data: {
    email, name: email, passwordHash: "test-only", role: "IT_STAFF",
  } });
  actorId = (await user("actor@lab4.test")).id;
  assigneeId = (await user("assignee@lab4.test")).id;
  ticketId = (await prisma.ticket.create({ data: {
    ticketNumber: "LAB4-DATABASE", requesterId: actorId, ownerId: assigneeId,
    categoryId: (await prisma.category.findFirstOrThrow()).id,
    relatedSystemId: (await prisma.relatedSystem.findFirstOrThrow()).id,
    summary: "Database test", description: "Fixture", requestedPriority: "MEDIUM",
  } })).id;
});
afterAll(() => prisma.$disconnect());

describe("Feature 2 database foundation", () => {
  it("defaults to PLANNED/version 1, nullable result and optional assignee", async () => {
    const action = await create();
    expect(action).toMatchObject({ state: "PLANNED", version: 1, result: null, assignedToUserId: null, followUpRequired: false });
    expect(action.actionAt).toBeInstanceOf(Date);
    expect(action.updatedAt).toBeInstanceOf(Date);
  });
  it("supports all four states and retains completed/cancelled rows", async () => {
    for (const state of Object.values(ActionState)) {
      const action = await create({ state, result: state === "COMPLETED" ? "Done" : null });
      expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).state).toBe(state);
    }
  });
  it("keeps performer, assignee and Ticket owner independent with inverse relations", async () => {
    const action = await create({ assignedToUserId: assigneeId });
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { actionsTaken: true } });
    expect(ticket.ownerId).toBe(assigneeId);
    expect(ticket.actionsTaken.map(a => a.id)).toContain(action.id);
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: actorId }, include: { actionsPerformed: true } });
    const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assigneeId }, include: { actionsAssigned: true } });
    expect(actor.actionsPerformed.map(a => a.id)).toContain(action.id);
    expect(assignee.actionsAssigned.map(a => a.id)).toContain(action.id);
  });
  it.each([
    { state: "COMPLETED", result: null }, { state: "COMPLETED", result: " \n\t" },
    { followUpRequired: true }, { followUpRequired: true, followUpNote: "\t " },
    { description: " " }, { version: 0 },
  ])("rejects invalid row-local data: %j", async data => {
    await expect(create(data)).rejects.toThrow();
  });
  it("enforces required fields and valid foreign keys in PostgreSQL", async () => {
    for (const data of [{ ticketId: 2147483647 }, { performedByUserId: 2147483647 }, { assignedToUserId: 2147483647 }]) {
      await expect(create(data)).rejects.toMatchObject({ code: "P2003" });
    }
    await expect(prisma.$executeRaw`INSERT INTO "ActionTaken" ("ticketId", "performedByUserId", "updatedAt") VALUES (${ticketId}, ${actorId}, CURRENT_TIMESTAMP)`).rejects.toThrow();
  });
  it("persists before/after history and Ticket transitions across client reconnect", async () => {
    const action = await create();
    await prisma.$transaction(async tx => {
      await tx.actionTaken.update({ where: { id: action.id }, data: { state: "IN_PROGRESS", version: { increment: 1 } } });
      await tx.actionTakenHistory.create({ data: { actionId: action.id, actorUserId: actorId,
        oldState: "PLANNED", newState: "IN_PROGRESS", beforeJson: { version: 1 }, afterJson: { version: 2 } } });
    });
    const event = await prisma.ticketStatusHistory.create({ data: { ticketId, actorUserId: actorId, oldStatus: "NEW", newStatus: "OPEN" } });
    await prisma.$disconnect();
    const saved = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id }, include: { history: true } });
    expect(saved.history[0]).toMatchObject({ actorUserId: actorId, oldState: "PLANNED", newState: "IN_PROGRESS", beforeJson: { version: 1 }, afterJson: { version: 2 } });
    expect(await prisma.ticketStatusHistory.findUnique({ where: { id: event.id } })).toMatchObject({ oldStatus: "NEW", newStatus: "OPEN" });
    await expect(prisma.actionTaken.delete({ where: { id: action.id } })).rejects.toMatchObject({ code: "P2003" });
  });
  it("rolls back Action and history together on transaction failure", async () => {
    const before = await prisma.actionTaken.count();
    await expect(prisma.$transaction(async tx => {
      const action = await tx.actionTaken.create({ data: { ticketId, performedByUserId: actorId, description: "Rollback" } });
      await tx.actionTakenHistory.create({ data: { actionId: action.id, actorUserId: actorId, newState: "PLANNED", afterJson: {} } });
      throw new Error("Injected failure");
    })).rejects.toThrow("Injected failure");
    expect(await prisma.actionTaken.count()).toBe(before);
  });
  it("stores outcomes durably and scopes idempotency uniqueness by actor/Ticket/key", async () => {
    const data = { actorUserId: actorId, ticketId, key: "request-1", payloadHash: "hash", responseJson: { action: { id: 1 } }, responseStatus: 201,
      expiresAt: new Date(Date.now() + 86400000) };
    await prisma.actionIdempotencyKey.create({ data });
    await expect(prisma.actionIdempotencyKey.create({ data: { ...data, payloadHash: "different" } })).rejects.toMatchObject({ code: "P2002" });
    await prisma.actionIdempotencyKey.create({ data: { ...data, actorUserId: assigneeId } });
    const otherTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const { id, ...copy } = otherTicket;
    const second = await prisma.ticket.create({ data: { ...copy, ticketNumber: "LAB4-SECOND" } });
    await prisma.actionIdempotencyKey.create({ data: { ...data, ticketId: second.id } });
    await prisma.$disconnect();
    expect(await prisma.actionIdempotencyKey.findUniqueOrThrow({ where: { actorUserId_ticketId_key: { actorUserId: actorId, ticketId, key: data.key } } })).toMatchObject({ responseStatus: 201, responseJson: data.responseJson });
  });
  it("enforces Action enum values in PostgreSQL", async () => {
    await expect(prisma.$executeRaw`INSERT INTO "ActionTaken" ("ticketId", "performedByUserId", description, state, "updatedAt") VALUES (${ticketId}, ${actorId}, 'Invalid enum', 'UNKNOWN', CURRENT_TIMESTAMP)`).rejects.toThrow();
  });
  it("enforces history and idempotency foreign keys", async () => {
    await expect(prisma.actionTakenHistory.create({ data: { actionId: 2147483647, actorUserId: actorId, newState: "PLANNED", afterJson: {} } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.ticketStatusHistory.create({ data: { ticketId, actorUserId: 2147483647, oldStatus: "NEW", newStatus: "OPEN" } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.actionIdempotencyKey.create({ data: { ticketId: 2147483647, actorUserId: actorId, key: "invalid", payloadHash: "hash", responseJson: {}, responseStatus: 201, expiresAt: new Date() } })).rejects.toMatchObject({ code: "P2003" });
  });
  it("restricts deletion of referenced Tickets, performers and assignees", async () => {
    await expect(prisma.ticket.delete({ where: { id: ticketId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.user.delete({ where: { id: actorId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.user.delete({ where: { id: assigneeId } })).rejects.toMatchObject({ code: "P2003" });
  });
});
