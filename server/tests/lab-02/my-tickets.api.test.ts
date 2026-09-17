import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/tickets", () => {
  let requesterAId: number;
  let requesterBId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const testPassword = "TestPassword1!";
  const requesterAEmail = "mytickets.a@example.com";
  const requesterBEmail = "mytickets.b@example.com";

  const requesterAAgent = request.agent(app);
  const requesterBAgent = request.agent(app);

  beforeAll(async () => {
    const prisma = getPrisma();

    const testPasswordHash = await bcrypt.hash(testPassword, 12);

    const a = await prisma.user.create({
      data: {
        name: "My Tickets A",
        email: requesterAEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const b = await prisma.user.create({
      data: {
        name: "My Tickets B",
        email: requesterBEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: true,
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

    requesterAId = a.id;
    requesterBId = b.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    // 3 tickets for A (one HIGH priority, two MEDIUM), 1 for B.
    await prisma.ticket.createMany({
      data: [
        {
          ticketNumber: "TKT-TEST-000001",
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Laptop battery drains quickly",
          description: "Battery drains fast even when idle.",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          status: "NEW",
        },
        {
          ticketNumber: "TKT-TEST-000002",
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Printer offline",
          description: "Printer shows offline intermittently.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "NEW",
        },
        {
          ticketNumber: "TKT-TEST-000003",
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "VPN keeps disconnecting",
          description: "VPN drops every few minutes on wifi.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "NEW",
        },
        {
          ticketNumber: "TKT-TEST-000004",
          requesterId: requesterBId,
          categoryId,
          relatedSystemId,
          summary: "Requester B's own ticket",
          description: "Should never appear in A's list.",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "NEW",
        },
      ],
    });

    const loginA = await requesterAAgent
      .post("/api/auth/login")
      .send({
        email: requesterAEmail,
        password: testPassword,
      });

    const loginB = await requesterBAgent
      .post("/api/auth/login")
      .send({
        email: requesterBEmail,
        password: testPassword,
      });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);
  });

  afterAll(async () => {
    const prisma = getPrisma();

    const tickets = await prisma.ticket.findMany({
      where: {
        requesterId: {
          in: [requesterAId, requesterBId],
        },
      },
      select: {
        id: true,
      },
    });

    const ticketIds = tickets.map((ticket) => ticket.id);

    if (ticketIds.length > 0) {
      await prisma.publicComment.deleteMany({
        where: {
          ticketId: {
            in: ticketIds,
          },
        },
      });

      await prisma.internalNote.deleteMany({
        where: {
          ticketId: {
            in: ticketIds,
          },
        },
      });

      await prisma.attachment.deleteMany({
        where: {
          ticketId: {
            in: ticketIds,
          },
        },
      });

      await prisma.ticket.deleteMany({
        where: {
          id: {
            in: ticketIds,
          },
        },
      });
    }

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [requesterAId, requesterBId],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [requesterAId, requesterBId],
        },
      },
    });
  });

  // Lab 3: requesterId is no longer required from the browser.
  // Authentication is required instead.
  it("requires authentication", async () => {
    const res = await request(app).get("/api/tickets");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });

  // BR-08/BR-09 ownership scoping
  it("only returns the authenticated requester's own tickets", async () => {
    const res = await requesterAAgent.get("/api/tickets");

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(3);

    expect(
      res.body.items.every(
        (t: { summary: string }) =>
          t.summary !== "Requester B's own ticket"
      )
    ).toBe(true);
  });

  // Lab 3 security regression:
  // a query-string requesterId must not allow identity switching.
  it("ignores requesterId supplied in the query string", async () => {
    const res = await requesterAAgent.get(
      `/api/tickets?requesterId=${requesterBId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(3);

    expect(
      res.body.items.every(
        (t: { summary: string }) =>
          t.summary !== "Requester B's own ticket"
      )
    ).toBe(true);
  });

  // BR-10 search
  it("search matches summary (case-insensitive)", async () => {
    const res = await requesterAAgent.get(
      "/api/tickets?search=printer"
    );

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.items[0].summary).toBe("Printer offline");
  });

  // BR-11 filter
  it("filters by requestedPriority", async () => {
    const res = await requesterAAgent.get(
      "/api/tickets?requestedPriority=MEDIUM"
    );

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(2);
  });

  // BR-12 default sort, plus explicit ascending sort
  it("sorts by ticketNumber ascending when requested", async () => {
    const res = await requesterAAgent.get(
      "/api/tickets?sortBy=ticketNumber&sortDir=asc"
    );

    expect(res.status).toBe(200);

    const numbers = res.body.items.map(
      (t: { ticketNumber: string }) => t.ticketNumber
    );

    expect(numbers).toEqual([...numbers].sort());
  });

  // BR-13 pagination
  it("paginates with the given pageSize", async () => {
    const res = await requesterAAgent.get(
      "/api/tickets?pageSize=2&page=1"
    );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalItems).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  // BR-30 no-results vs BR-29 empty are a client-side distinction; this
  // confirms the API's noResults flag is accurate either way.
  it("reports noResults true when a filter matches nothing", async () => {
    const res = await requesterAAgent.get(
      "/api/tickets?search=nonexistent-xyz"
    );

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.noResults).toBe(true);
  });

  // Explicitly prove that Requester B receives only Requester B's data.
  it("uses the logged-in Requester identity for ownership", async () => {
    const res = await requesterBAgent.get("/api/tickets");

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.items[0].summary).toBe(
      "Requester B's own ticket"
    );
  });
});