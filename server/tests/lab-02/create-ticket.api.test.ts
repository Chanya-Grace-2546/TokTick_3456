import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets", () => {
  let activeRequesterId: number;
  let inactiveRequesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    const active = await prisma.developmentRequester.create({
      data: { name: "Create Ticket Active", email: "create.active@example.com", isActive: true },
    });
    const inactive = await prisma.developmentRequester.create({
      data: { name: "Create Ticket Inactive", email: "create.inactive@example.com", isActive: false },
    });
    const category = await prisma.category.upsert({
      where: { name: "Hardware" },
      update: {},
      create: { name: "Hardware" },
    });
    const relatedSystem = await prisma.relatedSystem.upsert({
      where: { name: "Corporate Laptop" },
      update: {},
      create: { name: "Corporate Laptop" },
    });

    activeRequesterId = active.id;
    inactiveRequesterId = inactive.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { requesterId: { in: [activeRequesterId, inactiveRequesterId] } },
    });
    await prisma.developmentRequester.deleteMany({
      where: { id: { in: [activeRequesterId, inactiveRequesterId] } },
    });
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      requesterId: activeRequesterId,
      categoryId,
      relatedSystemId,
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast even when idle, started after last update.",
      requestedPriority: "MEDIUM",
      ...overrides,
    };
  }

  // AC-01
  it("creates a Ticket and returns a generated Ticket Number", async () => {
    const res = await request(app).post("/api/tickets").send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.status).toBe("NEW");
    expect(res.body.requesterId).toBe(activeRequesterId);
  });

  // AC-04, BR-14
  it("rejects a Summary shorter than 5 characters with a field-level message", async () => {
    const res = await request(app).post("/api/tickets").send(validPayload({ summary: "Hi" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_FAILED");
    expect(res.body.fields.summary).toBeTruthy();
  });

  // BR-15
  it("rejects a Description shorter than 10 characters", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send(validPayload({ description: "too short" }));

    expect(res.status).toBe(400);
    expect(res.body.fields.description).toBeTruthy();
  });

  // BR-16
  it("rejects an unknown categoryId", async () => {
    const res = await request(app).post("/api/tickets").send(validPayload({ categoryId: 999999 }));

    expect(res.status).toBe(400);
    expect(res.body.fields.categoryId).toBeTruthy();
  });

  // BR-05 / AC-13-adjacent: inactive Requester cannot create tickets
  it("rejects an inactive Requester with 404", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send(validPayload({ requesterId: inactiveRequesterId }));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("REQUESTER_NOT_FOUND");
  });

  // BR-18: duplicate-submission guard
  it("returns the same Ticket instead of creating a duplicate within 5 seconds", async () => {
    const payload = validPayload({ summary: "Duplicate guard test summary" });

    const first = await request(app).post("/api/tickets").send(payload);
    const second = await request(app).post("/api/tickets").send(payload);

    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.ticketNumber).toBe(first.body.ticketNumber);
  });
});
