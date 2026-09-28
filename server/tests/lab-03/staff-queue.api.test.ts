import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Priority, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 Staff Queue (API-12–14)", () => {
  const prisma = getPrisma();
  const marker = `queue-${Date.now()}`;
  const password = "QueueTest!123";
  const staff = request.agent(app);
  const admin = request.agent(app);
  const requester = request.agent(app);
  const initial = request.agent(app);
  const userIds: number[] = [];
  const priorities = Object.values(Priority);
  const statuses = Object.values(TicketStatus);
  // Existing migrations append the two Lab 3 values to the Lab 2 enum.
  const statusSortOrder = ["NEW", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED", "WAITING_FOR_REQUESTER", "REOPENED"];
  let staffId: number;
  let adminId: number;
  let inactiveId: number;
  let requesterId: number;
  let categoryIds: number[];
  let rows: Awaited<ReturnType<typeof prisma.ticket.findMany>>;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 12);
    for (const [index, role] of (["IT_STAFF", "ADMINISTRATOR", "REQUESTER", "REQUESTER", "IT_STAFF", "IT_STAFF"] as const).entries()) {
      const user = await prisma.user.create({ data: {
        name: `${marker} Person ${index}`, email: `${marker}.${index}@example.test`,
        passwordHash, role, isActive: index !== 4, mustChangePassword: index === 5,
      } });
      userIds.push(user.id);
    }
    [staffId, adminId, requesterId, , inactiveId] = userIds;
    categoryIds = (await prisma.category.findMany({ take: 2, orderBy: { id: "asc" } })).map(c => c.id);
    const system = await prisma.relatedSystem.findFirstOrThrow();
    expect(categoryIds).toHaveLength(2);
    await prisma.ticket.createMany({ data: Array.from({ length: 55 }, (_, i) => ({
      ticketNumber: `${marker}-T-${String(i).padStart(3, "0")}`,
      summary: `${marker} Summary ${i}`, description: "Queue integration fixture",
      requesterId: userIds[2 + i % 2], categoryId: categoryIds[i % 2], relatedSystemId: system.id,
      requestedPriority: priorities[i % 3], itPriority: priorities[(i + 1) % 3],
      status: statuses[i % statuses.length], ownerId: [null, staffId, adminId][i % 3],
      createdAt: new Date(Date.UTC(2020, 0, i + 1)), updatedAt: new Date(Date.UTC(2021, 0, 55 - i)),
    })) });
    rows = await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: marker } } });
    for (const [agent, index] of [[staff, 0], [admin, 1], [requester, 2], [initial, 5]] as const) {
      const login = await agent.post("/api/auth/login").send({ email: `${marker}.${index}@example.test`, password });
      expect(login.status).toBe(200);
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  for (const endpoint of ["tickets", "owners"]) {
    it(`${endpoint}: rejects missing auth, Requester, and initial-password sessions`, async () => {
      for (const [agent, status, error] of [
        [request(app), 401, "UNAUTHENTICATED"], [requester, 403, "FORBIDDEN"],
        [initial, 403, "PASSWORD_CHANGE_REQUIRED"],
      ] as const) {
        const res = await agent.get(`/api/staff/${endpoint}`);
        expect(res.status).toBe(status);
        expect(res.body).toEqual({ error });
      }
    });
  }

  it("defaults to updated descending, page 1/10, shared results and safe fields", async () => {
    const res = await staff.get("/api/staff/tickets").query({ search: marker });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, totalItems: 55, totalPages: 6 });
    expect(res.body.items.map((t: { id: number }) => t.id)).toEqual(rows.slice().sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0,10).map(t => t.id));
    expect(new Set(res.body.items.map((t: { requester: { id: number } }) => t.requester.id)).size).toBe(2);
    expect(Object.keys(res.body).sort()).toEqual(["items", "page", "pageSize", "totalItems", "totalPages"]);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(["id", "ticketNumber", "createdAt", "updatedAt", "summary", "category", "requester", "requestedPriority", "itPriority", "status", "owner"].sort());
    expect(Object.keys(res.body.items[0].requester).sort()).toEqual(["email", "id", "name"]);
    expect(res.body.items[0].owner).toBeNull();
    expect(Object.keys(res.body.items[1].owner).sort()).toEqual(["id", "name"]);
    expect(Object.keys(res.body.items[0].category).sort()).toEqual(["id", "name"]);
  });

  it("allows Administrator queue access", async () => {
    expect((await admin.get("/api/staff/tickets").query({ search: marker })).status).toBe(200);
  });

  it("searches each documented field case-insensitively", async () => {
    for (const search of [`${marker}-T-000`, `${marker} Summary 0`, `${marker} Person 2`, `${marker}.2@example.test`]) {
      const res = await staff.get("/api/staff/tickets").query({ search: search.toUpperCase(), pageSize: 50 });
      expect(res.status).toBe(200);
      const expected = search.includes("Person") || search.includes("@") ? rows.filter(t => t.requesterId === requesterId) : rows.filter(t => t.ticketNumber.endsWith("-000"));
      expect(res.body.items.map((t: {id:number}) => t.id).sort()).toEqual(expected.map(t => t.id).sort());
    }
  });

  it("supports every filter and combines filters with AND", async () => {
    const cases = [
      { query: { category: categoryIds[0] }, expected: rows.filter(t => t.categoryId === categoryIds[0]) },
      ...priorities.flatMap(p => [
        { query: { requestedPriority: p }, expected: rows.filter(t => t.requestedPriority === p) },
        { query: { itPriority: p }, expected: rows.filter(t => t.itPriority === p) },
      ]),
      ...statuses.map(status => ({ query: { status }, expected: rows.filter(t => t.status === status) })),
      ...["unassigned", "me", staffId, adminId].map(owner => ({ query: { owner }, expected: rows.filter(t => t.ownerId === (owner === "unassigned" ? null : owner === "me" ? staffId : owner)) })),
      { query: { category: categoryIds[0], requestedPriority: "LOW", itPriority: "MEDIUM", status: "NEW", owner: "unassigned" }, expected: rows.filter(t => t.categoryId === categoryIds[0] && t.requestedPriority === "LOW" && t.itPriority === "MEDIUM" && t.status === "NEW" && t.ownerId === null) },
    ];
    for (const { query, expected } of cases) {
      const res = await staff.get("/api/staff/tickets").query({ search: marker, pageSize: 50, ...query });
      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(expected.length);
      expect(res.body.items.map((t: {id:number}) => t.id).sort()).toEqual(expected.map(t => t.id).sort());
    }
    const me = await admin.get("/api/staff/tickets").query({ search: marker, owner: "me", pageSize: 50 });
    expect(me.body.items.every((t: {owner:{id:number}}) => t.owner.id === adminId)).toBe(true);
  });

  it("supports all six sorts in both directions with deterministic ties", async () => {
    for (const field of ["ticketNumber", "createdAt", "updatedAt", "requestedPriority", "itPriority", "status"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        const res = await staff.get("/api/staff/tickets").query({ search: marker, sortBy: field, sortDir: direction, pageSize: 50 });
        expect(res.status).toBe(200);
        const expected = rows.slice().sort((a,b) => {
          const enumValues = field === "status" ? statusSortOrder : field.endsWith("Priority") ? priorities : null;
          const av = enumValues ? (enumValues as string[]).indexOf(String(a[field])) : a[field];
          const bv = enumValues ? (enumValues as string[]).indexOf(String(b[field])) : b[field];
          return (av < bv ? -1 : av > bv ? 1 : 0) * (direction === "asc" ? 1 : -1) || a.id - b.id;
        });
        expect(res.body.items.map((t:{id:number}) => t.id)).toEqual(expected.slice(0,50).map(t => t.id));
      }
    }
  });

  it.each([10,20,50])("paginates with page size %i", async pageSize => {
    const first = await staff.get("/api/staff/tickets").query({ search: marker, pageSize });
    const second = await staff.get("/api/staff/tickets").query({ search: marker, pageSize, page: 2 });
    expect(first.body.items).toHaveLength(pageSize);
    expect(second.body).toMatchObject({ page: 2, pageSize, totalItems: 55, totalPages: Math.ceil(55/pageSize) });
    expect(second.body.items).toHaveLength(Math.min(pageSize, 55-pageSize));
    expect(second.body.items.some((t:{id:number}) => first.body.items.some((f:{id:number}) => f.id === t.id))).toBe(false);
  });

  it("returns empty results and out-of-range pages without clamping", async () => {
    const empty = await staff.get("/api/staff/tickets").query({ search: `${marker}-missing` });
    expect(empty.body).toEqual({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
    const beyond = await staff.get("/api/staff/tickets").query({ search: marker, page: 100 });
    expect(beyond.body).toEqual({ items: [], page: 100, pageSize: 10, totalItems: 55, totalPages: 6 });
  });

  it("rejects invalid values with field errors", async () => {
    for (const [field, value] of [
      ["page", "0"], ["page", "-1"], ["page", "1.5"], ["page", "9007199254740992"],
      ["page", "1e2"], ["page", ""], ["pageSize", "15"], ["pageSize", "0"],
      ["category", "abc"], ["category", "-1"], ["requestedPriority", "URGENT"],
      ["itPriority", "high"], ["status", "UNKNOWN"], ["sortBy", "summary"],
      ["sortDir", "up"], ["owner", "anyone"], ["owner", "0"],
      ["owner", String(inactiveId)], ["owner", String(requesterId)], ["owner", "2147483647"],
      ["currentStatus", "NEW"], ["requesterId", String(requesterId)],
    ]) {
      const res = await staff.get("/api/staff/tickets").query({ [field]: value });
      expect(res.status, `${field}=${value}`).toBe(400);
      expect(res.body.error).toBe("INVALID_QUERY");
      expect(res.body.fields[field]).toEqual(expect.any(String));
    }
    for (const query of ["search=a&search=b", "owner[x]=1", "page=1&page=2"]) {
      const res = await staff.get(`/api/staff/tickets?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_QUERY");
    }
  });

  it("owners returns only safe fields for active Staff/Admin", async () => {
    for (const agent of [staff, admin]) {
      const res = await agent.get("/api/staff/owners");
      expect(res.status).toBe(200);
      expect(res.body.map((u:{id:number}) => u.id)).toEqual(expect.arrayContaining([staffId, adminId]));
      expect(res.body.map((u:{id:number}) => u.id)).not.toEqual(expect.arrayContaining([inactiveId]));
      for (const owner of res.body) {
        expect(Object.keys(owner).sort()).toEqual(["email", "id", "name", "role"]);
        expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(owner.role);
        expect(owner.id).not.toBe(requesterId);
      }
    }
  });

  it("returns safe unexpected-failure responses", async () => {
    const spy = vi.spyOn(prisma.ticket, "findMany").mockRejectedValueOnce(new Error("private database details"));
    try {
      const res = await staff.get("/api/staff/tickets");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "UNEXPECTED_ERROR" });
    } finally { spy.mockRestore(); }
  });
});
