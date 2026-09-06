import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail + Attachments (Issue 6)", () => {
  let requesterAId: number;
  let requesterBId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketId: number;

  const tinyPng = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
      "53de0000000c4944415408d76360000000020001e221bc330000000049454e44ae426082",
    "hex"
  );

  beforeAll(async () => {
    const prisma = getPrisma();

    const a = await prisma.developmentRequester.create({
      data: { name: "Attach Test A", email: "attach.a@example.com", isActive: true },
    });
    const b = await prisma.developmentRequester.create({
      data: { name: "Attach Test B", email: "attach.b@example.com", isActive: true },
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
        ticketNumber: "TKT-TEST-ATTACH01",
        requesterId: a.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Attachment test ticket",
        description: "Used to test attachment upload/download/remove flows.",
        requestedPriority: "MEDIUM",
        status: "NEW",
      },
    });

    requesterAId = a.id;
    requesterBId = b.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    ticketId = ticket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.attachment.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.developmentRequester.deleteMany({
      where: { id: { in: [requesterAId, requesterBId] } },
    });
  });

  describe("GET /api/tickets/:id", () => {
    it("returns the owned ticket with its attachments", async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=${requesterAId}`);

      expect(res.status).toBe(200);
      expect(res.body.ticketNumber).toBe("TKT-TEST-ATTACH01");
      expect(res.body.attachments).toEqual([]);
    });

    // BR-09: cross-requester access rejected, same 404 either way
    it("returns 404 for a different requester's ticket", async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=${requesterBId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("TICKET_NOT_FOUND");
    });
  });

  describe("POST /api/tickets/:id/attachments", () => {
    it("uploads a valid PNG and returns its metadata", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", String(requesterAId))
        .attach("file", tinyPng, { filename: "screenshot.png", contentType: "image/png" });

      expect(res.status).toBe(201);
      expect(res.body.fileName).toBe("screenshot.png");
      expect(res.body.isRemoved).toBe(false);
    });

    // BR-22
    it("rejects a disallowed file type", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", String(requesterAId))
        .attach("file", Buffer.from("not an image"), {
          filename: "notes.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_FILE_TYPE");
    });

    // BR-09
    it("rejects upload from a non-owning requester", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", String(requesterBId))
        .attach("file", tinyPng, { filename: "screenshot2.png", contentType: "image/png" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("TICKET_NOT_FOUND");
    });

    // BR-22: max 5 active attachments per ticket
    it("rejects a 6th active attachment", async () => {
      // one was already added in the first test above; add 4 more to reach 5
      for (let i = 0; i < 4; i++) {
        const r = await request(app)
          .post(`/api/tickets/${ticketId}/attachments`)
          .field("requesterId", String(requesterAId))
          .attach("file", tinyPng, { filename: `extra-${i}.png`, contentType: "image/png" });
        expect(r.status).toBe(201);
      }

      const sixth = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", String(requesterAId))
        .attach("file", tinyPng, { filename: "sixth.png", contentType: "image/png" });

      expect(sixth.status).toBe(400);
      expect(sixth.body.error).toBe("MAX_ATTACHMENTS_REACHED");
    });
  });

  describe("GET /api/attachments/:id/download and PATCH /remove", () => {
    let attachmentId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const attachment = await prisma.attachment.findFirst({
        where: { ticketId, fileName: "screenshot.png" },
      });
      attachmentId = attachment!.id;
    });

    it("downloads an active attachment", async () => {
      const res = await request(app).get(
        `/api/attachments/${attachmentId}/download?requesterId=${requesterAId}`
      );
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
    });

    it("rejects download from a non-owning requester", async () => {
      const res = await request(app).get(
        `/api/attachments/${attachmentId}/download?requesterId=${requesterBId}`
      );
      expect(res.status).toBe(404);
    });

    // BR-26: reason required
    it("rejects removal without a reason", async () => {
      const res = await request(app)
        .patch(`/api/attachments/${attachmentId}/remove`)
        .send({ requesterId: requesterAId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("REASON_REQUIRED");
    });

    it("soft-removes with a reason, then blocks further download (BR-27)", async () => {
      const removeRes = await request(app)
        .patch(`/api/attachments/${attachmentId}/remove`)
        .send({ requesterId: requesterAId, reason: "Wrong screenshot attached" });

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.isRemoved).toBe(true);

      const downloadRes = await request(app).get(
        `/api/attachments/${attachmentId}/download?requesterId=${requesterAId}`
      );
      expect(downloadRes.status).toBe(410);
    });

    // BR-27: removed attachment still visible as metadata
    it("still shows the removed attachment in the ticket's attachment list", async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=${requesterAId}`);
      const found = res.body.attachments.find((a: { id: number }) => a.id === attachmentId);

      expect(found).toBeTruthy();
      expect(found.isRemoved).toBe(true);
      expect(found.removedReason).toBe("Wrong screenshot attached");
    });

    it("rejects removing an already-removed attachment", async () => {
      const res = await request(app)
        .patch(`/api/attachments/${attachmentId}/remove`)
        .send({ requesterId: requesterAId, reason: "trying again" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("ALREADY_REMOVED");
    });
  });
});
