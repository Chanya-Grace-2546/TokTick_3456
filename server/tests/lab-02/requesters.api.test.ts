import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// AC-13, BR-05 — only active Development Requesters are ever returned.
describe("GET /api/requesters", () => {
  let activeId: number;
  let inactiveId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    const active = await prisma.developmentRequester.create({
      data: { name: "Test Active", email: "test.active@example.com", isActive: true },
    });
    const inactive = await prisma.developmentRequester.create({
      data: { name: "Test Inactive", email: "test.inactive@example.com", isActive: false },
    });
    activeId = active.id;
    inactiveId = inactive.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.developmentRequester.deleteMany({
      where: { id: { in: [activeId, inactiveId] } },
    });
  });

  it("returns 200 with only active requesters", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    const ids = res.body.map((r: { id: number }) => r.id);
    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
  });

  it("returns each requester as { id, name, email } only", async () => {
    const res = await request(app).get("/api/requesters");
    const found = res.body.find((r: { id: number }) => r.id === activeId);

    expect(found).toEqual({
      id: activeId,
      name: "Test Active",
      email: "test.active@example.com",
    });
  });
});
