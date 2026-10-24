import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { verifiedSqlObject } from "../helpers/databaseSafety.mjs";
import { actionTicket, actionUser, origin, prisma } from "./helpers/actionsTestDatabase.js";

type Person = Awaited<ReturnType<typeof actionUser>>;
let staff: Person, admin: Person, requester: Person, other: Person, inactive: Person, initial: Person;
let ticket: Awaited<ReturnType<typeof actionTicket>>;
const url = () => `/api/tickets/${ticket.id}/actions`;
function read(person = staff, path = url()) { return request(app).get(path).set("Cookie", person.cookie); }
function post(body: unknown, person = staff, path = url(), key?: string) {
  const req = request(app).post(path).set("Cookie", person.cookie).set("Origin", origin);
  if (key !== undefined) req.set("Idempotency-Key", key);
  return req.send(body as object);
}
function patch(id: number, body: unknown, person = staff, path = `${url()}/${id}`) {
  return request(app).patch(path).set("Cookie", person.cookie).set("Origin", origin).send(body as object);
}
async function created(data = {}) {
  const res = await post({ description: "Checked router", ...data });
  expect(res.status).toBe(201);
  return res.body.action;
}
async function counts() {
  return { actions: await prisma.actionTaken.count({ where: { ticketId: ticket.id } }),
    history: await prisma.actionTakenHistory.count({ where: { action: { ticketId: ticket.id } } }),
    keys: await prisma.actionIdempotencyKey.count({ where: { ticketId: ticket.id } }) };
}
beforeAll(async () => {
  staff = await actionUser("IT_STAFF"); admin = await actionUser("ADMINISTRATOR");
  requester = await actionUser("REQUESTER"); other = await actionUser("REQUESTER");
  inactive = await actionUser("IT_STAFF", { isActive: false });
  initial = await actionUser("IT_STAFF", { mustChangePassword: true });
});
beforeEach(async () => { ticket = await actionTicket(requester.user.id, admin.user.id); });

describe("Action API: creation, visibility and audit (API-01/02/04, AUTH-01/03)", () => {
  it("creates as another staff-owned Ticket contributor without changing the Ticket", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const action = await created({ assignedToUserId: admin.user.id, attachmentNotes: "See photo" });
    expect(action).toMatchObject({ ticketId: ticket.id, state: "PLANNED", version: 1, result: null,
      performedBy: { id: staff.user.id, name: staff.user.name }, assignedTo: { id: admin.user.id, name: admin.user.name } });
    expect(Object.keys(action).sort()).toEqual(["id", "ticketId", "actionAt", "description", "result", "performedBy", "assignedTo", "followUpRequired", "followUpNote", "attachmentNotes", "state", "version", "createdAt", "updatedAt"].sort());
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(before);
    const history = await prisma.actionTakenHistory.findMany({ where: { actionId: action.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ actorUserId: staff.user.id, oldState: null, newState: "PLANNED", beforeJson: null,
      afterJson: { performedByUserId: staff.user.id, version: 1 } });
  });
  it("allows Admin creation/update and owner-independent staff assignment", async () => {
    const res = await post({ description: "Admin work", assignedToUserId: staff.user.id }, admin);
    expect(res.status).toBe(201);
    expect((await patch(res.body.action.id, { version: 1, description: "Edited by staff", assignedToUserId: null })).status).toBe(200);
    const edited = await patch(res.body.action.id, { version: 2, state: "IN_PROGRESS" }, admin);
    expect(edited.status).toBe(200);
    expect(edited.body.action.performedBy.id).toBe(admin.user.id);
  });
  it("lists all approved fields to the owner, denies another requester and mismatched Ticket", async () => {
    const action = await created({ result: "Observed", followUpRequired: true, followUpNote: "Tomorrow", attachmentNotes: "Photo" });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.user.id, content: "PRIVATE-NOTE" } });
    const res = await read(requester);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [action], page: 1, pageSize: 20, total: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|PRIVATE-NOTE|tokenHash/);
    expect((await read(other)).status).toBe(404);
    expect((await read(requester, "/api/tickets/2147483647/actions")).body).toEqual({ error: "NOT_FOUND" });
    const different = await actionTicket(other.user.id);
    expect((await patch(action.id, { version: 1 }, staff, `/api/tickets/${different.id}/actions/${action.id}`)).status).toBe(404);
  });
  it("returns an empty page for a legacy Ticket with zero Actions", async () => {
    expect((await read()).body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });
  it("API-11 uses stable time/ID ordering, pagination, and total", async () => {
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await created({ actionAt: "2026-10-22T10:00:00Z" })).id);
    const page = await read(staff, `${url()}?page=2&pageSize=2`);
    expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page.body.items.map((a: { id: number }) => a.id)).toEqual([ids[2]]);
  });
});

describe("Authentication and validation (API-03/13/15, ACTION-ASSIGN-01)", () => {
  it("returns 401 on all three unauthenticated endpoints", async () => {
    for (const req of [request(app).get(url()), request(app).post(url()).send({ description: "x" }), request(app).patch(`${url()}/1`).send({ version: 1 })]) {
      const res = await req;
      expect(res.status).toBe(401); expect(res.body).toEqual({ error: "UNAUTHENTICATED" });
    }
  });
  it("returns 403 for Requester writes and initial-password sessions", async () => {
    expect((await post({ description: "x" }, requester)).status).toBe(403);
    expect((await patch(1, { version: 1 }, requester)).status).toBe(403);
    expect((await read(initial)).body).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });
    expect((await post({ description: "x" }, initial)).status).toBe(403);
  });
  it("rejects inactive, expired and invalidated sessions", async () => {
    expect((await read(inactive)).status).toBe(401);
    for (const data of [{ expiresAt: new Date(0) }, { invalidatedAt: new Date() }]) {
      const person = await actionUser("IT_STAFF");
      await prisma.session.update({ where: { id: person.session.id }, data });
      expect((await read(person)).status).toBe(401);
    }
  });
  it("requires the configured Origin for writes", async () => {
    for (const headers of [{}, { Origin: "https://untrusted.test" }]) {
      const res = await request(app).post(url()).set("Cookie", staff.cookie).set(headers).send({ description: "x" });
      expect(res.status).toBe(403); expect(res.body).toEqual({ error: "INVALID_ORIGIN" });
    }
  });
  it.each([{ description: " " }, {}, { description: "x", state: "OPEN" }, { description: "x", followUpRequired: true },
    { description: "x", state: "COMPLETED" }, { description: "x", actionAt: "2026-02-30T00:00:00Z" },
    { description: "x", result: "x".repeat(2001) }, { description: "x", ticketId: 1 },
    { description: "x", performedByUserId: 1 }, { description: "x", createdAt: "2026-01-01" },
  ])("rejects invalid/protected creation fields %j", async data => {
    const res = await post(data); expect(res.status).toBe(422); expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(await counts()).toEqual({ actions: 0, history: 0, keys: 0 });
  });
  it("returns safe JSON for malformed request JSON", async () => {
    const res = await request(app).post(url()).set("Cookie", staff.cookie).set("Origin", origin).set("Content-Type", "application/json").send('{"description":');
    expect(res.status).toBe(400); expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/stack|SyntaxError/);
  });
  it("rejects invalid IDs and pagination", async () => {
    for (const path of ["/api/tickets/abc/actions", "/api/tickets/2147483648/actions"]) expect((await read(staff, path)).status).toBe(400);
    expect((await patch(1, { version: 1 }, staff, `${url()}/abc`)).status).toBe(400);
    for (const query of ["page=0", "page=1&page=2", "unknown=x", "pageSize=2147483648"]) expect((await read(staff, `${url()}?${query}`)).status).toBe(400);
  });
  it("rejects missing/ineligible/inactive assignees", async () => {
    for (const id of [2147483647, requester.user.id]) {
      const res = await post({ description: "x", assignedToUserId: id });
      expect(res.status).toBe(422); expect(res.body.fields.assignedToUserId).toBeDefined();
    }
    expect((await post({ description: "x", assignedToUserId: inactive.user.id })).body.error).toBe("INACTIVE_ASSIGNEE");
    const action = await created();
    expect((await patch(action.id, { version: 1, assignedToUserId: inactive.user.id })).body.error).toBe("INACTIVE_ASSIGNEE");
  });
});

describe("Action updates and history (API-04/05, ACTION-STATE-01, CON-01)", () => {
  it("increments version and appends before/after history even for an unchanged state", async () => {
    const action = await created();
    const res = await patch(action.id, { version: 1, state: "PLANNED", description: action.description });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({ state: "PLANNED", version: 2, createdAt: action.createdAt, performedBy: action.performedBy });
    const history = await prisma.actionTakenHistory.findMany({ where: { actionId: action.id }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ oldState: "PLANNED", newState: "PLANNED", actorUserId: staff.user.id,
      beforeJson: { version: 1 }, afterJson: { version: 2 } });
    expect((await patch(action.id, { version: 2 })).body.action.version).toBe(3);
  });
  it("validates merged follow-up, retains cleared values in audit, and supports clear-plus-complete", async () => {
    const action = await created({ followUpRequired: true, followUpNote: "Recheck tomorrow" });
    expect((await patch(action.id, { version: 1, followUpNote: null })).status).toBe(422);
    expect((await patch(action.id, { version: 1, state: "COMPLETED" })).status).toBe(422);
    const res = await patch(action.id, { version: 1, state: "COMPLETED", result: "Rechecked", followUpRequired: false, followUpNote: null });
    expect(res.status).toBe(200);
    const history = await prisma.actionTakenHistory.findFirstOrThrow({ where: { actionId: action.id, oldState: "PLANNED" } });
    expect(history.beforeJson).toMatchObject({ followUpNote: "Recheck tomorrow" });
    expect(history.afterJson).toMatchObject({ followUpRequired: false, followUpNote: null, state: "COMPLETED" });
  });
  it("does not add an AC-36 completion restriction or change Ticket lifecycle", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const direct = await created({ state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Later check" });
    expect(direct.followUpRequired).toBe(true);
    const action = await created({ followUpRequired: true, followUpNote: "Later check" });
    expect((await patch(action.id, { version: 1, state: "COMPLETED", result: "Done" })).status).toBe(200);
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(before);
    expect(await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
  it.each(["COMPLETED", "CANCELLED"])("retains and rejects all edits to terminal %s Actions", async state => {
    const action = await created({ state, result: state === "COMPLETED" ? "Done" : null });
    const before = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    for (const data of [{ description: "changed" }, { state: "PLANNED" }, { state }, {}]) {
      const res = await patch(action.id, { version: 1, ...data }, admin);
      expect(res.status).toBe(422); expect(res.body.error).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).toEqual(before);
    expect(await prisma.actionTakenHistory.count({ where: { actionId: action.id } })).toBe(1);
  });
  it("rejects backward transitions, protected fields and missing versions", async () => {
    const action = await created({ state: "IN_PROGRESS" });
    for (const body of [{ version: 1, state: "PLANNED" }, { version: 1, performedByUserId: admin.user.id },
      { version: 1, ticketId: ticket.id }, { description: "changed" }, { version: "1" }]) {
      expect((await patch(action.id, body)).status).toBe(422);
    }
    expect((await patch(action.id, { version: 1, state: "CANCELLED" })).status).toBe(200);
  });
  it("returns 409 for stale writes without modifying state or history", async () => {
    const action = await created();
    expect((await patch(action.id, { version: 1, state: "IN_PROGRESS" })).status).toBe(200);
    const before = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    const stale = await patch(action.id, { version: 1, description: "stale" });
    expect(stale.status).toBe(409); expect(stale.body).toEqual({ error: "STALE_UPDATE" });
    expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).toEqual(before);
    expect(await prisma.actionTakenHistory.count({ where: { actionId: action.id } })).toBe(2);
  });
  it("allows exactly one simultaneous write using the same version", async () => {
    const action = await created();
    const results = await Promise.all([patch(action.id, { version: 1, description: "A" }), patch(action.id, { version: 1, description: "B" }, admin)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const saved = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(saved.version).toBe(2);
    expect(saved.description).toBe(results.find(r => r.status === 200)!.body.action.description);
    expect(await prisma.actionTakenHistory.count({ where: { actionId: action.id } })).toBe(2);
  });
});

describe("Transactional durable idempotency (API-10/17, ACTION-AUDIT-01)", () => {
  it("replays saved status/body across reconnect and subsequent Action/assignee changes", async () => {
    const key = randomUUID(); const person = await actionUser("IT_STAFF");
    const data = { description: "Idempotent action", assignedToUserId: person.user.id };
    const first = await post(data, staff, url(), key);
    expect(first.status).toBe(201);
    await patch(first.body.action.id, { version: 1, description: "Later edit" });
    await prisma.user.update({ where: { id: person.user.id }, data: { isActive: false } });
    await prisma.$disconnect();
    const replay = await post({ assignedToUserId: person.user.id, description: data.description }, staff, url(), key);
    expect(replay.status).toBe(201); expect(replay.body).toEqual(first.body);
    expect(await counts()).toEqual({ actions: 1, history: 2, keys: 1 });
    const saved = await prisma.actionIdempotencyKey.findFirstOrThrow({ where: { ticketId: ticket.id, key } });
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBe(86400000);
  });
  it("rejects a reused active key with different body without changing its saved outcome", async () => {
    const key = randomUUID(); await post({ description: "First" }, staff, url(), key);
    const before = await prisma.actionIdempotencyKey.findFirstOrThrow({ where: { ticketId: ticket.id, key } });
    const res = await post({ description: "Different" }, staff, url(), key);
    expect(res.status).toBe(409); expect(res.body).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
    expect(await counts()).toEqual({ actions: 1, history: 1, keys: 1 });
    expect(await prisma.actionIdempotencyKey.findUnique({ where: { id: before.id } })).toEqual(before);
  });
  it("rejects expired keys for both matching and mismatched payloads, preserving the expired row", async () => {
    const key = randomUUID(); await post({ description: "First" }, staff, url(), key);
    const saved = await prisma.actionIdempotencyKey.findFirstOrThrow({ where: { ticketId: ticket.id, key } });
    const expired = await prisma.actionIdempotencyKey.update({ where: { id: saved.id }, data: { expiresAt: new Date(0) } });
    for (const description of ["First", "Different"]) {
      const res = await post({ description }, staff, url(), key);
      expect(res.status).toBe(409); expect(res.body).toEqual({ error: "IDEMPOTENCY_KEY_EXPIRED" });
    }
    expect(await prisma.actionIdempotencyKey.findUnique({ where: { id: saved.id } })).toEqual(expired);
    expect(await counts()).toEqual({ actions: 1, history: 1, keys: 1 });
  });
  it("allows a new key, independently scoped actor/Ticket keys, and unkeyed operations", async () => {
    const key = randomUUID();
    expect((await post({ description: "x" }, staff, url(), key)).status).toBe(201);
    expect((await post({ description: "x" }, admin, url(), key)).status).toBe(201);
    const otherTicket = await actionTicket(requester.user.id);
    expect((await post({ description: "x" }, staff, `/api/tickets/${otherTicket.id}/actions`, key)).status).toBe(201);
    expect((await post({ description: "x" }, staff, url(), randomUUID())).status).toBe(201);
    await created(); await created();
    expect(await counts()).toEqual({ actions: 5, history: 5, keys: 3 });
  });
  it("serializes simultaneous identical keys into one creation and exact replays", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => post({ description: "Concurrent retry" }, staff, url(), key)));
    expect(results.map(r => r.status)).toEqual([201, 201, 201, 201, 201]);
    for (const res of results) expect(res.body).toEqual(results[0].body);
    expect(await counts()).toEqual({ actions: 1, history: 1, keys: 1 });
  });
  it("serializes simultaneous different bodies for one key into success/conflict", async () => {
    const key = randomUUID();
    const results = await Promise.all([post({ description: "A" }, staff, url(), key), post({ description: "B" }, staff, url(), key)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await counts()).toEqual({ actions: 1, history: 1, keys: 1 });
  });
  it("rolls back creation/update when audit persistence fails, then permits retry", async () => {
    const action = await created(); const key = randomUUID();
    const before = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${await verifiedSqlObject(prisma, "fail_action_audit")}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected audit failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_action_audit BEFORE INSERT ON ${await verifiedSqlObject(prisma, "ActionTakenHistory")} FOR EACH ROW EXECUTE FUNCTION ${await verifiedSqlObject(prisma, "fail_action_audit")}()`);
    try {
      const res = await post({ description: "Rollback me" }, staff, url(), key);
      expect(res.status).toBe(500); expect(res.body).toEqual({ error: "UNEXPECTED_ERROR" });
      expect((await patch(action.id, { version: 1, description: "Rollback update" })).status).toBe(500);
      expect(await counts()).toEqual({ actions: 1, history: 1, keys: 0 });
      expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).toEqual(before);
      expect(logged).toHaveBeenCalledWith("Actions Taken operation failed.");
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER fail_action_audit ON ${await verifiedSqlObject(prisma, "ActionTakenHistory")}`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${await verifiedSqlObject(prisma, "fail_action_audit")}()`);
      logged.mockRestore();
    }
    expect((await post({ description: "Rollback me" }, staff, url(), key)).status).toBe(201);
    expect(await counts()).toEqual({ actions: 2, history: 2, keys: 1 });
  });
  it("rolls back Action and audit when saving an idempotency outcome fails", async () => {
    const key = randomUUID(); const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${await verifiedSqlObject(prisma, "fail_action_outcome")}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected outcome failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_action_outcome BEFORE INSERT ON ${await verifiedSqlObject(prisma, "ActionIdempotencyKey")} FOR EACH ROW EXECUTE FUNCTION ${await verifiedSqlObject(prisma, "fail_action_outcome")}()`);
    try {
      expect((await post({ description: "Rollback all" }, staff, url(), key)).status).toBe(500);
      expect(await counts()).toEqual({ actions: 0, history: 0, keys: 0 });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER fail_action_outcome ON ${await verifiedSqlObject(prisma, "ActionIdempotencyKey")}`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${await verifiedSqlObject(prisma, "fail_action_outcome")}()`);
      logged.mockRestore();
    }
  });
  it("does not expose undocumented detail/history or deletion endpoints", async () => {
    const action = await created();
    expect((await read(staff, `${url()}/${action.id}`)).status).toBe(404);
    expect((await read(staff, `${url()}/${action.id}/history`)).status).toBe(404);
    expect((await request(app).delete(`${url()}/${action.id}`).set("Cookie", staff.cookie).set("Origin", origin)).status).toBe(404);
    expect(await prisma.actionTakenHistory.count({ where: { actionId: action.id } })).toBe(1);
  });
});
