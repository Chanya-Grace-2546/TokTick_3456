import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { verifiedSqlObject } from "../helpers/databaseSafety.mjs";
import { app } from "../../src/app.js";
import { actionTicket, actionUser, origin, prisma } from "./helpers/actionsTestDatabase.js";
let staff: Awaited<ReturnType<typeof actionUser>>, requester: typeof staff;
let ticket: Awaited<ReturnType<typeof actionTicket>>;
beforeAll(async () => { staff = await actionUser("IT_STAFF"); requester = await actionUser("REQUESTER"); });
beforeEach(async () => { ticket = await actionTicket(requester.user.id); await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }); });
const actions = () => `/api/tickets/${ticket.id}/actions`;
const status = (value: string, expectedStatus?: string, actor = staff) => request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Cookie", actor.cookie).set("Origin", origin).send({ status: value, ...(expectedStatus ? { expectedStatus } : {}) });
const create = (data = {}, key?: string) => { const req = request(app).post(actions()).set("Cookie", staff.cookie).set("Origin", origin); if (key) req.set("Idempotency-Key", key); return req.send({ description: "Work", ...data }); };
const satisfy = (id: number, outcome = "Verified service restored", actor = staff) => request(app).post(`${actions()}/${id}/follow-up-resolution`).set("Cookie", actor.cookie).set("Origin", origin).send({ version: 1, outcome });
it("preserves the flat legacy response and records Ticket history", async () => {
  const res = await status("RESOLVED"); expect(res.status).toBe(200); expect(res.body).toEqual({ id: ticket.id, status: "RESOLVED", ownerId: null });
  expect(await prisma.ticketStatusHistory.findMany({ where: { ticketId: ticket.id } })).toMatchObject([{ oldStatus: "OPEN", newStatus: "RESOLVED", actorUserId: staff.user.id }]);
});
it("rejects stale status requests without writes and serializes competing transitions", async () => {
  const results = await Promise.all([status("IN_PROGRESS", "OPEN"), status("WAITING_FOR_REQUESTER", "OPEN")]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect(results.find(r => r.status === 409)?.body.error).toBe("STALE_UPDATE");
  expect(await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } })).toBe(1);
});
it("blocks resolution for unfinished work and outstanding completed follow-up", async () => {
  const action = (await create()).body.action;
  expect((await status("RESOLVED")).status).toBe(422);
  await prisma.actionTaken.update({ where: { id: action.id }, data: { state: "COMPLETED", result: "Fixed", followUpRequired: true, followUpNote: "Verify tomorrow" } });
  expect((await status("RESOLVED")).body.error).toBe("RESOLUTION_BLOCKED");
  expect(await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it("satisfies follow-up through one append-only event without changing the completed row", async () => {
  const id = (await create()).body.action.id;
  const before = await prisma.actionTaken.update({ where: { id }, data: { state: "COMPLETED", result: "Fixed", followUpRequired: true, followUpNote: "Verify" } });
  const results = await Promise.all([satisfy(id), satisfy(id)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 201]);
  expect(await prisma.actionTaken.findUnique({ where: { id } })).toEqual(before);
  expect(await prisma.actionTakenHistory.count({ where: { actionId: id } })).toBe(2);
  expect((await satisfy(id, "Different outcome")).body.error).toBe("FOLLOW_UP_ALREADY_SATISFIED");
  const list = await request(app).get(actions()).set("Cookie", requester.cookie);
  expect(list.body.items[0].followUpResolution).toMatchObject({ outcome: "Verified service restored", actor: { id: staff.user.id } });
  expect((await status("RESOLVED")).status).toBe(200);
});
it("cancels unfinished Actions atomically and retains completed Actions", async () => {
  const planned = (await create()).body.action, completed = (await create()).body.action;
  const terminal = await prisma.actionTaken.update({ where: { id: completed.id }, data: { state: "COMPLETED", result: "Done" } });
  expect((await status("CANCELLED")).status).toBe(200);
  expect(await prisma.actionTaken.findUnique({ where: { id: planned.id } })).toMatchObject({ state: "CANCELLED", version: 2 });
  expect(await prisma.actionTaken.findUnique({ where: { id: completed.id } })).toEqual(terminal);
  expect(await prisma.actionTakenHistory.findMany({ where: { actionId: planned.id }, orderBy: { id: "asc" } })).toMatchObject([{ oldState: null }, { oldState: "PLANNED", newState: "CANCELLED" }]);
});
it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)("rejects new writes on %s while preserving matching creation replay", async state => {
  const original = await create({}, "workflow-replay");
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: state } });
  expect((await create()).body.error).toBe("TICKET_ACTIONS_READ_ONLY");
  expect((await satisfy(original.body.action.id)).body.error).toBe("TICKET_ACTIONS_READ_ONLY");
  expect((await create({}, "workflow-replay")).body).toEqual(original.body);
  expect((await request(app).patch(`${actions()}/${original.body.action.id}`).set("Cookie", staff.cookie).set("Origin", origin).send({ version: 1, description: "Changed" })).body.error).toBe("TICKET_ACTIONS_READ_ONLY");
});
it("reopens a Resolved Ticket and allows Actions again", async () => {
  expect((await status("RESOLVED")).status).toBe(200); expect((await status("REOPENED", "RESOLVED")).status).toBe(200); expect((await create()).status).toBe(201);
});
it("preserves authentication, requester authorization and input validation", async () => {
  expect((await status("RESOLVED", undefined, requester)).status).toBe(403);
  expect((await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED" })).status).toBe(401);
  expect((await status("INVALID")).status).toBe(400);
  const id = (await create()).body.action.id;
  expect((await satisfy(id)).status).toBe(422); expect((await satisfy(id, "outcome", requester)).status).toBe(403);
});

it("rolls back Ticket and automatic cancellation when Ticket history fails", async () => {
  const action = (await create()).body.action;
  const before = await prisma.actionTaken.findUnique({ where: { id: action.id } });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${await verifiedSqlObject(prisma, "fail_workflow_audit")}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_workflow_audit BEFORE INSERT ON ${await verifiedSqlObject(prisma, "TicketStatusHistory")} FOR EACH ROW EXECUTE FUNCTION ${await verifiedSqlObject(prisma, "fail_workflow_audit")}()`);
  try {
    expect((await status("CANCELLED")).status).toBe(500);
    expect(await prisma.actionTaken.findUnique({ where: { id: action.id } })).toEqual(before);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: "OPEN" });
    expect(await prisma.actionTakenHistory.count({ where: { actionId: action.id } })).toBe(1);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER fail_workflow_audit ON ${await verifiedSqlObject(prisma, "TicketStatusHistory")}`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${await verifiedSqlObject(prisma, "fail_workflow_audit")}()`); logged.mockRestore();
  }
});
it("serializes creation against resolution so an unfinished Action never exists on a newly resolved Ticket", async () => {
  const [created, resolved] = await Promise.all([create(), status("RESOLVED")]);
  expect([[201,422],[409,200]]).toContainEqual([created.status,resolved.status]);
  const current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  if (current.status === "RESOLVED") expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it("ignores cancelled follow-up while enforcing immutable completed Action PATCH", async () => {
  const id = (await create()).body.action.id;
  await prisma.actionTaken.update({ where: { id }, data: { state: "CANCELLED", followUpRequired: true, followUpNote: "No longer applicable" } });
  expect((await status("RESOLVED")).status).toBe(200);
});
it("rejects stale satisfaction versions and malformed history events cannot bypass the gate", async () => {
  const id = (await create()).body.action.id;
  await prisma.actionTaken.update({ where: { id }, data: { state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Verify", version: 2 } });
  expect((await satisfy(id)).body.error).toBe("STALE_UPDATE");
  await prisma.actionTakenHistory.create({ data: { actionId: id, actorUserId: staff.user.id, oldState: "COMPLETED", newState: "COMPLETED", afterJson: { id, version: 2, event: { type: "FOLLOW_UP_SATISFIED", schemaVersion: 1, outcome: "Unverified snapshot" } } } });
  expect((await status("RESOLVED")).body.error).toBe("RESOLUTION_BLOCKED");
});
it("serializes different satisfaction outcomes into one event and a conflict", async () => {
  const id = (await create()).body.action.id;
  await prisma.actionTaken.update({ where: { id }, data: { state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Verify" } });
  const results = await Promise.all([satisfy(id, "Confirmed A"), satisfy(id, "Confirmed B")]);
  expect(results.map(r => r.status).sort()).toEqual([201,409]);
  expect(results.find(r => r.status === 409)?.body.error).toBe("FOLLOW_UP_ALREADY_SATISFIED");
  expect(await prisma.actionTakenHistory.count({ where: { actionId: id } })).toBe(2);
});
it("validates follow-up input, enforces Origin and permits an active Administrator", async () => {
  const id = (await create()).body.action.id, path = `${actions()}/${id}/follow-up-resolution`;
  await prisma.actionTaken.update({ where: { id }, data: { state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Verify" } });
  for (const body of [{ version: 1, outcome: " " }, { version: 0, outcome: "Done" }, { version: 1, outcome: "Done", actorUserId: 99 }]) {
    expect((await request(app).post(path).set("Cookie", staff.cookie).set("Origin", origin).send(body)).status).toBe(422);
  }
  expect((await request(app).post(path).set("Cookie", staff.cookie).set("Origin", "https://untrusted.invalid").send({ version: 1, outcome: "Done" })).status).toBe(403);
  const admin = await actionUser("ADMINISTRATOR"); expect((await satisfy(id, "Verified by Admin", admin)).status).toBe(201);
});

// Pause the first transaction after a real Prisma operation while its locks
// remain held. Observe PostgreSQL lock waiting before releasing it: Promise.all
// alone would not prove that the competing request reached the critical section.
let barrier: { model: string; action: string; reached: () => void; release: Promise<void> } | undefined;
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (barrier && params.model === barrier.model && params.action === barrier.action) {
    const current = barrier; barrier = undefined; current.reached(); await current.release;
  }
  return result;
});
async function overlapping(first: () => PromiseLike<request.Response>, second: () => PromiseLike<request.Response>, model: string, action: string, relation = "Ticket", inspectBlocked?: () => Promise<void>) {
  let release!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { reached = resolve; });
  barrier = { model, action, reached, release: new Promise(resolve => { release = resolve; }) };
  const one = Promise.resolve(first()); let two: Promise<request.Response> | undefined;
  try {
    await Promise.race([held, one.then(response => { throw new Error(`First operation returned HTTP ${response.status} before reaching the lock barrier.`); })]);
    two = Promise.resolve(second());
    const deadline = Date.now() + 2500;
    for (;;) {
      const [row] = await prisma.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
        SELECT 1 FROM pg_locks l WHERE l.relation = format('%I.%I',current_schema(),${relation})::regclass
          AND cardinality(pg_blocking_pids(l.pid)) > 0
      ) AS waiting`;
      if (row.waiting) { await inspectBlocked?.(); break; }
      if (Date.now() >= deadline) throw new Error("Competing operation did not wait on the expected schema-local lock.");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    release(); await Promise.allSettled([one, ...(two ? [two] : [])]); throw error;
  } finally { barrier = undefined; release(); }
  return Promise.all([one, two!]);
}
const edit = (id: number, data = {}) => request(app).patch(`${actions()}/${id}`).set("Cookie", staff.cookie).set("Origin", origin).send({ version: 1, description: "Edited work", ...data });
it.each([true,false])("proves overlapping creation/resolution with creation first=%s", async creationFirst => {
  const results = creationFirst
    ? await overlapping(() => create(), () => status("RESOLVED"), "ActionTaken", "create")
    : await overlapping(() => status("RESOLVED"), () => create(), "Ticket", "update");
  expect(results.map(r => r.status)).toEqual(creationFirst ? [201,422] : [200,409]);
  expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: creationFirst ? "OPEN" : "RESOLVED" });
  expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(creationFirst ? 1 : 0);
});
it.each([true,false])("proves overlapping edit/resolution with edit first=%s", async editFirst => {
  const id = (await create()).body.action.id;
  const results = editFirst
    ? await overlapping(() => edit(id, { state: "COMPLETED", result: "Done" }), () => status("RESOLVED"), "ActionTaken", "updateMany")
    : await overlapping(() => status("RESOLVED"), () => edit(id, { state: "COMPLETED", result: "Done" }), "ActionTaken", "findMany");
  expect(results.map(r => r.status)).toEqual(editFirst ? [200,200] : [422,200]);
  expect(await prisma.actionTaken.findUnique({ where: { id } })).toMatchObject({ state: "COMPLETED", version: 2 });
  expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: editFirst ? "RESOLVED" : "OPEN" });
});
it.each([true,false])("proves overlapping edit/cancellation with edit first=%s", async editFirst => {
  const id = (await create({ state: "IN_PROGRESS" })).body.action.id;
  const results = editFirst
    ? await overlapping(() => edit(id), () => status("CANCELLED"), "ActionTaken", "updateMany")
    : await overlapping(() => status("CANCELLED"), () => edit(id), "Ticket", "update");
  expect(results.map(r => r.status)).toEqual(editFirst ? [200,200] : [200,409]);
  expect(await prisma.actionTaken.findUnique({ where: { id } })).toMatchObject({ state: "CANCELLED", version: editFirst ? 3 : 2 });
  expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: "CANCELLED" });
  const audit = await prisma.actionTakenHistory.findFirstOrThrow({ where: { actionId: id, newState: "CANCELLED" } });
  expect(audit.oldState).toBe("IN_PROGRESS"); expect(audit.actorUserId).toBe(staff.user.id);
});
it.each([true,false])("proves overlapping follow-up/resolution with satisfaction first=%s", async satisfactionFirst => {
  const id = (await create({ state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Verify" })).body.action.id;
  const before = await prisma.actionTaken.findUnique({ where: { id } });
  const results = satisfactionFirst
    ? await overlapping(() => satisfy(id), () => status("RESOLVED"), "ActionTakenHistory", "create")
    : await overlapping(() => status("RESOLVED"), () => satisfy(id), "ActionTaken", "findMany");
  expect(results.map(r => r.status)).toEqual(satisfactionFirst ? [201,200] : [422,201]);
  expect(await prisma.actionTaken.findUnique({ where: { id } })).toEqual(before);
  expect(await prisma.actionTakenHistory.count({ where: { actionId: id } })).toBe(2);
  expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: satisfactionFirst ? "RESOLVED" : "OPEN" });
});
it("rolls back cancellation when Action history cannot be written", async () => {
  const id = (await create({ state: "IN_PROGRESS" })).body.action.id;
  const before = await prisma.actionTaken.findUnique({ where: { id } });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${await verifiedSqlObject(prisma, "fail_cancel_action_audit")}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_cancel_action_audit BEFORE INSERT ON ${await verifiedSqlObject(prisma, "ActionTakenHistory")} FOR EACH ROW EXECUTE FUNCTION ${await verifiedSqlObject(prisma, "fail_cancel_action_audit")}()`);
  try {
    expect((await status("CANCELLED")).status).toBe(500);
    expect(await prisma.actionTaken.findUnique({ where: { id } })).toEqual(before);
    expect(await prisma.actionTakenHistory.count({ where: { actionId: id } })).toBe(1);
    expect(await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ status: "OPEN" });
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER fail_cancel_action_audit ON ${await verifiedSqlObject(prisma, "ActionTakenHistory")}`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${await verifiedSqlObject(prisma, "fail_cancel_action_audit")}()`); logged.mockRestore();
  }
});
it.each(["deactivation", "password reset"])("proves User-before-Session ordering when %s holds User first", async operation => {
  const target = await actionUser("IT_STAFF"), admin = await actionUser("ADMINISTRATOR");
  const adminRequest = () => operation === "deactivation"
    ? request(app).patch(`/api/admin/users/${target.user.id}`).set("Cookie", admin.cookie).set("Origin", origin).send({ isActive: false })
    : request(app).post(`/api/admin/users/${target.user.id}/initial-password`).set("Cookie", admin.cookie).set("Origin", origin).send({ initialPassword: "ResetSafe1!", confirmPassword: "ResetSafe1!" });
  const writerRequest = () => request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Cookie", target.cookie).set("Origin", origin).send({ status: "IN_PROGRESS" });
  const results = await overlapping(adminRequest, writerRequest, "User", "update", "User", async () => {
    // A User-blocked writer must not already hold Session FOR SHARE. Otherwise
    // a retry could hide the exact Session/User inversion this test protects.
    const [locks] = await prisma.$queryRaw<{ sessionFirst: boolean }[]>`SELECT EXISTS (
      SELECT 1 FROM pg_locks session_lock JOIN pg_locks user_lock ON user_lock.pid=session_lock.pid
      WHERE session_lock.relation=format('%I.%I',current_schema(),'Session')::regclass
        AND session_lock.mode='RowShareLock'
        AND user_lock.relation=format('%I.%I',current_schema(),'User')::regclass
        AND cardinality(pg_blocking_pids(user_lock.pid)) > 0
    ) AS "sessionFirst"`;
    expect(locks.sessionFirst).toBe(false);
  });
  expect(results.map(r => r.status)).toEqual(operation === "deactivation" ? [200,401] : [204,401]);
  expect(await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it.each(["deactivation", "password reset"])("allows a locked authorized write before %s without deadlock", async operation => {
  const admin = await actionUser("ADMINISTRATOR"), target = await actionUser("IT_STAFF");
  const writerRequest = () => request(app).post(actions()).set("Cookie", target.cookie).set("Origin", origin).send({ description: "Authorized before invalidation" });
  const adminRequest = () => operation === "deactivation"
    ? request(app).patch(`/api/admin/users/${target.user.id}`).set("Cookie", admin.cookie).set("Origin", origin).send({ isActive: false })
    : request(app).post(`/api/admin/users/${target.user.id}/initial-password`).set("Cookie", admin.cookie).set("Origin", origin).send({ initialPassword: "ResetSafe1!", confirmPassword: "ResetSafe1!" });
  const results = await overlapping(writerRequest, adminRequest, "ActionTaken", "create", "User");
  expect(results.map(r => r.status)).toEqual(operation === "deactivation" ? [201,200] : [201,204]);
  expect(await prisma.session.findUnique({ where: { id: target.session.id } })).toMatchObject({ invalidatedAt: expect.any(Date) });
});
