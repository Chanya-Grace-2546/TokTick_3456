import { expect, it } from "vitest";
import request from "supertest";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { app } from "../../src/app.js";
import { actionUser, prisma } from "./helpers/actionsTestDatabase.js";
it("PERF-01/02: staff/requester dashboards p95 <=2s on 1000 Tickets / 3000 Actions over 30 warmed requests", async () => {
  const staff = await actionUser("IT_STAFF"), requester = await actionUser("REQUESTER"), other = await actionUser("REQUESTER");
  const category = await prisma.category.findFirstOrThrow(), system = await prisma.relatedSystem.findFirstOrThrow();
  const statuses=["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","RESOLVED","CLOSED","REOPENED","CANCELLED"] as const;
  const priorities=["LOW","MEDIUM","HIGH"] as const;
  await prisma.ticket.createMany({data:Array.from({length:1000},(_,i)=>({ticketNumber:`PERF-${i}`,requesterId:i%2?other.user.id:requester.user.id,ownerId:i%2?staff.user.id:null,categoryId:category.id,relatedSystemId:system.id,summary:`Performance Ticket ${i}`,description:"Isolated performance fixture",requestedPriority:priorities[i%3],itPriority:priorities[i%3],status:statuses[i%8]}))});
  const tickets=await prisma.ticket.findMany({select:{id:true}});
  await prisma.actionTaken.createMany({data:tickets.flatMap(ticket=>Array.from({length:3},(_,i)=>({ticketId:ticket.id,performedByUserId:staff.user.id,assignedToUserId:staff.user.id,description:`Performance Action ${i}`,state:i===0?"PLANNED" as const:"IN_PROGRESS" as const})))});
  const reads: { take?: number }[] = [];
  prisma.$use(async (params, next) => { if (params.model === "Ticket" && params.action === "findMany") reads.push(params.args); return next(params); });
  const [postgres] = await prisma.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version') AS version`;
  for (const [endpoint,actor] of [["staff",staff],["requester",requester]] as const) {
    const fetch=()=>request(app).get(`/api/dashboard/${endpoint}`).set("Cookie",actor.cookie);
    for(let i=0;i<3;i++)expect((await fetch()).status).toBe(200);
    const times:number[]=[];
    for(let i=0;i<30;i++) {
      const start=performance.now(),res=await fetch();times.push(performance.now()-start);expect(res.status).toBe(200);
      if(endpoint==="staff"){expect(res.body.recentTickets.length).toBeLessThanOrEqual(5);expect(res.body.metrics.ticketsWithMyActions).toBe(1000);}
      else {expect(res.body.metrics).toEqual({openTickets:375,waitingForRequester:0});expect(res.body.recentlyUpdated.length).toBeLessThanOrEqual(5);expect(res.body.recentlyResolved.length).toBeLessThanOrEqual(5);}
    }
    const p95=times.sort((a,b)=>a-b)[Math.ceil(times.length*.95)-1];
    process.stdout.write(JSON.stringify({test:`${endpoint}-dashboard-performance`,tickets:1000,actions:3000,warmedRequests:30,p50Milliseconds:Math.round(times[Math.ceil(times.length*.5)-1]*100)/100,p95Milliseconds:Math.round(p95*100)/100,node:process.version,postgres:postgres.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,memoryGiB:Math.round(os.totalmem()/1024**3)})+"\n");
    expect(p95).toBeLessThanOrEqual(2000);
  }
  expect(reads).toHaveLength(99);expect(reads.every(query=>query.take===5)).toBe(true);
},60000);
