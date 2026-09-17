import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { UPLOADS_DIR } from "../../src/attachmentUpload.js";

describe("Attachments API", () => {
  let requesterAId: number;
  let requesterBId: number;
  let ticketId: number;

  const testPassword = "TestPassword1!";
  const requesterAEmail = "attach.a@example.com";
  const requesterBEmail = "attach.b@example.com";

  const requesterAAgent = request.agent(app);
  const requesterBAgent = request.agent(app);

  const tinyPng = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
      "53de0000000c4944415408d76360000000020001e221bc330000000049454e44ae426082",
    "hex"
  );

  beforeAll(async () => {
    const prisma = getPrisma();

    const testPasswordHash = await bcrypt.hash(testPassword, 12);

    const a = await prisma.user.create({
      data: {
        name: "Attach Test A",
        email: requesterAEmail,
        passwordHash: testPasswordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const b = await prisma.user.create({
      data: {
        name: "Attach Test B",
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
        ticketNumber: "TKT-TEST-ATTACH01",
        requesterId: a.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Attachment test ticket",
        description: "Used to test attachment upload/download/remove flows.",
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

    // Remove physical test files created by multer before deleting DB rows.
    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: { storedFileName: true },
    });

    for (const attachment of attachments) {
      const filePath = path.join(
        UPLOADS_DIR,
        attachment.storedFileName
      );

      await fs.promises.unlink(filePath).catch(() => {});
    }

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

  describe("POST /api/tickets/:id/attachments", () => {
    it("requires authentication", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .attach("file", tinyPng, {
          filename: "unauthenticated.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHENTICATED");
    });

    it("uploads a valid PNG and returns its metadata", async () => {
      const res = await requesterAAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Origin", "http://localhost:5173")
        .attach("file", tinyPng, {
          filename: "screenshot.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(201);
      expect(res.body.fileName).toBe("screenshot.png");
      expect(res.body.isRemoved).toBe(false);
    });

    // BR-22
    it("rejects a disallowed file type", async () => {
      const res = await requesterAAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Origin", "http://localhost:5173")
        .attach("file", Buffer.from("not an image"), {
          filename: "notes.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_FILE_TYPE");
    });

    // BR-09
    it("rejects upload from a non-owning requester", async () => {
      const res = await requesterBAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Origin", "http://localhost:5173")
        .attach("file", tinyPng, {
          filename: "screenshot2.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("TICKET_NOT_FOUND");
    });

    // Lab 3 security regression:
    // a requesterId form field must not override authenticated identity.
    it("does not allow requesterId form-field tampering", async () => {
      const res = await requesterBAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Origin", "http://localhost:5173")
        .field("requesterId", String(requesterAId))
        .attach("file", tinyPng, {
          filename: "tampered.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("TICKET_NOT_FOUND");
    });

    // BR-22: max 5 active attachments per ticket
    it("rejects a 6th active attachment", async () => {
      // One was already added above; add 4 more to reach 5.
      for (let i = 0; i < 4; i++) {
        const res = await requesterAAgent
          .post(`/api/tickets/${ticketId}/attachments`)
          .set("Origin", "http://localhost:5173")
          .attach("file", tinyPng, {
            filename: `extra-${i}.png`,
            contentType: "image/png",
          });

        expect(res.status).toBe(201);
      }

      const sixth = await requesterAAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Origin", "http://localhost:5173")
        .attach("file", tinyPng, {
          filename: "sixth.png",
          contentType: "image/png",
        });

      expect(sixth.status).toBe(400);
      expect(sixth.body.error).toBe("MAX_ATTACHMENTS_REACHED");
    });
  });

  describe("GET /api/attachments/:id/download and PATCH /remove", () => {
    let attachmentId: number;

    beforeAll(async () => {
      const prisma = getPrisma();

      const attachment = await prisma.attachment.findFirst({
        where: {
          ticketId,
          fileName: "screenshot.png",
        },
      });

      if (!attachment) {
        throw new Error(
          "Expected screenshot.png test attachment to exist"
        );
      }

      attachmentId = attachment.id;
    });

    it("downloads an active attachment", async () => {
      const res = await requesterAAgent.get(
        `/api/attachments/${attachmentId}/download`
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
    });

    it("rejects download from a non-owning requester", async () => {
      const res = await requesterBAgent.get(
        `/api/attachments/${attachmentId}/download`
      );

      expect(res.status).toBe(404);
    });

    // Lab 3 security regression:
    // query-string requesterId cannot override authenticated ownership.
    it("does not allow requesterId download tampering", async () => {
      const res = await requesterBAgent.get(
        `/api/attachments/${attachmentId}/download?requesterId=${requesterAId}`
      );

      expect(res.status).toBe(404);
    });

    // BR-26: reason required
    it("rejects removal without a reason", async () => {
      const res = await requesterAAgent
        .patch(`/api/attachments/${attachmentId}/remove`)
        .set("Origin", "http://localhost:5173")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("REASON_REQUIRED");
    });

    it("soft-removes with a reason, then blocks further download (BR-27)", async () => {
      const removeRes = await requesterAAgent
        .patch(`/api/attachments/${attachmentId}/remove`)
        .set("Origin", "http://localhost:5173")
        .send({
          reason: "Wrong screenshot attached",
        });

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.isRemoved).toBe(true);

      const downloadRes = await requesterAAgent.get(
        `/api/attachments/${attachmentId}/download`
      );

      expect(downloadRes.status).toBe(410);
    });

    // BR-27: removed attachment still visible as metadata
    it("still shows the removed attachment in the ticket's attachment list", async () => {
      const res = await requesterAAgent.get(
        `/api/tickets/${ticketId}`
      );

      expect(res.status).toBe(200);

      const found = res.body.attachments.find(
        (a: { id: number }) => a.id === attachmentId
      );

      expect(found).toBeTruthy();
      expect(found.isRemoved).toBe(true);
      expect(found.removedReason).toBe(
        "Wrong screenshot attached"
      );
    });

    it("rejects removing an already-removed attachment", async () => {
      const res = await requesterAAgent
        .patch(`/api/attachments/${attachmentId}/remove`)
        .set("Origin", "http://localhost:5173")
        .send({
          reason: "trying again",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("ALREADY_REMOVED");
    });
  });
});