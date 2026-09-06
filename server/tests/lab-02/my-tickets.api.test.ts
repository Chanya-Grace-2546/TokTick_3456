import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/tickets", () => {
  let requesterAId: number;
  let requesterBId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    const a = await prisma.developmentRequester.create({
      data: { name: "My Tickets A", email: "mytickets.a@example.com", isActive: true },
    });
    const b = await prisma.developmentRequester.create({
      data: { name: "My Tickets B", email: "mytickets.b@example.com", isActive: true },
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
          status: "NEW",
        },
      ],
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { requesterId: { in: [requesterAId, requesterBId] } },
    });
    await prisma.developmentRequester.deleteMany({
      where: { id: { in: [requesterAId, requesterBId] } },
    });
  });

  it("requires requesterId", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("REQUESTER_ID_REQUIRED");
  });

  // BR-08/BR-09 ownership scoping
  it("only returns the given requester's own tickets", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterAId}`);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(3);
    expect(res.body.items.every((t: { summary: string }) => t.summary !== "Requester B's own ticket")).toBe(
      true
    );
  });

  // BR-10 search
  it("search matches summary (case-insensitive)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterAId}&search=printer`);

    expect(res.body.totalItems).toBe(1);
    expect(res.body.items[0].summary).toBe("Printer offline");
  });

  // BR-11 filter
  it("filters by requestedPriority", async () => {
    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterAId}&requestedPriority=MEDIUM`
    );

    expect(res.body.totalItems).toBe(2);
  });

  // BR-12 default sort, plus explicit ascending sort
  it("sorts by ticketNumber ascending when requested", async () => {
    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterAId}&sortBy=ticketNumber&sortDir=asc`
    );

    const numbers = res.body.items.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(numbers).toEqual([...numbers].sort());
  });

  // BR-13 pagination
  it("paginates with the given pageSize", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterAId}&pageSize=2&page=1`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalItems).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  // BR-30 no-results vs BR-29 empty are a client-side distinction; this
  // confirms the API's noResults flag is accurate either way.
  it("reports noResults true when a filter matches nothing", async () => {
    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterAId}&search=nonexistent-xyz`
    );

    expect(res.body.totalItems).toBe(0);
    expect(res.body.noResults).toBe(true);
  });
});
