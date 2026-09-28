import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { app } from "../../src/app.js";
import { hashSessionToken } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const routes = [
  ["get", "/api/tickets/:id", "REQUESTER"],
  ["get", "/api/tickets/:id/attachments", "REQUESTER"],
  ["post", "/api/tickets/:id/attachments", "REQUESTER"],
  ["post", "/api/tickets/:id/problem-appears-resolved", "REQUESTER"],
  ["get", "/api/tickets/:id/comments", "REQUESTER"],
  ["post", "/api/tickets/:id/comments", "REQUESTER"],
  ["get", "/api/tickets/:id/internal-notes", "IT_STAFF"],
  ["post", "/api/tickets/:id/internal-notes", "IT_STAFF"],
  ["get", "/api/staff/tickets/:id", "IT_STAFF"],
  ["post", "/api/staff/tickets/:id/claim", "IT_STAFF"],
  ["patch", "/api/staff/tickets/:id/owner", "IT_STAFF"],
  ["patch", "/api/staff/tickets/:id/it-priority", "IT_STAFF"],
  ["patch", "/api/staff/tickets/:id/status", "IT_STAFF"],
] as const;

describe("Ticket route ID validation", () => {
  const cookies: Record<string, string> = {};
  beforeAll(async () => {
    const prisma = getPrisma();
    for (const role of ["REQUESTER", "IT_STAFF"] as const) {
      const user = await prisma.user.create({ data: { name: role, email: `${role}@ids.test`, role, mustChangePassword: false, passwordHash: "session-only" } });
      const token = randomBytes(32).toString("hex");
      await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 300_000) } });
      cookies[role] = `toktickit_session=${token}`;
    }
  });
  for (const [method, route, role] of routes) {
    it.each(["1.5", "0", "-1", "abc", "99999999999", "2147483648", "1e0", "+1", " 1", "0x1"])(`${method} ${route} rejects %s`, async id => {
      const response = await request(app)[method](route.replace(":id", encodeURIComponent(id)))
        .set("Cookie", cookies[role]).set("Origin", "http://localhost:5173")
        .send({ content: "Valid content", ownerId: null, itPriority: "HIGH", status: "OPEN" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "INVALID_TICKET_ID" });
    });
  }
  for (const [method, route] of [
    ["get", "/api/attachments/:id/download"],
    ["patch", "/api/attachments/:id/remove"],
  ] as const) {
    it.each(["1.5", "abc", "-1", "0", "2147483648"])(`${method} ${route} rejects %s`, async id => {
      const response = await request(app)[method](route.replace(":id", encodeURIComponent(id)))
        .set("Cookie", cookies.REQUESTER).set("Origin", "http://localhost:5173")
        .send({ reason: "Valid removal reason" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "INVALID_ATTACHMENT_ID" });
    });
  }
  it.each(["1", "0001", "2147483647"])("accepts decimal in-range ID %s for lookup", async id => {
    const response = await request(app).get(`/api/tickets/${id}`).set("Cookie", cookies.REQUESTER);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "NOT_FOUND" });
  });
});
