import { beforeAll, afterAll, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { actionUser, actionTicket, prisma } from "./helpers/actionsTestDatabase.js";
type Person = Awaited<ReturnType<typeof actionUser>>;
let staff: Person, admin: Person, requester: Person, inactive: Person, initial: Person, expired: Person;
let ids: number[] = [];
const now = new Date("2026-10-26T10:00:00.000Z");
const get = (path: string, person = staff) => request(app).get(path).set("Cookie", person.cookie);
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  staff = await actionUser("IT_STAFF"); admin = await actionUser("ADMINISTRATOR"); requester = await actionUser("REQUESTER");
  inactive = await actionUser("IT_STAFF", { isActive: false }); initial = await actionUser("IT_STAFF", { mustChangePassword: true }); expired = await actionUser("IT_STAFF");
  await prisma.session.update({ where: { id: expired.session.id }, data: { expiresAt: new Date(now.getTime() - 1) } });
  const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
  for (const [i, status] of statuses.entries()) {
    const ticket = await actionTicket(requester.user.id, i === 0 ? null : i === 4 ? admin.user.id : staff.user.id); ids.push(ticket.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status, itPriority: i % 2 ? "LOW" : "HIGH", updatedAt: i === 0 ? new Date(now.getTime() - 7 * 86400000) : i === 1 ? new Date(now.getTime() - 7 * 86400000 - 1) : i === 2 ? new Date(now.getTime() + 1) : now } });
  }
  await prisma.actionTaken.createMany({ data: [
    { ticketId: ids[0], performedByUserId: admin.user.id, assignedToUserId: staff.user.id, description: "Assigned to staff" },
    { ticketId: ids[0], performedByUserId: admin.user.id, assignedToUserId: staff.user.id, description: "Same Ticket, second unfinished Action", state: "IN_PROGRESS" },
    { ticketId: ids[4], performedByUserId: admin.user.id, assignedToUserId: staff.user.id, description: "Legacy resolved Ticket with unfinished work" },
    { ticketId: ids[1], performedByUserId: staff.user.id, assignedToUserId: admin.user.id, description: "Performer alone does not count" },
    { ticketId: ids[3], performedByUserId: staff.user.id, assignedToUserId: staff.user.id, description: "Completed assignment excluded", state: "COMPLETED", result: "Done" },
    { ticketId: ids[5], performedByUserId: staff.user.id, assignedToUserId: staff.user.id, description: "Cancelled assignment excluded", state: "CANCELLED" },
  ] });
});
afterAll(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("returns exact metrics, full-scope zero-filled breakdowns and bounded wire DTOs", async () => {
  const res = await get("/api/dashboard/staff"); expect(res.status).toBe(200);
  expect(res.body.metrics).toEqual({ unassignedTickets: 1, myOwnedTickets: 4, ticketsWithMyActions: 2, urgentOpenTickets: 3 });
  expect(res.body.byStatus).toEqual(Object.fromEntries(["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","RESOLVED","CLOSED","REOPENED","CANCELLED"].map(s => [s,1])));
  expect(res.body.byPriority).toEqual([{ priority: "LOW", count: 4 }, { priority: "MEDIUM", count: 0 }, { priority: "HIGH", count: 4 }]);
  expect(res.body.asOf).toBe(now.toISOString()); expect(res.body.recentTickets.map((t: { id: number }) => t.id)).toEqual([ids[7],ids[6],ids[5],ids[4],ids[3]]);
  expect(Object.keys(res.body.recentTickets[0]).sort()).toEqual(["id","ticketNumber","summary","status","updatedAt","href"].sort());
});
it("includes the exact seven-day boundary, excludes older/future rows and breaks ties by descending ID", async () => {
  // Exclude one tied row from the window so the exact boundary enters the top 5.
  const original = await prisma.ticket.findUniqueOrThrow({ where: { id: ids[7] } });
  try {
    await prisma.ticket.update({ where: { id: ids[7] }, data: { updatedAt: new Date(now.getTime() - 8 * 86400000) } });
    const res = await get("/api/dashboard/staff"); expect(res.body.recentTickets.map((t: { id: number }) => t.id)).toEqual([ids[6],ids[5],ids[4],ids[3],ids[0]]);
  } finally { await prisma.ticket.update({ where: { id: ids[7] }, data: { updatedAt: original.updatedAt } }); }
});
it("matches every metric's complete drill-down set and preserves the Queue envelope", async () => {
  const dashboard = (await get("/api/dashboard/staff")).body;
  const expected: Record<string, number[]> = { unassignedTickets: [ids[0]], myOwnedTickets: [ids[1],ids[2],ids[3],ids[6]], ticketsWithMyActions: [ids[0],ids[4]], urgentOpenTickets: [ids[0],ids[2],ids[6]] };
  for (const [key, href] of Object.entries(dashboard.drillDown)) {
    const list = await get(`/api${href as string}`); expect(list.status).toBe(200);
    expect(list.body.totalItems).toBe(dashboard.metrics[key]); expect(list.body.items.map((t: {id:number})=>t.id).sort((a:number,b:number)=>a-b)).toEqual(expected[key]);
    expect(Object.keys(list.body).sort()).toEqual(["items","page","pageSize","totalItems","totalPages"].sort());
  }
  expect((await get("/api/staff/tickets?statusGroup=open&status=RESOLVED")).body.totalItems).toBe(0);
});
it("uses the Administrator's own assignment/ownership identity", async () => {
  const res = await get("/api/dashboard/staff", admin); expect(res.status).toBe(200);
  expect(res.body.metrics.myOwnedTickets).toBe(0); expect(res.body.metrics.ticketsWithMyActions).toBe(1);
});
it.each(["statusGroup=closed","myAction=false","myAction=1","statusGroup=open&statusGroup=open","myAction=true&myAction=true","userId=1"])("rejects invalid Queue filter %s", async query => {
  const res = await get(`/api/staff/tickets?${query}`); expect(res.status).toBe(400); expect(res.body.error).toBe("INVALID_QUERY");
});
it("enforces authentication and role/password gates", async () => {
  expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
  for (const [person,status] of [[requester,403],[inactive,401],[initial,403],[expired,401]] as const) expect((await get("/api/dashboard/staff",person)).status).toBe(status);
});
it("returns only safe unexpected-failure diagnostics", async () => {
  const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("PRIVATE SQL CREDENTIALS")); const log = vi.spyOn(console,"error").mockImplementation(()=>{});
  try { const res = await get("/api/dashboard/staff"); expect(res.status).toBe(500); expect(res.body).toEqual({error:"UNEXPECTED_ERROR"}); expect(log).toHaveBeenCalledWith("Staff dashboard could not be loaded."); }
  finally { spy.mockRestore(); log.mockRestore(); }
});
it("keeps complete paginated drill-downs and status/priority breakdown destinations consistent", async () => {
  const added: number[] = [];
  for (let i=0;i<12;i++) {
    const ticket = await actionTicket(requester.user.id,staff.user.id); added.push(ticket.id);
    await prisma.ticket.update({where:{id:ticket.id},data:{status:"OPEN"}});
    await prisma.actionTaken.create({data:{ticketId:ticket.id,performedByUserId:admin.user.id,assignedToUserId:staff.user.id,description:"Paginated workload"}});
  }
  const dashboard = (await get("/api/dashboard/staff")).body;
  for (const key of ["myOwnedTickets","ticketsWithMyActions"] as const) {
    const expected = [...(key === "myOwnedTickets" ? [ids[1],ids[2],ids[3],ids[6]] : [ids[0],ids[4]]),...added];
    const found:number[]=[]; let page=1,totalPages=1;
    do {
      const res=await get(`/api${dashboard.drillDown[key]}&pageSize=10&page=${page}`); expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(dashboard.metrics[key]); totalPages=res.body.totalPages; found.push(...res.body.items.map((t:{id:number})=>t.id));page++;
    } while(page<=totalPages);
    expect(totalPages).toBeGreaterThan(1);expect(found.sort((a,b)=>a-b)).toEqual(expected.sort((a,b)=>a-b));expect(new Set(found).size).toBe(found.length);
  }
  for(const [status,count] of Object.entries(dashboard.byStatus)) expect((await get(`/api/staff/tickets?status=${status}`)).body.totalItems).toBe(count);
  for(const {priority,count} of dashboard.byPriority) expect((await get(`/api/staff/tickets?itPriority=${priority}`)).body.totalItems).toBe(count);
});
it("returns zero metrics and all enum zero buckets on an empty database", async () => {
  await prisma.actionTaken.deleteMany(); await prisma.ticket.deleteMany();
  const res = await get("/api/dashboard/staff"); expect(res.status).toBe(200);
  expect(Object.values(res.body.metrics)).toEqual([0,0,0,0]); expect(Object.values(res.body.byStatus)).toEqual([0,0,0,0,0,0,0,0]); expect(res.body.byPriority.map((p:{count:number})=>p.count)).toEqual([0,0,0]); expect(res.body.recentTickets).toEqual([]);
});
