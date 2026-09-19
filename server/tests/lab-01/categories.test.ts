import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { hashSessionToken } from "../../src/auth.js";


// Issue 4 — write this test yourself, using health.test.ts as the pattern.
// Requires the DB to be migrated and seeded first.
// It should assert: GET /api/categories returns 200 and the four seeded
// category names in id order.
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { name: "Reference reader", email: "reference-reader@example.test", passwordHash: "session-only-fixture", role: "REQUESTER", mustChangePassword: false } });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    const res = await request(app).get("/api/categories").set("Cookie", `toktickit_session=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ]);
  });
});
