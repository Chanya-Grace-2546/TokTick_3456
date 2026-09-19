import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { historicalDatabase } from "./helpers/historicalDatabase.js";

describe("MIG-01–04 populated historical migration and seed", () => {
  const fixture = historicalDatabase();
  const prisma = fixture.prisma;
  type Snapshot = { requesters: unknown[]; tickets: any[]; attachments: any[]; categories: unknown[]; systems: unknown[] };
  let before: Snapshot;
  let after: Snapshot;
  const fileBytes = Buffer.from("Historical attachment bytes: must survive migration and seed.");
  const file = join(fixture.directory, "uploads", "historical.pdf");
  let afterFirstSeed: Record<string, number>;
  let afterSecondSeed: Record<string, number>;
  let historicalTicketsAfterSeed: any[];
  let userIdentityAfterFirstSeed: unknown;
  let userIdentityAfterSecondSeed: unknown;
  let seededUsers: Awaited<ReturnType<typeof prisma.user.findMany>>;

  async function snapshot(migrated: boolean): Promise<Snapshot> {
    return {
      requesters: await prisma.$queryRawUnsafe(`SELECT id, name, email, "isActive" FROM "${migrated ? "User" : "DevelopmentRequester"}" WHERE id IN (41,42) ORDER BY id`),
      tickets: await prisma.$queryRawUnsafe('SELECT id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description, "requestedPriority", "itPriority", status, "createdAt", "updatedAt" FROM "Ticket" WHERE id IN (101,102,103) ORDER BY id'),
      attachments: await prisma.$queryRawUnsafe('SELECT * FROM "Attachment" ORDER BY id'),
      categories: await prisma.$queryRawUnsafe('SELECT * FROM "Category" ORDER BY id'),
      systems: await prisma.$queryRawUnsafe('SELECT * FROM "RelatedSystem" ORDER BY id'),
    };
  }
  async function counts() {
    return { users: await prisma.user.count(), tickets: await prisma.ticket.count(), attachments: await prisma.attachment.count(), categories: await prisma.category.count(), systems: await prisma.relatedSystem.count(), comments: await prisma.publicComment.count(), notes: await prisma.internalNote.count() };
  }
  beforeAll(async () => {
    fixture.deploy("lab2");
    await prisma.$executeRawUnsafe(`INSERT INTO "Category" (id,name) VALUES (1,'Hardware')`);
    await prisma.$executeRawUnsafe(`INSERT INTO "RelatedSystem" (id,name) VALUES (1,'Corporate Laptop')`);
    await prisma.$executeRawUnsafe(`INSERT INTO "DevelopmentRequester" (id,name,email,"isActive") VALUES (41,'Historical Active','history.active@example.test',true),(42,'Historical Inactive','history.inactive@example.test',false)`);
    for (const [id, requested, requester] of [[101, "HIGH", 41], [102, "LOW", 42], [103, "MEDIUM", 41]] as const) {
      await prisma.$executeRawUnsafe(`INSERT INTO "Ticket" (id,"ticketNumber","requesterId","categoryId","relatedSystemId",summary,description,"requestedPriority","itPriority","updatedAt") VALUES ($1,$2,$3,1,1,$4,'Historical content must survive',$5::"Priority",'MEDIUM',TIMESTAMP '2026-09-01 00:00:00')`, id, `TKT-2026-${String(id - 100).padStart(6, "0")}`, requester, `Historical ${requested}`, requested);
    }
    await prisma.$executeRawUnsafe(`INSERT INTO "Attachment" (id,"ticketId","fileName","storedFileName","mimeType","sizeBytes") VALUES (201,101,'original.pdf','historical.pdf','application/pdf',$1)`, fileBytes.length);
    mkdirSync(join(fixture.directory, "uploads"));
    writeFileSync(file, fileBytes);
    // Explicit fixture IDs must not collide with later seed inserts.
    for (const table of ["Category", "RelatedSystem", "DevelopmentRequester", "Ticket", "Attachment"]) {
      await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),(SELECT MAX(id) FROM "${table}"))`);
    }
    before = await snapshot(false);
    fixture.deploy("lab3");
    after = await snapshot(true);
  }, 65_000);
  afterAll(async () => { await fixture.dispose(); });

  it("MIG-01: preserves all historical requester IDs, identity and activation as mandatory-change Requester Users", async () => {
    expect(after.requesters).toEqual(before.requesters);
    const users = await prisma.user.findMany({ where: { id: { in: [41, 42] } } });
    expect(users).toHaveLength(2);
    for (const user of users) {
      expect(user.role).toBe("REQUESTER");
      expect(user.mustChangePassword).toBe(true);
      expect(bcrypt.getRounds(user.passwordHash)).toBe(12);
    }
  });

  it("MIG-02: preserves counts, ticket content/numbers/ownership, references and actual attachment bytes without orphans", async () => {
    expect(after.tickets.map(({ itPriority: _ignored, ...ticket }) => ticket)).toEqual(before.tickets.map(({ itPriority: _ignored, ...ticket }) => ticket));
    expect(after.attachments).toEqual(before.attachments);
    expect(after.categories).toEqual(before.categories);
    expect(after.systems).toEqual(before.systems);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.ticket.count()).toBe(3);
    expect(await prisma.attachment.count()).toBe(1);
    const orphans = await prisma.$queryRawUnsafe<any[]>(`SELECT t.id FROM "Ticket" t LEFT JOIN "User" u ON t."requesterId"=u.id LEFT JOIN "Category" c ON t."categoryId"=c.id LEFT JOIN "RelatedSystem" s ON t."relatedSystemId"=s.id WHERE u.id IS NULL OR c.id IS NULL OR s.id IS NULL`);
    expect(orphans).toEqual([]);
    expect(await prisma.$queryRawUnsafe(`SELECT a.id FROM "Attachment" a LEFT JOIN "Ticket" t ON a."ticketId"=t.id WHERE t.id IS NULL`)).toEqual([]);
    expect(readFileSync(file)).toEqual(fileBytes);
  });

  it("MIG-03: backfills only the identified pre-Lab-3 differences (101 HIGH, 102 LOW; 103 already matches)", () => {
    const required = before.tickets.filter(ticket => ticket.itPriority !== ticket.requestedPriority);
    expect(required.map(ticket => ({ id: ticket.id, from: ticket.itPriority, to: ticket.requestedPriority }))).toEqual([
      { id: 101, from: "MEDIUM", to: "HIGH" }, { id: 102, from: "MEDIUM", to: "LOW" },
    ]);
    expect(after.tickets.map(ticket => ({ id: ticket.id, itPriority: ticket.itPriority }))).toEqual([
      { id: 101, itPriority: "HIGH" }, { id: 102, itPriority: "LOW" }, { id: 103, itPriority: "MEDIUM" },
    ]);
  });

  it("MIG-03 safety: redeploy never overwrites legitimate post-Lab-3 changes, including changes on historical Tickets", async () => {
    await prisma.ticket.update({ where: { id: 103 }, data: { itPriority: "HIGH" } });
    const fresh = await prisma.ticket.create({ data: { ticketNumber: "POST-LAB3", requesterId: 41, categoryId: 1, relatedSystemId: 1, summary: "After migration", description: "Legitimate staff priority", requestedPriority: "LOW", itPriority: "HIGH" } });
    fixture.deploy("lab3");
    for (const id of [103, fresh.id]) expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).itPriority).toBe("HIGH");
  });

  describe("MIG-04 actual seed reruns", () => {
    beforeAll(async () => {
      fixture.seed();
      afterFirstSeed = await counts();
      userIdentityAfterFirstSeed = await prisma.user.findMany({ select: { id: true, email: true, passwordHash: true, mustChangePassword: true }, orderBy: { id: "asc" } });
      fixture.seed();
      afterSecondSeed = await counts();
      userIdentityAfterSecondSeed = await prisma.user.findMany({ select: { id: true, email: true, passwordHash: true, mustChangePassword: true }, orderBy: { id: "asc" } });
      historicalTicketsAfterSeed = (await snapshot(true)).tickets;
      seededUsers = await prisma.user.findMany();
    }, 65_000);
    it("MIG-04: rerunning seed does not duplicate Users/reference data/Tickets/Comments/Notes or reset credentials", () => {
      expect(afterSecondSeed).toEqual(afterFirstSeed);
      expect(afterSecondSeed.tickets).toBeGreaterThan(10);
      expect(userIdentityAfterSecondSeed).toEqual(userIdentityAfterFirstSeed);
      for (const [role, active, minimum] of [["REQUESTER", true, 4], ["REQUESTER", false, 1], ["IT_STAFF", true, 3], ["IT_STAFF", false, 1], ["ADMINISTRATOR", true, 1]] as const) {
        expect(seededUsers.filter(user => user.role === role && user.isActive === active).length).toBeGreaterThanOrEqual(minimum);
      }
    });
    it("AC-09/BR-54: seeding does not replace historical Ticket requester, number or submitted content", () => {
      const preserved = (tickets: any[]) => tickets.map(({ id, ticketNumber, requesterId, categoryId, relatedSystemId, summary, description, requestedPriority }) => ({ id, ticketNumber, requesterId, categoryId, relatedSystemId, summary, description, requestedPriority }));
      expect(preserved(historicalTicketsAfterSeed)).toEqual(preserved(before.tickets));
      expect(readFileSync(file)).toEqual(fileBytes);
    });
  });
});
