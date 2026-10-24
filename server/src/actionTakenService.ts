import { createHash } from "node:crypto";
import { ActionTaken, Prisma } from "@prisma/client";
import { AuthenticatedRequest, AuthUser } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { canUpdateActionState, isTerminalAction } from "./actionStateTransitions.js";
import { ActionError, ActionFields, validateActionResult, idempotencyExpired } from "./validateActionTaken.js";

const people = {
  performedBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.ActionTakenInclude;
type ActionRecord = Prisma.ActionTakenGetPayload<{ include: typeof people }>;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

function snapshot(action: ActionTaken) {
  // Scalar fields only; no User/session data is ever copied into audit JSON.
  return json({ id: action.id, ticketId: action.ticketId, performedByUserId: action.performedByUserId,
    assignedToUserId: action.assignedToUserId, actionAt: action.actionAt, description: action.description,
    result: action.result, followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes, state: action.state, version: action.version,
    createdAt: action.createdAt, updatedAt: action.updatedAt });
}

function resource(action: ActionRecord) {
  return { id: action.id, ticketId: action.ticketId, actionAt: action.actionAt,
    description: action.description, result: action.result, performedBy: action.performedBy,
    assignedTo: action.assignedTo, followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
    state: action.state, version: action.version, createdAt: action.createdAt, updatedAt: action.updatedAt };
}

async function visibleTicket(tx: Prisma.TransactionClient, ticketId: number, actor: Pick<AuthUser, "id" | "role">) {
  const ticket = await tx.ticket.findFirst({ where: { id: ticketId,
    ...(actor.role === "REQUESTER" ? { requesterId: actor.id } : {}) }, select: { id: true } });
  if (!ticket) throw new ActionError(404, "NOT_FOUND");
}

async function writer(tx: Prisma.TransactionClient, req: AuthenticatedRequest) {
  // Hold session and actor rows stable through the mutation, including after
  // waiting for another idempotent request. Existing auth middleware still runs first.
  await tx.$queryRaw`SELECT id FROM "Session" WHERE id=${req.sessionId!} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.authUser!.id} FOR SHARE`;
  const session = await tx.session.findUnique({ where: { id: req.sessionId! }, include: { user: true } });
  if (!session || session.userId !== req.authUser!.id || session.invalidatedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    throw new ActionError(401, "UNAUTHENTICATED");
  }
  if (session.user.mustChangePassword) throw new ActionError(403, "PASSWORD_CHANGE_REQUIRED");
  if (session.user.role !== "IT_STAFF" && session.user.role !== "ADMINISTRATOR") throw new ActionError(403, "FORBIDDEN");
  return session.user;
}

async function assignee(tx: Prisma.TransactionClient, userId: number | null | undefined) {
  if (userId == null) return;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!user || (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR")) {
    throw new ActionError(422, "VALIDATION_ERROR", { assignedToUserId: "Choose an eligible IT Staff or Administrator." });
  }
  if (!user.isActive) throw new ActionError(422, "INACTIVE_ASSIGNEE", { assignedToUserId: "Choose an active assignee." });
}

async function mutation<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrisma().$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      // Retry the whole transaction, never an isolated write after a rollback.
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 3) continue;
      throw error;
    }
  }
}

export async function listActions(actor: AuthUser, ticketId: number, page: number, pageSize: number, skip: number) {
  return getPrisma().$transaction(async tx => {
    await visibleTicket(tx, ticketId, actor);
    const total = await tx.actionTaken.count({ where: { ticketId } });
    const actions = await tx.actionTaken.findMany({ where: { ticketId }, include: people,
      orderBy: [{ actionAt: "asc" }, { id: "asc" }], skip, take: pageSize });
    return { items: actions.map(resource), page, pageSize, total };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function createAction(req: AuthenticatedRequest, ticketId: number, data: ActionFields, key: string | undefined, payloadHash: string) {
  return mutation(async tx => {
    if (key !== undefined) {
      // A signed 64-bit hash is only a lock identity. Full actor/Ticket/key
      // values remain the database identity; hash collisions only serialize work.
      const lock = createHash("sha256").update(JSON.stringify([req.authUser!.id, ticketId, key])).digest().readBigInt64BE();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
    }
    const actor = await writer(tx, req);
    await visibleTicket(tx, ticketId, actor);
    if (key !== undefined) {
      // READ COMMITTED sees the prior holder's committed outcome after waiting.
      const existing = await tx.actionIdempotencyKey.findUnique({ where: {
        actorUserId_ticketId_key: { actorUserId: actor.id, ticketId, key },
      } });
      if (existing) {
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
        if (idempotencyExpired(now, existing.expiresAt)) throw new ActionError(409, "IDEMPOTENCY_KEY_EXPIRED");
        if (payloadHash !== existing.payloadHash) throw new ActionError(409, "IDEMPOTENCY_CONFLICT");
        return { status: existing.responseStatus, body: existing.responseJson };
      }
    }
    const values = { state: data.state ?? "PLANNED", result: data.result ?? null,
      followUpRequired: data.followUpRequired ?? false, followUpNote: data.followUpNote ?? null } as const;
    validateActionResult(values);
    await assignee(tx, data.assignedToUserId);
    const action = await tx.actionTaken.create({ data: { ...data, description: data.description!, ticketId, performedByUserId: actor.id }, include: people });
    await tx.actionTakenHistory.create({ data: { actionId: action.id, actorUserId: actor.id,
      newState: action.state, afterJson: snapshot(action) } });
    const body = json({ action: resource(action) });
    if (key !== undefined) {
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      await tx.actionIdempotencyKey.create({ data: { actorUserId: actor.id, ticketId, key, payloadHash,
        responseStatus: 201, responseJson: body, createdAt: now, expiresAt: new Date(now.getTime() + 86400000) } });
    }
    return { status: 201, body };
  });
}

export async function updateAction(req: AuthenticatedRequest, ticketId: number, actionId: number, data: ActionFields, version: number) {
  return mutation(async tx => {
    const actor = await writer(tx, req);
    await visibleTicket(tx, ticketId, actor);
    const before = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId } });
    if (!before) throw new ActionError(404, "NOT_FOUND");
    if (before.version !== version) throw new ActionError(409, "STALE_UPDATE");
    if (isTerminalAction(before.state)) throw new ActionError(422, "VALIDATION_ERROR", { state: "Completed and Cancelled Actions are read-only." });
    const merged = { ...before, ...data };
    if (!canUpdateActionState(before.state, merged.state)) throw new ActionError(422, "VALIDATION_ERROR", { state: "Action state transition is not allowed." });
    validateActionResult(merged);
    await assignee(tx, merged.assignedToUserId);
    const updated = await tx.actionTaken.updateMany({ where: { id: actionId, ticketId, version,
      state: { in: ["PLANNED", "IN_PROGRESS"] } }, data: { ...data, version: { increment: 1 } } });
    if (!updated.count) throw new ActionError(409, "STALE_UPDATE");
    const after = await tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, include: people });
    await tx.actionTakenHistory.create({ data: { actionId, actorUserId: actor.id,
      oldState: before.state, newState: after.state, beforeJson: snapshot(before), afterJson: snapshot(after) } });
    return { action: resource(after) };
  });
}
