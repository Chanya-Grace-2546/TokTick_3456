import { beforeAll, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { actionTicket, actionUser, origin, prisma } from "./helpers/actionsTestDatabase.js";
let owner: Awaited<ReturnType<typeof actionUser>>, other: typeof owner, staff: typeof owner, admin: typeof owner;
beforeAll(async () => { owner=await actionUser("REQUESTER");other=await actionUser("REQUESTER");staff=await actionUser("IT_STAFF");admin=await actionUser("ADMINISTRATOR"); });
const get=(id:number, actor=owner)=>request(app).get(`/api/tickets/${id}/status-history`).set("Cookie",actor.cookie);
it("returns authorized safe fields, newest-first events and retains earlier history",async()=>{
 const ticket=await actionTicket(owner.user.id);let earlier: unknown[]=[];
 for(const [oldStatus,status] of [["NEW","OPEN"],["OPEN","IN_PROGRESS"],["IN_PROGRESS","WAITING_FOR_REQUESTER"]]){
  const response=await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Cookie",staff.cookie).set("Origin",origin).send({status,expectedStatus:oldStatus});expect(response.status).toBe(200);
  const rows=await prisma.ticketStatusHistory.findMany({where:{ticketId:ticket.id},orderBy:{id:"asc"}});expect(rows.slice(0,earlier.length)).toEqual(earlier);expect(rows).toHaveLength(earlier.length+1);earlier=structuredClone(rows);
 }
 const expected=await prisma.ticketStatusHistory.findMany({where:{ticketId:ticket.id},orderBy:[{occurredAt:"desc"},{id:"desc"}],select:{id:true,oldStatus:true,newStatus:true,occurredAt:true,actor:{select:{name:true,role:true}}}});
 for(const person of [owner,staff,admin]){const result=await get(ticket.id,person);expect(result.status).toBe(200);expect(result.body).toEqual({items:JSON.parse(JSON.stringify(expected))});}
 expect((await get(ticket.id,other)).status).toBe(404);expect((await get(2147483647)).status).toBe(404);
 expect((await request(app).get(`/api/tickets/${ticket.id}/status-history`)).status).toBe(401);
});
it("uses descending ID to break tied timestamps and returns an empty legacy history",async()=>{
 const ticket=await actionTicket(owner.user.id);expect((await get(ticket.id)).body).toEqual({items:[]});const occurredAt=new Date("2026-11-01T00:00:00Z");
 const first=await prisma.ticketStatusHistory.create({data:{ticketId:ticket.id,actorUserId:staff.user.id,oldStatus:"NEW",newStatus:"OPEN",occurredAt}});
 const second=await prisma.ticketStatusHistory.create({data:{ticketId:ticket.id,actorUserId:admin.user.id,oldStatus:"OPEN",newStatus:"IN_PROGRESS",occurredAt}});
 const result=await get(ticket.id);expect(result.body.items.map((event:{id:number})=>event.id)).toEqual([second.id,first.id]);
});
it.each([{isActive:false},{mustChangePassword:true}])("rejects restricted sessions %j",async overrides=>{const actor=await actionUser("IT_STAFF",overrides);const ticket=await actionTicket(owner.user.id);expect((await get(ticket.id,actor)).status).toBe(overrides.isActive===false?401:403);});
it("rejects expired sessions and safely handles invalid IDs",async()=>{const actor=await actionUser("IT_STAFF");await prisma.session.update({where:{id:actor.session.id},data:{expiresAt:new Date(0)}});expect((await get(1,actor)).status).toBe(401);expect((await request(app).get('/api/tickets/invalid/status-history').set('Cookie',staff.cookie)).status).toBe(400);});

it("returns safe errors and exposes no history mutation route",async()=>{
 const ticket=await actionTicket(owner.user.id);const failure=vi.spyOn(prisma.ticketStatusHistory,"findMany").mockRejectedValueOnce(new Error("PRIVATE SQL"));
 try {const result=await get(ticket.id);expect(result.status).toBe(500);expect(result.body).toEqual({error:"UNEXPECTED_ERROR"});}finally{failure.mockRestore();}
 expect((await request(app).post(`/api/tickets/${ticket.id}/status-history`).set('Cookie',staff.cookie).set('Origin',origin).send({newStatus:'CLOSED'})).status).toBe(404);
 expect(await prisma.ticketStatusHistory.count({where:{ticketId:ticket.id}})).toBe(0);
});
