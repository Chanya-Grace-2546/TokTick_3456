import { beforeEach, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../src/auth.js";
import { createAction, updateAction } from "../../src/actionTakenService.js";
const db = vi.hoisted(() => ({ tx: undefined as any }));
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => ({ $transaction: (work: (tx: any) => unknown) => work(db.tx) }) }));
const actor = { id: 7, name: "Administrator", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false };
const req = { authUser: actor, sessionId: 1 } as unknown as AuthenticatedRequest;
const saved = { id: 31, ticketId: 42, performedByUserId: 7, assignedToUserId: 8, description: "Original", result: null,
  actionAt: new Date(), createdAt: new Date(), updatedAt: new Date(), state: "PLANNED", version: 1,
  followUpRequired: false, followUpNote: null, attachmentNotes: null, performedBy: { id: 7, name: actor.name }, assignedTo: { id: 8, name: "Staff" } };
beforeEach(() => {
  db.tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 42, status: "OPEN" }]),
    session: { findUnique: vi.fn().mockResolvedValue({ userId: 7, user: actor, expiresAt: new Date(Date.now() + 60000) }) },
    ticket: { findFirst: vi.fn().mockResolvedValue({ id: 42 }) },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "IT_STAFF", isActive: true }) },
    actionTaken: { create: vi.fn().mockResolvedValue(saved), findFirst: vi.fn().mockResolvedValue(saved), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...saved, version: 2 }) },
    actionTakenHistory: { create: vi.fn().mockResolvedValue({}) },
  };
});
for (const operation of ["create", "update"] as const) {
  const write = (assignedToUserId: number | null) => operation === "create"
    ? createAction(req, 42, { description: "Work", assignedToUserId }, undefined, "unused")
    : updateAction(req, 42, 31, { assignedToUserId }, 1);
  it.each(["ADMINISTRATOR", "REQUESTER"])(`${operation} rejects %s before persisting Action or audit`, async role => {
    db.tx.user.findUnique.mockResolvedValue({ role, isActive: true });
    await expect(write(8)).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR", fields: { assignedToUserId: "Choose an active IT Staff member or Unassigned." } });
    expect(db.tx.actionTaken.create).not.toHaveBeenCalled(); expect(db.tx.actionTaken.updateMany).not.toHaveBeenCalled(); expect(db.tx.actionTakenHistory.create).not.toHaveBeenCalled();
  });
  it(`${operation} rejects inactive IT Staff with the existing error`, async () => {
    db.tx.user.findUnique.mockResolvedValue({ role: "IT_STAFF", isActive: false });
    await expect(write(8)).rejects.toMatchObject({ status: 422, code: "INACTIVE_ASSIGNEE" });
    expect(db.tx.actionTakenHistory.create).not.toHaveBeenCalled();
  });
  it.each([8, null])(`${operation} allows Admin actor assigning active Staff or null (%s)`, async id => {
    await write(id); expect(db.tx.actionTakenHistory.create).toHaveBeenCalledOnce();
    const data = (operation === "create" ? db.tx.actionTaken.create : db.tx.actionTaken.updateMany).mock.calls[0][0].data;
    expect(data.assignedToUserId).toBe(id);
    if (id === null) expect(db.tx.user.findUnique).not.toHaveBeenCalled();
  });
}
it("rejects edits retaining a legacy Administrator assignment without changing history", async () => {
  db.tx.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR", isActive: true });
  await expect(updateAction(req, 42, 31, { description: "New draft" }, 1)).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  expect(db.tx.actionTaken.updateMany).not.toHaveBeenCalled(); expect(db.tx.actionTakenHistory.create).not.toHaveBeenCalled();
});
