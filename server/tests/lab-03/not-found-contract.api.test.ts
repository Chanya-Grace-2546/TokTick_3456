import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { app } from "../../src/app.js";
import { hashSessionToken } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

describe("BR-16 / API §4 exact safe NOT_FOUND", () => {
  const prisma = getPrisma();
  let cookie: string;
  let ticketId: number;
  let attachmentId: number;
  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { name: "Actor", email: "actor@example.test", passwordHash: "session-only", mustChangePassword: false } });
    const other = await prisma.user.create({ data: { name: "Other", email: "other@example.test", passwordHash: "session-only", mustChangePassword: false } });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { userId: actor.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    cookie = `toktickit_session=${token}`;
    const ticket = await prisma.ticket.create({ data: { ticketNumber: "PRIVATE-OTHER", requesterId: other.id, categoryId: 1, relatedSystemId: 1, summary: "Private", description: "Do not serialize", requestedPriority: "MEDIUM" } });
    ticketId = ticket.id;
    const attachment = await prisma.attachment.create({ data: { ticketId, fileName: "private.png", storedFileName: "private.png", mimeType: "image/png", sizeBytes: 1 } });
    attachmentId = attachment.id;
  });
  it.each(["detail", "list attachments", "upload", "download", "remove"])("%s: missing and cross-owner responses are exactly the same safe NOT_FOUND", async operation => {
    const call = (missing: boolean) => {
      const ticket = missing ? 2147483647 : ticketId;
      const attachment = missing ? 2147483647 : attachmentId;
      const client = request(app);
      if (operation === "detail") return client.get(`/api/tickets/${ticket}`).set("Cookie", cookie);
      if (operation === "list attachments") return client.get(`/api/tickets/${ticket}/attachments`).set("Cookie", cookie);
      if (operation === "download") return client.get(`/api/attachments/${attachment}/download`).set("Cookie", cookie);
      if (operation === "remove") return client.patch(`/api/attachments/${attachment}/remove`).set("Cookie", cookie).set("Origin", "http://localhost:5173").send({ reason: "Contract check" });
      return client.post(`/api/tickets/${ticket}/attachments`).set("Cookie", cookie).set("Origin", "http://localhost:5173").attach("file", Buffer.from("fixture"), { filename: "fixture.png", contentType: "image/png" });
    };
    const before = await prisma.attachment.findMany();
    const denied = await call(false);
    const missing = await call(true);
    expect(denied.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(denied.body).toEqual(missing.body);
    expect(await prisma.attachment.findMany()).toEqual(before);
    expect(denied.body).toEqual({ error: "NOT_FOUND" });
  });
});
