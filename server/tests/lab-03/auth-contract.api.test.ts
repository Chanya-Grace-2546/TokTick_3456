import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Phase 1: assert the approved api-spec §2 without rewriting Issue 3 tests.
describe("Lab 3 exact authentication contract", () => {
  const prisma = getPrisma();
  const password = "ContractStart!123";
  const replacement = "ContractNext!456";
  const origin = "http://localhost:5173";
  let hash: string;
  let user: Awaited<ReturnType<typeof prisma.user.create>>;
  beforeAll(async () => { hash = await bcrypt.hash(password, 12); });
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    user = await prisma.user.create({ data: {
      name: "Contract Requester", email: "contract@example.test", passwordHash: hash,
      role: "REQUESTER", mustChangePassword: true,
    } });
  });
  const identity = () => ({ id: user.id, name: user.name, email: user.email, role: user.role });
  async function login() {
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(response.status).toBe(200);
    return response.headers["set-cookie"][0].split(";")[0];
  }
  const change = (cookie: string, body: object) => request(app).post("/api/auth/change-password")
    .set("Cookie", cookie).set("Origin", origin).send(body);

  it("API-01: login returns exactly safe identity and a top-level mandatory-change flag", async () => {
    const started = Date.now();
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(response.status).toBe(200);
    const token = response.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sessions[0].tokenHash).not.toBe(token);
    expect(sessions[0].expiresAt.getTime()).toBeGreaterThanOrEqual(started + 8 * 60 * 60 * 1000);
    expect(sessions[0].expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 8 * 60 * 60 * 1000);
    expect(response.body).toEqual({ user: identity(), mustChangePassword: true });
  });

  it("API-03: me returns the documented unwrapped safe current User", async () => {
    const response = await request(app).get("/api/auth/me").set("Cookie", await login());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...identity(), mustChangePassword: true });
  });

  it("API-04: logout returns 204, clears the cookie and rejects replay of the original token", async () => {
    const cookie = await login();
    const response = await request(app).post("/api/auth/logout").set("Cookie", cookie).set("Origin", origin);
    expect.soft(response.status).toBe(204);
    expect.soft(response.text).toBe("");
    const clearedCookie = String(response.headers["set-cookie"]);
    expect(clearedCookie).toMatch(/toktickit_session=;/);
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].invalidatedAt).not.toBeNull();
    const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(replay.status).toBe(401);
    expect(replay.body).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("API-05: documented confirmed payload changes the hash and keeps the acting session usable", async () => {
    const cookie = await login();
    const response = await change(cookie, { newPassword: replacement, confirmPassword: replacement });
    expect.soft(response.status).toBe(200);
    expect.soft(response.body).toEqual({ ...identity(), mustChangePassword: false });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect.soft(await bcrypt.compare(replacement, stored.passwordHash)).toBe(true);
    expect.soft(stored.mustChangePassword).toBe(false);
    expect.soft((await request(app).get("/api/tickets").set("Cookie", cookie)).status).toBe(200);
  });

  it.each(["missing", "mismatched"])("API-06: %s confirmation cannot change hash, gate or sessions", async kind => {
    const cookie = await login();
    const sessions = await prisma.session.findMany();
    const response = await change(cookie, { newPassword: replacement,
      ...(kind === "mismatched" ? { confirmPassword: "Different!789" } : {}),
    });
    expect.soft(response.status).toBe(400);
    expect.soft(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(user);
    expect.soft(await prisma.session.findMany()).toEqual(sessions);
  });

  const valid = [
    ["10 characters", "Ab1!aaaaaa"], ["72 characters", `Ab1!${"a".repeat(68)}`],
    ["significant surrounding spaces", " Ab1!aaaa "],
  ];
  it.each(valid)("API-06: accepts %s through the documented password-change payload", async (_label, value) => {
    const cookie = await login();
    const response = await change(cookie, { newPassword: value, confirmPassword: value });
    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(value, stored.passwordHash)).toBe(true);
    if (value !== value.trim()) expect(await bcrypt.compare(value.trim(), stored.passwordHash)).toBe(false);
  });

  it.each([
    ["9 characters", "Ab1!aaaaa"], ["73 characters", `Ab1!${"a".repeat(69)}`],
    ["no uppercase", "lowercase1!"], ["no lowercase", "UPPERCASE1!"],
    ["no digit", "NoDigitsHere!"], ["no special character", "NoSymbols123"],
  ])("API-06: rejects %s without changing hash, gate or sessions", async (_label, value) => {
    const cookie = await login();
    const sessions = await prisma.session.findMany();
    const response = await change(cookie, { newPassword: value, confirmPassword: value });
    expect(response.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(user);
    expect(await prisma.session.findMany()).toEqual(sessions);
  });

  it("API-02: all credential failures have the exact same safe response and create no session", async () => {
    await prisma.user.create({ data: { name: "Inactive", email: "inactive@example.test", passwordHash: hash, isActive: false } });
    for (const credentials of [
      { email: user.email, password: "WrongPassword!123" },
      { email: "missing@example.test", password },
      { email: "inactive@example.test", password },
    ]) {
      const response = await request(app).post("/api/auth/login").send(credentials);
      expect(response.status).toBe(401);
      expect.soft(response.body).toEqual({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect, or the account is unavailable." });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(await prisma.session.count()).toBe(0);
    }
  });

  it("API-02: missing login fields use VALIDATION_FAILED and field messages, with no session", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: user.email });
    expect(response.status).toBe(400);
    expect.soft(response.body.error).toBe("VALIDATION_FAILED");
    expect.soft(response.body.fields?.password).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });
});
