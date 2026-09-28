import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets", () => {
  let activeRequesterId: number;
  let inactiveRequesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const testPassword = "TestPassword1!";
  const activeEmail = "create.active@example.com";
  const inactiveEmail = "create.inactive@example.com";

  const activeAgent = request.agent(app);

  beforeAll(async () => {
    const prisma = getPrisma();

    const testPasswordHash = await bcrypt.hash(testPassword, 12);

    const active = await prisma.user.create({
      data: {
        name: "Create Ticket Active",
        email: activeEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const inactive = await prisma.user.create({
      data: {
        name: "Create Ticket Inactive",
        email: inactiveEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: false,
        mustChangePassword: false,
      },
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

    // Lab 3 authentication:
    // log in once and keep the Session cookie for the requester tests.
    const loginRes = await activeAgent
      .post("/api/auth/login")
      .send({
        email: activeEmail,
        password: testPassword,
      });

    expect(loginRes.status).toBe(200);
  });

  afterAll(async () => {
    const prisma = getPrisma();

    const tickets = await prisma.ticket.findMany({
      where: {
        requesterId: {
          in: [activeRequesterId, inactiveRequesterId],
        },
      },
      select: { id: true },
    });

    const ticketIds = tickets.map((ticket) => ticket.id);

    if (ticketIds.length > 0) {
      await prisma.publicComment.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });

      await prisma.internalNote.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });

      await prisma.attachment.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });

      await prisma.ticket.deleteMany({
        where: { id: { in: ticketIds } },
      });
    }

    // Sessions reference User, so delete them before deleting test Users.
    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [activeRequesterId, inactiveRequesterId],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [activeRequesterId, inactiveRequesterId],
        },
      },
    });
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      categoryId,
      relatedSystemId,
      summary: "Laptop battery drains quickly",
      description:
        "Battery drains fast even when idle, started after last update.",
      requestedPriority: "MEDIUM",
      ...overrides,
    };
  }

  // Lab 3: protected Requester route requires authentication.
  it("rejects an unauthenticated ticket creation request", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send(validPayload());

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });

  // AC-01
  it("creates a Ticket and returns a generated Ticket Number", async () => {
    const res = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.status).toBe("NEW");
    expect(res.body.requesterId).toBe(activeRequesterId);

    // Lab 3: initial IT Priority copies Requested Priority.
    expect(res.body.itPriority).toBe("MEDIUM");
  });

  // AC-04, BR-14
  it("rejects a Summary shorter than 5 characters with a field-level message", async () => {
    const res = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(validPayload({ summary: "Hi" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_FAILED");
    expect(res.body.fields.summary).toBeTruthy();
  });

  // BR-15
  it("rejects a Description shorter than 10 characters", async () => {
    const res = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(validPayload({ description: "too short" }));

    expect(res.status).toBe(400);
    expect(res.body.fields.description).toBeTruthy();
  });

  // BR-16
  it("rejects an unknown categoryId", async () => {
    const res = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(validPayload({ categoryId: 999999 }));

    expect(res.status).toBe(400);
    expect(res.body.fields.categoryId).toBeTruthy();
  });

  // Lab 3 replaces client-supplied requesterId with authenticated identity.
  // An inactive Requester must be rejected at login using the same public
  // invalid-credentials response as an unknown email or wrong password.
  it("rejects login for an inactive Requester with the generic invalid-credentials response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: inactiveEmail,
        password: testPassword,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  // Lab 3 security regression:
  // requesterId supplied by the browser must not change ticket ownership.
  it("ignores a client-supplied requesterId and uses the authenticated Requester", async () => {
    const res = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(
        validPayload({
          requesterId: inactiveRequesterId,
          summary: "Authenticated identity ownership test",
        })
      );

    expect(res.status).toBe(201);
    expect(res.body.requesterId).toBe(activeRequesterId);
    expect(res.body.requesterId).not.toBe(inactiveRequesterId);
  });

  // BR-18: duplicate-submission guard
  it("returns the same Ticket instead of creating a duplicate within 5 seconds", async () => {
    const payload = validPayload({
      summary: "Duplicate guard test summary",
    });

    const first = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(payload);

    const second = await activeAgent
      .post("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.ticketNumber).toBe(first.body.ticketNumber);
  });
});