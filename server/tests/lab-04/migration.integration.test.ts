import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationDatabase } from "./helpers/migrationDatabase.js";
const fixture = migrationDatabase();
const prisma = fixture.prisma;
const tables = ["User", "Ticket", "Attachment", "PublicComment", "InternalNote", "Session", "Category", "RelatedSystem"] as const;
async function snapshot() {
  return Promise.all(tables.map(table => prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)));
}
async function allRows() {
  return [...await snapshot(), ...await Promise.all(["ActionTaken", "ActionTakenHistory", "TicketStatusHistory", "ActionIdempotencyKey"].map(table => prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)))];
}
let baseline: Awaited<ReturnType<typeof snapshot>>;
let restore: () => Promise<void>;
beforeAll(async () => {
  await fixture.deploy("lab3");
  const user = await prisma.user.create({ data: { name: "Historical", email: "historical@lab4.test", passwordHash: "unchanged", role: "IT_STAFF" } });
  const category = await prisma.category.create({ data: { name: "Historical" } });
  const system = await prisma.relatedSystem.create({ data: { name: "Historical" } });
  const ticket = await prisma.ticket.create({ data: { ticketNumber: "HISTORICAL-LAB3", requesterId: user.id, ownerId: user.id,
    categoryId: category.id, relatedSystemId: system.id, summary: "Original", description: "Preserve", requestedPriority: "HIGH", status: "RESOLVED" } });
  await prisma.attachment.create({ data: { ticketId: ticket.id, fileName: "original.txt", storedFileName: "historical.txt", mimeType: "text/plain", sizeBytes: 4 } });
  await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: user.id, content: "Public history" } });
  await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: user.id, content: "Private history" } });
  await prisma.session.create({ data: { userId: user.id, tokenHash: "historical-token", expiresAt: new Date("2030-01-01Z") } });
  baseline = await snapshot();
  restore = await fixture.backup();
  await fixture.deploy("lab4");
}, 65000);
afterAll(() => fixture.dispose());

describe("MIG-01/MIG-02 Lab 3 to Lab 4 additive migration", () => {
  it("preserves complete legacy rows and all eight Ticket statuses without Ticket version", async () => {
    expect(await snapshot()).toEqual(baseline);
    expect(await prisma.actionTaken.count()).toBe(0);
    expect(await prisma.ticketStatusHistory.count()).toBe(0);
    const statuses = await prisma.$queryRaw<{ enumlabel: string }[]>`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='TicketStatus' AND n.nspname=current_schema()`;
    expect(statuses.map(s => s.enumlabel).sort()).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"].sort());
    expect(await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Ticket' AND column_name='version'`).toEqual([]);
  });
  it("seed repeats preserve IDs, existing data and edited demo Actions", async () => {
    await fixture.seed();
    const first = await allRows();
    await fixture.seed();
    expect(await allRows()).toEqual(first);
    expect(await prisma.actionTaken.count()).toBe(5);
    expect(await prisma.actionTakenHistory.count()).toBe(5);
    const multi = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: "TKT-2026-000001" }, include: { actionsTaken: true } });
    expect(multi.actionsTaken).toHaveLength(4);
    expect(new Set(multi.actionsTaken.map(a => a.state)).size).toBe(4);
    expect(await prisma.actionTaken.count({ where: { ticket: { ticketNumber: "TKT-2026-000003" } } })).toBe(1);
    expect(await prisma.actionTaken.count({ where: { ticket: { ticketNumber: "TKT-2026-000002" } } })).toBe(0);
    const action = multi.actionsTaken.find(a => a.state === "PLANNED")!;
    await prisma.actionTaken.update({ where: { id: action.id }, data: { description: "User edited demo", version: 2 } });
    const alex = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@toktickit.local" } });
    await prisma.user.update({ where: { id: alex.id }, data: { name: "Edited profile", isActive: false } });
    const category = await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" } });
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    const edited = await allRows();
    await fixture.seed();
    expect(await allRows()).toEqual(edited);
    for (const [i, table] of tables.entries()) {
      const ids = (baseline[i] as { id: number }[]).map(row => row.id);
      expect(await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE id = ANY($1::int[]) ORDER BY id`, ids)).toEqual(baseline[i]);
    }
  }, 65000);
  it("restores the pre-migration backup in its disposable schema and reapplies safely", async () => {
    await restore();
    expect(await snapshot()).toEqual(baseline);
    expect(await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='ActionTaken'`).toEqual([]);
    await fixture.deploy("lab4");
    expect(await snapshot()).toEqual(baseline);
    expect(await prisma.actionTaken.count()).toBe(0);
  }, 65000);
});
