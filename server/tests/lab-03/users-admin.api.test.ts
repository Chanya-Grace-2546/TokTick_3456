import request from "supertest";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import {
  createTicket, createUser, expectSafeUser, origin, password, prisma,
  replacementPassword, sessionFor, useAdminDatabase,
} from "./helpers/adminTestDatabase.js";

vi.mock("../../src/prisma.js", async () => {
  const database = await import("./helpers/adminTestDatabase.js");
  return { getPrisma: () => database.prisma };
});

describe("Issue 7 Administrator User Management — API-26–32/34", () => {
  const fixture = useAdminDatabase();
  const validCreate = () => ({
    name: "New Person", email: "new.person@example.test", role: "REQUESTER",
    isActive: true, initialPassword: password,
  });
  const list = (query = {}) => request(app).get("/api/admin/users").set("Cookie", fixture.adminCookie).query(query);
  const create = (body: object) => request(app).post("/api/admin/users")
    .set("Cookie", fixture.adminCookie).set("Origin", origin).send(body);
  const edit = (id: number, body: object, cookie = fixture.adminCookie) => request(app)
    .patch(`/api/admin/users/${id}`).set("Cookie", cookie).set("Origin", origin).send(body);
  const reset = (id: number, body: object = { initialPassword: replacementPassword, confirmPassword: replacementPassword }) => request(app)
    .post(`/api/admin/users/${id}/initial-password`).set("Cookie", fixture.adminCookie).set("Origin", origin).send(body);

  it("API-26: lists active and inactive users with exactly the safe fields", async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["items"]);
    expect(response.body.items).toHaveLength(5);
    response.body.items.forEach(expectSafeUser);
    expect(response.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.inactive.id, isActive: false }),
      expect.objectContaining({ id: fixture.admin.id, role: "ADMINISTRATOR" }),
    ]));
  });

  it.each(["  ALEX  ", "  REQUESTER@EXAMPLE.TEST  "])("API-26: trims case-insensitive name/email search %s", async search => {
    const response = await list({ search });
    expect(response.status).toBe(200);
    const expected = search.includes("@") ? [fixture.requester.id] : [fixture.staff.id, fixture.requester.id];
    expect(response.body.items.map((u: { id: number }) => u.id).sort()).toEqual(expected.sort());
  });

  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("API-26: supports the single %s filter", async role => {
    const response = await list({ role });
    expect(response.status).toBe(200);
    const expected = await prisma.user.findMany({ where: { role: role as "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" } });
    expect(response.body.items.map((u: { id: number }) => u.id).sort()).toEqual(expected.map(u => u.id).sort());
  });

  it("API-26: combines search and role, including empty results", async () => {
    const response = await list({ search: "alex", role: "IT_STAFF" });
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ id: fixture.staff.id })]);
    const empty = await list({ search: "alex", role: "ADMINISTRATOR" });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ items: [] });
  });

  it.each(["role=UNKNOWN", "role=REQUESTER&role=IT_STAFF", "search[x]=alex"])("API-26: rejects malformed query %s", async query => {
    const response = await request(app).get(`/api/admin/users?${query}`).set("Cookie", fixture.adminCookie);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_QUERY");
  });

  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("API-27: creates normalized safe %s account with hashed initial password", async role => {
    const response = await create({ ...validCreate(), name: "  New Person  ", email: "  NEW.PERSON@EXAMPLE.TEST  ", role });
    expect(response.status).toBe(201);
    expectSafeUser(response.body);
    expect(response.body).toMatchObject({ name: "New Person", email: "new.person@example.test", role, mustChangePassword: true });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(await bcrypt.compare(password, stored.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").send({ email: stored.email, password })).status).toBe(200);
    const blocked = await agent.get("/api/admin/users");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("API-27: permits inactive creation and refuses login", async () => {
    const response = await create({ ...validCreate(), isActive: false });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ isActive: false, mustChangePassword: true });
    expect((await request(app).post("/api/auth/login").send({ email: response.body.email, password })).status).toBe(401);
  });

  it.each(["Ab1!aaaaaa", `Ab1!${"a".repeat(68)}`, " Ab1!aaaa "])("API-27/BR-05: accepts password boundaries and preserves spaces (%s)", async initialPassword => {
    const response = await create({ ...validCreate(), initialPassword });
    expect(response.status).toBe(201);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(await bcrypt.compare(initialPassword, stored.passwordHash)).toBe(true);
    if (initialPassword !== initialPassword.trim()) expect(await bcrypt.compare(initialPassword.trim(), stored.passwordHash)).toBe(false);
  });

  const invalidInputs: [string, unknown][] = [
    ["name", " "], ["name", "A"], ["name", "a".repeat(101)], ["name", 42],
    ["email", "not-an-email"], ["email", `${"a".repeat(243)}@example.test`], ["email", null],
    ["role", "SUPER_ADMIN"], ["role", ["REQUESTER", "IT_STAFF"]], ["isActive", "false"],
    ["initialPassword", "Ab1!aaaaa"], ["initialPassword", `Ab1!${"a".repeat(69)}`],
    ["initialPassword", "lowercase1!"], ["initialPassword", "UPPERCASE1!"],
    ["initialPassword", "NoDigitsHere!"], ["initialPassword", "NoSymbols123"], ["initialPassword", 123],
  ];
  it.each(invalidInputs)("API-28: rejects invalid %s (%j) without creating an account", async (field, value) => {
    const before = await prisma.user.count();
    const response = await create({ ...validCreate(), [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_FAILED");
    expect(response.body.fields[field]).toEqual(expect.any(String));
    expect(await prisma.user.count()).toBe(before);
  });

  it.each(["name", "email", "role", "isActive", "initialPassword"])("API-28: rejects missing create field %s", async field => {
    const body: Record<string, unknown> = validCreate();
    delete body[field];
    const response = await create(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_FAILED");
    expect(await prisma.user.count()).toBe(5);
  });

  it("API-28: rejects case-insensitive duplicate creation", async () => {
    const response = await create({ ...validCreate(), email: ` ${fixture.requester.email.toUpperCase()} ` });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("EMAIL_ALREADY_EXISTS");
    expect(await prisma.user.count()).toBe(5);
  });

  it("API-28: concurrent duplicate creation yields one account and a safe conflict", async () => {
    const responses = await Promise.all([create(validCreate()), create({ ...validCreate(), email: " NEW.PERSON@EXAMPLE.TEST " })]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect(responses.find(r => r.status === 409)?.body.error).toBe("EMAIL_ALREADY_EXISTS");
    expect(await prisma.user.count({ where: { email: validCreate().email } })).toBe(1);
  });

  it("API-29: updates name/email/role/activation, preserving password and identity", async () => {
    const response = await edit(fixture.requester.id, { name: "  Updated Person  ", email: " UPDATED@EXAMPLE.TEST ", role: "IT_STAFF", isActive: false });
    expect(response.status).toBe(200);
    expectSafeUser(response.body);
    expect(response.body).toMatchObject({ id: fixture.requester.id, name: "Updated Person", email: "updated@example.test", role: "IT_STAFF", isActive: false });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: fixture.requester.id } });
    expect(stored.passwordHash).toBe(fixture.requester.passwordHash);
    expect(stored.mustChangePassword).toBe(false);
  });

  it("API-29: partial edit leaves omitted fields intact and allows own unchanged email", async () => {
    const response = await edit(fixture.admin.id, { name: "Renamed Admin", email: " ADMIN@EXAMPLE.TEST " });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: fixture.admin.id, name: "Renamed Admin", email: fixture.admin.email, role: "ADMINISTRATOR", isActive: true, mustChangePassword: false });
  });

  it.each(invalidInputs.filter(([field]) => field !== "initialPassword"))("API-28/29: rejects invalid edit %s (%j) atomically", async (field, value) => {
    const response = await edit(fixture.requester.id, { name: "Must not persist", [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_FAILED");
    expect(await prisma.user.findUnique({ where: { id: fixture.requester.id } })).toEqual(fixture.requester);
  });

  it("API-28/29: duplicate email edit rejects every requested change", async () => {
    const response = await edit(fixture.requester.id, { name: "Must not persist", email: ` ${fixture.staff.email.toUpperCase()} `, isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("EMAIL_ALREADY_EXISTS");
    expect(await prisma.user.findUnique({ where: { id: fixture.requester.id } })).toEqual(fixture.requester);
  });

  it("API-29/BR-47: deactivation invalidates all sessions; reactivation never revives them", async () => {
    const cookies = await Promise.all([sessionFor(fixture.staff), sessionFor(fixture.staff)]);
    expect((await edit(fixture.staff.id, { isActive: false })).status).toBe(200);
    const sessions = await prisma.session.findMany({ where: { userId: fixture.staff.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every(s => s.invalidatedAt !== null)).toBe(true);
    expect((await request(app).post("/api/auth/login").send({ email: fixture.staff.email, password })).status).toBe(401);
    expect((await edit(fixture.staff.id, { isActive: true })).status).toBe(200);
    for (const cookie of cookies) expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: fixture.staff.email, password })).status).toBe(200);
  });

  it.each([false, true])("API-30: self-deactivation takes precedence (another active admin: %s)", async anotherAdmin => {
    if (anotherAdmin) await createUser({ role: "ADMINISTRATOR" });
    const response = await edit(fixture.admin.id, { isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("SELF_DEACTIVATION_FORBIDDEN");
    expect(await prisma.user.findUnique({ where: { id: fixture.admin.id } })).toEqual(fixture.admin);
    expect((await request(app).get("/api/auth/me").set("Cookie", fixture.adminCookie)).status).toBe(200);
  });

  it.each(["REQUESTER", "IT_STAFF"])("API-31: rejects last active admin demotion to %s; inactive admins do not count", async role => {
    const response = await edit(fixture.admin.id, { role });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
    expect(await prisma.user.findUnique({ where: { id: fixture.admin.id } })).toEqual(fixture.admin);
  });

  it("API-31: allows deactivating another admin while an active admin remains", async () => {
    const other = await createUser({ role: "ADMINISTRATOR" });
    const response = await edit(other.id, { isActive: false });
    expect(response.status).toBe(200);
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
  });

  it("API-29/31: permitted self-demotion immediately removes admin API access", async () => {
    await createUser({ role: "ADMINISTRATOR" });
    expect((await edit(fixture.admin.id, { role: "IT_STAFF" })).status).toBe(200);
    const denied = await list();
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("FORBIDDEN");
  });

  it("API-31: simultaneous self-demotions cannot remove both remaining admins", async () => {
    const other = await createUser({ role: "ADMINISTRATOR" });
    const cookie = await sessionFor(other);
    const responses = await Promise.all([
      edit(fixture.admin.id, { role: "IT_STAFF" }), edit(other.id, { role: "IT_STAFF" }, cookie),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(responses.find(r => r.status === 409)?.body.error).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
  });

  it("API-31: concurrent cross-deactivation leaves at least one active admin", async () => {
    const other = await createUser({ role: "ADMINISTRATOR" });
    const cookie = await sessionFor(other);
    const responses = await Promise.all([
      edit(other.id, { isActive: false }), edit(fixture.admin.id, { isActive: false }, cookie),
    ]);
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    const denied = responses.find(r => r.status !== 200)!;
    // Depending on scheduling, the second actor is already inactive, or the
    // transaction detects that its target has become the last active admin.
    expect([401, 409]).toContain(denied.status);
    expect(denied.body.error).toBe(denied.status === 401 ? "UNAUTHENTICATED" : "LAST_ACTIVE_ADMIN_REQUIRED");
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
  });

  it.each(["IT_STAFF", "ADMINISTRATOR"])("API-34: rejects Requester-with-Tickets role change to %s without partial writes", async role => {
    const ticket = await createTicket(fixture.requester.id);
    const response = await edit(fixture.requester.id, { role, name: "Must not persist", isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("USER_HAS_REQUESTER_TICKETS");
    expect(await prisma.user.findUnique({ where: { id: fixture.requester.id } })).toEqual(fixture.requester);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toEqual(ticket);
  });

  it("API-29/34: Requester with Tickets can retain role and edit ordinary fields", async () => {
    const ticket = await createTicket(fixture.requester.id);
    expect((await edit(fixture.requester.id, { role: "REQUESTER", name: "Renamed Requester" })).status).toBe(200);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toEqual(ticket);
  });

  it("BR-46/48: deactivation and owner role changes preserve historical references", async () => {
    const ticket = await createTicket(fixture.requester.id, fixture.staff.id);
    const comment = await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: fixture.staff.id, content: "Public history" } });
    const note = await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: fixture.staff.id, content: "Private history" } });
    expect((await edit(fixture.staff.id, { role: "REQUESTER", isActive: false })).status).toBe(200);
    expect((await edit(fixture.requester.id, { isActive: false })).status).toBe(200);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toEqual(ticket);
    expect(await prisma.publicComment.findUnique({ where: { id: comment.id } })).toEqual(comment);
    expect(await prisma.internalNote.findUnique({ where: { id: note.id } })).toEqual(note);
    expect(await prisma.user.count()).toBe(5);
  });

  it("API-32: reissues password, invalidates every old session, and completes existing mandatory-change flow", async () => {
    const cookies = await Promise.all([sessionFor(fixture.staff), sessionFor(fixture.staff)]);
    const response = await reset(fixture.staff.id);
    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: fixture.staff.id } });
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).not.toBe(fixture.staff.passwordHash);
    expect(await bcrypt.compare(replacementPassword, stored.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
    const sessions = await prisma.session.findMany({ where: { userId: stored.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every(s => s.invalidatedAt !== null)).toBe(true);
    for (const cookie of cookies) expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: stored.email, password })).status).toBe(401);
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: stored.email, password: replacementPassword });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);
    expect((await agent.get("/api/staff/owners")).body.error).toBe("PASSWORD_CHANGE_REQUIRED");
    // Complete the documented mandatory-change flow using the current session.
    expect((await agent.post("/api/auth/change-password").set("Origin", origin)
      .send({ newPassword: "ChangedAgain!789", confirmPassword: "ChangedAgain!789" })).status).toBe(200);
    expect((await agent.get("/api/staff/owners")).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", fixture.adminCookie)).status).toBe(200);
  });

  it("API-32: resetting oneself invalidates the acting admin session too", async () => {
    expect((await reset(fixture.admin.id)).status).toBe(204);
    expect((await list()).status).toBe(401);
  });

  it("API-32: resetting inactive users does not activate them", async () => {
    expect((await reset(fixture.inactive.id)).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: fixture.inactive.id } })).toMatchObject({ isActive: false, mustChangePassword: true });
    expect((await request(app).post("/api/auth/login").send({ email: fixture.inactive.email, password: replacementPassword })).status).toBe(401);
  });

  it.each([
    { initialPassword: replacementPassword, confirmPassword: "Mismatch!789" },
    { initialPassword: replacementPassword },
    ...invalidInputs.filter(([field]) => field === "initialPassword").map(([, value]) => ({ initialPassword: value, confirmPassword: value })),
  ])("API-32: rejects invalid reset %j without hash/session changes", async body => {
    await sessionFor(fixture.staff);
    const sessions = await prisma.session.findMany({ where: { userId: fixture.staff.id } });
    const response = await reset(fixture.staff.id, body);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_FAILED");
    expect(await prisma.user.findUnique({ where: { id: fixture.staff.id } })).toEqual(fixture.staff);
    expect(await prisma.session.findMany({ where: { userId: fixture.staff.id } })).toEqual(sessions);
  });

  it.each(["edit", "reset"])("%s: returns safe NOT_FOUND for a missing User", async operation => {
    const response = operation === "edit" ? await edit(2147483647, { name: "Missing Person" }) : await reset(2147483647);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("AC-31: list database failures do not expose internal details", async () => {
    const spy = vi.spyOn(prisma.user, "findMany").mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAIL"));
    try {
      const response = await list();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "UNEXPECTED_ERROR" });
    } finally { spy.mockRestore(); }
  });
});
