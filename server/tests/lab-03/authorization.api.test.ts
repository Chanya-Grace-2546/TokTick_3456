import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { origin, password, prisma, sessionFor, useAdminDatabase } from "./helpers/adminTestDatabase.js";

vi.mock("../../src/prisma.js", async () => {
  const database = await import("./helpers/adminTestDatabase.js");
  return { getPrisma: () => database.prisma };
});

// API-33 scope only: earlier Ticket/Staff authorization suites remain unchanged.
describe("Issue 7 Administrator-only API authorization — API-33", () => {
  const fixture = useAdminDatabase();
  const operations = ["list", "create", "edit", "reset"] as const;
  type Operation = typeof operations[number];

  function call(operation: Operation, cookie?: string, requestOrigin: string | null = origin) {
    const client = request(app);
    const req = operation === "list" ? client.get("/api/admin/users")
      : operation === "create" ? client.post("/api/admin/users").send({
        name: "Unauthorized Person", email: "unauthorized@example.test",
        role: "ADMINISTRATOR", isActive: true, initialPassword: password,
      })
      : operation === "edit" ? client.patch(`/api/admin/users/${fixture.requester.id}`).send({ role: "ADMINISTRATOR" })
      : client.post(`/api/admin/users/${fixture.requester.id}/initial-password`).send({ initialPassword: password, confirmPassword: password });
    if (cookie) req.set("Cookie", cookie);
    if (requestOrigin !== null) req.set("Origin", requestOrigin);
    return req;
  }

  for (const operation of operations) {
    it(`${operation}: rejects unauthenticated access with no management data or mutation`, async () => {
      const before = await prisma.user.findMany({ orderBy: { id: "asc" } });
      const response = await call(operation);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "UNAUTHENTICATED" });
      expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    });

    it.each(["staff", "requester"] as const)(`${operation}: forbids %s without exposing or changing Users`, async role => {
      const cookie = await sessionFor(fixture[role]);
      const before = await prisma.user.findMany({ orderBy: { id: "asc" } });
      const sessions = await prisma.session.findMany({ orderBy: { id: "asc" } });
      const response = await call(operation, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "FORBIDDEN" });
      expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
      expect(await prisma.session.findMany({ orderBy: { id: "asc" } })).toEqual(sessions);
    });

    it(`${operation}: blocks an Administrator awaiting mandatory password change`, async () => {
      await prisma.user.update({ where: { id: fixture.admin.id }, data: { mustChangePassword: true } });
      const response = await call(operation, fixture.adminCookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });
      expect(await prisma.user.findUnique({ where: { id: fixture.requester.id } })).toEqual(fixture.requester);
      expect(await prisma.user.count()).toBe(5);
    });

    it.each(["expired", "invalidated", "inactive", "unknown"] as const)(`${operation}: rejects %s sessions`, async state => {
      let cookie: string;
      if (state === "unknown") cookie = "toktickit_session=unknown-token";
      else {
        cookie = await sessionFor(fixture.admin, { expired: state === "expired", invalidated: state === "invalidated" });
        if (state === "inactive") await prisma.user.update({ where: { id: fixture.admin.id }, data: { isActive: false } });
      }
      const response = await call(operation, cookie);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "UNAUTHENTICATED" });
      expect(await prisma.user.findUnique({ where: { id: fixture.requester.id } })).toEqual(fixture.requester);
    });
  }

  for (const operation of ["create", "edit", "reset"] as const) {
    it.each([null, "https://untrusted.example"])(`${operation}: rejects absent/foreign Origin (%s) without mutation`, async requestOrigin => {
      const before = await prisma.user.findMany({ orderBy: { id: "asc" } });
      const sessions = await prisma.session.findMany({ orderBy: { id: "asc" } });
      const response = await call(operation, fixture.adminCookie, requestOrigin);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "INVALID_ORIGIN" });
      expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
      expect(await prisma.session.findMany({ orderBy: { id: "asc" } })).toEqual(sessions);
    });
  }
});
