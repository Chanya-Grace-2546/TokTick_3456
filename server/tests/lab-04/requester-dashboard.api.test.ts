import { beforeAll,afterAll,expect,it,vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { actionUser,actionTicket,prisma } from "./helpers/actionsTestDatabase.js";
type Person=Awaited<ReturnType<typeof actionUser>>;
let a:Person,b:Person,empty:Person,staff:Person,admin:Person,inactive:Person,expired:Person,initial:Person;
const ids:number[]=[],now=new Date("2026-10-27T17:00:00.123Z");
const get=(path:string,actor=a)=>request(app).get(path).set("Cookie",actor.cookie);
beforeAll(async()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  a=await actionUser("REQUESTER");b=await actionUser("REQUESTER");empty=await actionUser("REQUESTER");staff=await actionUser("IT_STAFF");admin=await actionUser("ADMINISTRATOR");inactive=await actionUser("REQUESTER",{isActive:false});initial=await actionUser("REQUESTER",{mustChangePassword:true});expired=await actionUser("REQUESTER");
  await prisma.session.update({where:{id:expired.session.id},data:{expiresAt:new Date(now.getTime()-1)}});
  const statuses=["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","REOPENED","RESOLVED","CLOSED","CANCELLED"] as const;
  for(const [index,status] of statuses.entries()){
    const ticket=await actionTicket(a.user.id);ids.push(ticket.id);
    await prisma.ticket.update({where:{id:ticket.id},data:{status,createdAt:new Date(now.getTime()-index*1000),updatedAt:index===0?new Date(now.getTime()-7*86400000):index===1?new Date(now.getTime()-7*86400000-1):index===2?new Date(now.getTime()+1):now}});
  }
  const foreignResolved=await actionTicket(b.user.id);await prisma.ticket.update({where:{id:foreignResolved.id},data:{status:"RESOLVED",summary:"FOREIGN RESOLVED SUMMARY",updatedAt:now}});
  const foreign=await actionTicket(b.user.id);await prisma.ticket.update({where:{id:foreign.id},data:{status:"WAITING_FOR_REQUESTER",summary:"FOREIGN PRIVATE SUMMARY",updatedAt:now}});
});
afterAll(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it("returns the exact own-only DTO and full-time metrics, with independent bounded recent lists",async()=>{
  const res=await get("/api/dashboard/requester");expect(res.status).toBe(200);
  expect(Object.keys(res.body).sort()).toEqual(["asOf","recentWindowDays","metrics","recentlyUpdated","recentlyResolved","drillDown"].sort());
  expect(res.body.metrics).toEqual({openTickets:5,waitingForRequester:1});expect(res.body.asOf).toBe(now.toISOString());expect(res.body.recentWindowDays).toBe(7);
  expect(res.body.recentlyUpdated.map((t:{id:number})=>t.id)).toEqual([ids[7],ids[6],ids[5],ids[4],ids[3]]);
  expect(res.body.recentlyResolved.map((t:{id:number})=>t.id)).toEqual([ids[5]]);
  expect(Object.keys(res.body.recentlyResolved[0]).sort()).toEqual(["id","ticketNumber","summary","status","updatedAt","href"].sort());
  expect(JSON.stringify(res.body)).not.toContain("FOREIGN");expect(res.body.recentlyResolved[0].href).toBe(`/tickets/${ids[5]}`);
});
it("includes the exact seven-day boundary and excludes future/older records",async()=>{
  try{await prisma.ticket.update({where:{id:ids[7]},data:{updatedAt:new Date(now.getTime()-8*86400000)}});
    const res=await get("/api/dashboard/requester");expect(res.body.recentlyUpdated.map((t:{id:number})=>t.id)).toEqual([ids[6],ids[5],ids[4],ids[3],ids[0]]);
  }finally{await prisma.ticket.update({where:{id:ids[7]},data:{updatedAt:now}});}
});
it("isolates Requesters even with supplied identities and rejects direct foreign Ticket access",async()=>{
  const other=await get("/api/dashboard/requester",b);expect(other.body.metrics).toEqual({openTickets:1,waitingForRequester:1});
  const spoof=await get(`/api/dashboard/requester?userId=${b.user.id}&requesterId=${b.user.id}`);expect(spoof.body.metrics).toEqual({openTickets:5,waitingForRequester:1});
  expect((await get(`/api/tickets/${other.body.recentlyUpdated[0].id}`)).status).toBe(404);
  const legacy=await get(`/api/tickets?requesterId=${b.user.id}&pageSize=50`);expect(legacy.status).toBe(200);expect(legacy.body.items.map((t:{id:number})=>t.id).sort((x:number,y:number)=>x-y)).toEqual(ids);
});
it("preserves aliases, AND filtering, legacy pagination and response envelopes",async()=>{
  for(const suffix of ["status=OPEN","currentStatus=OPEN","status=OPEN&currentStatus=OPEN"]){const res=await get(`/api/tickets?${suffix}`);expect(res.status).toBe(200);expect(res.body.items.map((t:{id:number})=>t.id)).toEqual([ids[1]]);}
  expect((await get("/api/tickets?status=OPEN&currentStatus=RESOLVED")).body.error).toBe("INVALID_QUERY");
  expect((await get("/api/tickets?status=RESOLVED&statusGroup=open")).body.totalItems).toBe(0);
  const list=await get("/api/tickets?pageSize=2");expect(list.body).toMatchObject({page:1,pageSize:2,totalItems:8,totalPages:4,noResults:false});expect(list.body.items).toHaveLength(2);
  expect(Object.keys(list.body).sort()).toEqual(["items","page","pageSize","totalItems","totalPages","noResults"].sort());
});
it.each(["userId=1","statusGroup=closed","status=INVALID","status=OPEN&status=OPEN","myAction=true"])("rejects unsupported requester list query %s",async query=>{expect((await get(`/api/tickets?${query}`)).status).toBe(400);});
it("returns zero metrics and empty lists for a Requester without Tickets",async()=>{const res=await get("/api/dashboard/requester",empty);expect(res.body.metrics).toEqual({openTickets:0,waitingForRequester:0});expect(res.body.recentlyUpdated).toEqual([]);expect(res.body.recentlyResolved).toEqual([]);});
it("enforces requester-only access and all authentication gates",async()=>{
  expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
  for(const [actor,status] of [[staff,403],[admin,403],[inactive,401],[expired,401],[initial,403]] as const)expect((await get("/api/dashboard/requester",actor)).status).toBe(status);
});
it("reports unexpected failures safely",async()=>{const spy=vi.spyOn(prisma,"$transaction").mockRejectedValueOnce(new Error("PRIVATE SQL")),log=vi.spyOn(console,"error").mockImplementation(()=>{});try{const res=await get("/api/dashboard/requester");expect(res.status).toBe(500);expect(res.body).toEqual({error:"UNEXPECTED_ERROR"});expect(log).toHaveBeenCalledWith("Requester dashboard could not be loaded.");}finally{spy.mockRestore();log.mockRestore();}});
it("keeps complete multi-page drill-down sets equal to both metrics",async()=>{
  const added:number[]=[];
  for(let i=0;i<12;i++){const ticket=await actionTicket(a.user.id);added.push(ticket.id);await prisma.ticket.update({where:{id:ticket.id},data:{status:"WAITING_FOR_REQUESTER",createdAt:new Date(now.getTime()-10000-i*1000)}});}
  const dash=(await get("/api/dashboard/requester")).body;
  for(const key of ["openTickets","waitingForRequester"] as const){let page=1,pages=1;const found:number[]=[];
    do{const list=await get(`/api${dash.drillDown[key]}&pageSize=2&page=${page++}`);expect(list.status).toBe(200);expect(list.body.totalItems).toBe(dash.metrics[key]);pages=list.body.totalPages;found.push(...list.body.items.map((t:{id:number})=>t.id));}while(page<=pages);
    expect(found.sort((x,y)=>x-y)).toEqual([...(key==="openTickets"?ids.slice(0,5):[ids[3]]),...added].sort((x,y)=>x-y));expect(new Set(found).size).toBe(found.length);
  }
});

it("applies the same inclusive boundaries to Recently Resolved",async()=>{
  const set=(updatedAt:Date)=>prisma.ticket.update({where:{id:ids[5]},data:{updatedAt}});
  try{
    await set(new Date(now.getTime()-7*86400000));expect((await get("/api/dashboard/requester")).body.recentlyResolved.map((t:{id:number})=>t.id)).toEqual([ids[5]]);
    await set(new Date(now.getTime()-7*86400000-1));expect((await get("/api/dashboard/requester")).body.recentlyResolved).toEqual([]);
    await set(new Date(now.getTime()+1));expect((await get("/api/dashboard/requester")).body.recentlyResolved).toEqual([]);
  }finally{await set(now);}
});
it("independently caps and orders tied Recently Resolved Tickets by descending ID",async()=>{
  const added:number[]=[];
  try{
    for(let i=0;i<6;i++){const ticket=await actionTicket(a.user.id);added.push(ticket.id);await prisma.ticket.update({where:{id:ticket.id},data:{status:"RESOLVED",updatedAt:now}});}
    const res=await get("/api/dashboard/requester");expect(res.body.recentlyResolved.map((t:{id:number})=>t.id)).toEqual(added.slice().reverse().slice(0,5));expect(res.body.recentlyUpdated).toHaveLength(5);
  }finally{await prisma.ticket.deleteMany({where:{id:{in:added}}});}
});
