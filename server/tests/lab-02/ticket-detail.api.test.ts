import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail API", () => {
  let requesterAId: number;
  let requesterBId: number;
  let ticketId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    const a = await prisma.developmentRequester.create({
      data: {
        name: "Ticket Detail Test A",
        email: "ticket.detail.a@example.com",
        isActive: true,
      },
    });

    const b = await prisma.developmentRequester.create({
      data: {
        name: "Ticket Detail Test B",
        email: "ticket.detail.b@example.com",
        isActive: true,
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

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-TEST-DETAIL01",
        requesterId: a.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Ticket detail test ticket",
        description: "Used to test ticket detail access.",
        requestedPriority: "MEDIUM",
        status: "NEW",
      },
    });

    requesterAId = a.id;
    requesterBId = b.id;
    ticketId = ticket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();

    await prisma.attachment.deleteMany({
      where: { ticketId },
    });

    await prisma.ticket.deleteMany({
      where: { id: ticketId },
    });

    await prisma.developmentRequester.deleteMany({
      where: {
        id: { in: [requesterAId, requesterBId] },
      },
    });
  });

  describe("GET /api/tickets/:id", () => {
    it("returns the owned ticket with its attachments", async () => {
      const res = await request(app).get(
        `/api/tickets/${ticketId}?requesterId=${requesterAId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.ticketNumber).toBe("TKT-TEST-DETAIL01");
      expect(res.body.attachments).toEqual([]);
    });

    // BR-09: cross-requester access rejected, same 404 either way
    it("returns 404 for a different requester's ticket", async () => {
      const res = await request(app).get(
        `/api/tickets/${ticketId}?requesterId=${requesterBId}`
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("TICKET_NOT_FOUND");
    });
  });
});