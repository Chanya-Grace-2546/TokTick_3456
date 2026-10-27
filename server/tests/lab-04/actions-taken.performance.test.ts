import {expect,it} from 'vitest';
import request from 'supertest';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {app} from '../../src/app.js';
import {actionUser,prisma,origin} from './helpers/actionsTestDatabase.js';
it('PERF-03: bounded Action list/create/PATCH p95 <=2 seconds on 1000 Tickets / 3000 Actions',async()=>{
 const staff=await actionUser('IT_STAFF'),requester=await actionUser('REQUESTER');
 const category=await prisma.category.findFirstOrThrow(),system=await prisma.relatedSystem.findFirstOrThrow();
 await prisma.ticket.createMany({data:Array.from({length:1000},(_,i)=>({ticketNumber:`ACT-PERF-${i}`,requesterId:requester.user.id,categoryId:category.id,relatedSystemId:system.id,summary:`Performance ${i}`,description:'Isolated fixture',requestedPriority:'MEDIUM'}))});
 const tickets=await prisma.ticket.findMany({select:{id:true}});
 await prisma.actionTaken.createMany({data:tickets.flatMap(ticket=>Array.from({length:3},(_,i)=>({ticketId:ticket.id,performedByUserId:staff.user.id,description:'Performance Action',state:i===0?'COMPLETED' as const:'PLANNED' as const,result:i===0?'Completed work':null,followUpRequired:i===0,followUpNote:i===0?'Verify result':null})))});
 const action=await prisma.actionTaken.findFirstOrThrow({where:{state:'PLANNED'}}),path=`/api/tickets/${action.ticketId}/actions`;let version=1,followIndex=0;
 const followups=await prisma.actionTaken.findMany({where:{state:'COMPLETED'},take:33,orderBy:{id:'asc'}});
 const reads:number[]=[];prisma.$use(async(params,next)=>{if(params.model==='ActionTaken'&&params.action==='findMany')reads.push(params.args.take);return next(params);});
 const [postgres]=await prisma.$queryRaw<{version:string}[]>`SELECT current_setting('server_version') AS version`;
 for(const endpoint of ['list','create','patch','follow-up']){
  const call=()=>{const agent=request(app);if(endpoint==='follow-up'){const target=followups[followIndex++];return agent.post(`/api/tickets/${target.ticketId}/actions/${target.id}/follow-up-resolution`).set('Cookie',staff.cookie).set('Origin',origin).send({version:target.version,outcome:'Measured verified outcome'});}return endpoint==='list'?agent.get(`${path}?pageSize=50`).set('Cookie',staff.cookie):endpoint==='create'?agent.post(path).set('Cookie',staff.cookie).set('Origin',origin).send({description:'Measured create'}):agent.patch(`${path}/${action.id}`).set('Cookie',staff.cookie).set('Origin',origin).send({version:version++,description:'Measured edit'});};
  const times:number[]=[];
  for(let i=0;i<33;i++){const start=performance.now(),res=await call();if(i>=3)times.push(performance.now()-start);expect(res.status).toBe(endpoint==='create'||endpoint==='follow-up'?201:200);if(endpoint==='list')expect(res.body.items.length).toBeLessThanOrEqual(50);}
  times.sort((a,b)=>a-b);const p50=times[Math.ceil(times.length*.5)-1],p95=times[Math.ceil(times.length*.95)-1];
  console.log(JSON.stringify({test:`actions-${endpoint}`,tickets:1000,initialActions:3000,warmups:3,measuredRequests:30,p50Milliseconds:p50,p95Milliseconds:p95,node:process.version,postgres:postgres.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,memoryGiB:Math.round(os.totalmem()/1024**3)}));expect(p95).toBeLessThanOrEqual(2000);
 }
 expect(reads).toHaveLength(33);expect(reads.every(take=>take===50)).toBe(true);
},60000);
