import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { app } from "../../src/app.js";
import { hashSessionToken } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

describe("API §3 / BR-07 reference-data gate", () => {
  const prisma = getPrisma();
  const cookies: Record<string, string> = {};
  beforeAll(async () => {
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
      for (const mustChangePassword of [false, true]) {
        const key = `${role}-${mustChangePassword}`;
        const user = await prisma.user.create({ data: { name: key, email: `${key}@example.test`, role, mustChangePassword, passwordHash: "session-only-fixture" } });
        const token = randomBytes(32).toString("hex");
        await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
        cookies[key] = `toktickit_session=${token}`;
      }
    }
  });
  for (const endpoint of ["categories", "related-systems"]) {
    it(`${endpoint}: requires authentication`, async () => {
      const response = await request(app).get(`/api/${endpoint}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "UNAUTHENTICATED" });
    });
    it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])(`${endpoint}: gates initial-password %s but permits normal authenticated access`, async role => {
      const blocked = await request(app).get(`/api/${endpoint}`).set("Cookie", cookies[`${role}-true`]);
      expect.soft(blocked.status).toBe(403);
      expect.soft(blocked.body).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });
      const allowed = await request(app).get(`/api/${endpoint}`).set("Cookie", cookies[`${role}-false`]);
      expect(allowed.status).toBe(200);
      expect(allowed.body.length).toBeGreaterThan(0);
    });
  }
  it("related systems exclude inactive rows", async () => {
    const inactive = await prisma.relatedSystem.create({ data: { name: "Retired system", isActive: false } });
    const response = await request(app).get("/api/related-systems").set("Cookie", cookies["REQUESTER-false"]);
    expect(response.status).toBe(200);
    expect(response.body.some((row: { id: number }) => row.id === inactive.id)).toBe(false);
  });

  it("categories return the safe unexpected-error contract", async () => {
    const spy = vi.spyOn(prisma.category, "findMany").mockRejectedValueOnce(new Error("private database failure"));
    try {
      const response = await request(app).get("/api/categories").set("Cookie", cookies["REQUESTER-false"]);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "UNEXPECTED_ERROR" });
    } finally {
      spy.mockRestore();
    }
  });

});
