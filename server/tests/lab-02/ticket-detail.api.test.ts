import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail API", () => {
  let requesterAId: number;
  let requesterBId: number;
  let ticketId: number;

  const testPassword = "TestPassword1!";
  const requesterAEmail = "ticket.detail.a@example.com";
  const requesterBEmail = "ticket.detail.b@example.com";

  const requesterAAgent = request.agent(app);
  const requesterBAgent = request.agent(app);

  beforeAll(async () => {
    const prisma = getPrisma();

    const testPasswordHash = await bcrypt.hash(testPassword, 12);

    const a = await prisma.user.create({
      data: {
        name: "Ticket Detail Test A",
        email: requesterAEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const b = await prisma.user.create({
      data: {
        name: "Ticket Detail Test B",
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

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-TEST-DETAIL01",
        requesterId: a.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Ticket detail test ticket",
        description: "Used to test ticket detail access.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "NEW",
      },
    });

    requesterAId = a.id;
    requesterBId = b.id;
    ticketId = ticket.id;

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

    await prisma.publicComment.deleteMany({
      where: { ticketId },
    });

    await prisma.internalNote.deleteMany({
      where: { ticketId },
    });

    await prisma.attachment.deleteMany({
      where: { ticketId },
    });

    await prisma.ticket.deleteMany({
      where: { id: ticketId },
    });

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

  describe("GET /api/tickets/:id", () => {
    it("requires authentication", async () => {
      const res = await request(app).get(
        `/api/tickets/${ticketId}`
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHENTICATED");
    });

    it("returns the authenticated requester's owned ticket with its attachments", async () => {
      const res = await requesterAAgent.get(
        `/api/tickets/${ticketId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.ticketNumber).toBe("TKT-TEST-DETAIL01");
      expect(res.body.requesterId).toBe(requesterAId);
      expect(res.body.attachments).toEqual([]);
    });

    // BR-09: cross-requester access rejected, same 404 either way.
    it("returns 404 for a different requester's ticket", async () => {
      const res = await requesterBAgent.get(
        `/api/tickets/${ticketId}`
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("NOT_FOUND");
    });

    // Lab 3 security regression:
    // query-string requesterId must not override authenticated identity.
    it("does not allow requesterId query tampering", async () => {
      const res = await requesterBAgent.get(
        `/api/tickets/${ticketId}?requesterId=${requesterAId}`
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("NOT_FOUND");
    });
  });
});