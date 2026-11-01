import {beforeAll,expect,it} from 'vitest';
import request from 'supertest';
import {app} from '../../src/app.js';
import {actionUser,actionTicket,prisma,origin} from './helpers/actionsTestDatabase.js';
let owner:Awaited<ReturnType<typeof actionUser>>,other:typeof owner,staff:typeof owner,ticket:Awaited<ReturnType<typeof actionTicket>>,action:any;
beforeAll(async()=>{owner=await actionUser('REQUESTER');other=await actionUser('REQUESTER');staff=await actionUser('IT_STAFF');ticket=await actionTicket(owner.user.id);action=(await request(app).post(`/api/tickets/${ticket.id}/actions`).set('Cookie',staff.cookie).set('Origin',origin).send({description:'Private owned Action'})).body.action;});
it('SEC-01: rejects foreign Action and follow-up access without domain writes',async()=>{
 const before=await prisma.actionTakenHistory.count();
 const path=`/api/tickets/${ticket.id}/actions`;
 expect((await request(app).get(path).set('Cookie',other.cookie)).status).toBe(404);
 for(const req of [request(app).post(path).send({description:'forged',performedByUserId:staff.user.id}),request(app).patch(`${path}/${action.id}`).send({version:1,description:'forged'}),request(app).post(`${path}/${action.id}/follow-up-resolution`).send({version:1,outcome:'forged'})]){
  const res=await req.set('Cookie',other.cookie).set('Origin',origin);expect(res.status).toBe(403);expect(JSON.stringify(res.body)).not.toContain('Private owned Action');
 }
 expect(await prisma.actionTakenHistory.count()).toBe(before);
 expect((await prisma.actionTaken.findUniqueOrThrow({where:{id:action.id}})).description).toBe('Private owned Action');
});
it.each(['missing','foreign','null'])('SEC-02: rejects %s Origin across Action and status writes',async mode=>{
 const before=await prisma.actionTakenHistory.count();
 const requests=[request(app).post(`/api/tickets/${ticket.id}/actions`).send({description:'rejected'}),request(app).patch(`/api/tickets/${ticket.id}/actions/${action.id}`).send({version:1,description:'rejected'}),request(app).post(`/api/tickets/${ticket.id}/actions/${action.id}/follow-up-resolution`).send({version:1,outcome:'rejected'}),request(app).patch(`/api/staff/tickets/${ticket.id}/status`).send({status:'OPEN'})];
 for(const req of requests){req.set('Cookie',staff.cookie);if(mode!=='missing')req.set('Origin',mode==='null'?'null':'https://foreign.invalid');const res=await req;expect(res.status).toBe(403);expect(res.body).toEqual({error:'INVALID_ORIGIN'});}
 expect(await prisma.actionTakenHistory.count()).toBe(before);expect((await prisma.ticket.findUniqueOrThrow({where:{id:ticket.id}})).status).toBe('NEW');
});
it('SEC-03: refuses large Action pages with safe field errors',async()=>{const res=await request(app).get(`/api/tickets/${ticket.id}/actions?pageSize=51`).set('Cookie',owner.cookie);expect(res.status).toBe(400);expect(res.body.error).toBe('INVALID_QUERY');expect(res.body.fields.pageSize).toBeDefined();});
it('SEC-04: identity injection cannot change dashboard or list ownership',async()=>{
 const dashboard=await request(app).get(`/api/dashboard/requester?requesterId=${owner.user.id}&userId=${owner.user.id}`).set('Cookie',other.cookie);
 expect(dashboard.status).toBe(200);expect(dashboard.body.metrics).toEqual({openTickets:0,waitingForRequester:0});expect(dashboard.body.recentlyUpdated).toEqual([]);
 const list=await request(app).get(`/api/tickets?requesterId=${owner.user.id}`).set('Cookie',other.cookie);expect(list.status).toBe(200);expect(list.body.items).toEqual([]);
});
it('SEC-05: cross-Ticket Action IDs cannot mutate the original record',async()=>{const separate=await actionTicket(owner.user.id);const res=await request(app).patch(`/api/tickets/${separate.id}/actions/${action.id}`).set('Cookie',staff.cookie).set('Origin',origin).send({version:1,description:'wrong Ticket'});expect(res.status).toBe(404);expect((await prisma.actionTaken.findUniqueOrThrow({where:{id:action.id}})).version).toBe(1);});
it.each(['expired','invalidated','inactive','initial'] as const)('SEC-06: %s actor cannot mutate workflow or Actions',async state=>{
 const actor=await actionUser('IT_STAFF');
 if(state==='expired')await prisma.session.update({where:{id:actor.session.id},data:{expiresAt:new Date(0)}});
 if(state==='invalidated')await prisma.session.update({where:{id:actor.session.id},data:{invalidatedAt:new Date()}});
 if(state==='inactive'||state==='initial')await prisma.user.update({where:{id:actor.user.id},data:state==='inactive'?{isActive:false}:{mustChangePassword:true}});
 for(const req of [request(app).post(`/api/tickets/${ticket.id}/actions`).send({description:'denied'}),request(app).patch(`/api/staff/tickets/${ticket.id}/status`).send({status:'OPEN'})])expect((await req.set('Cookie',actor.cookie).set('Origin',origin)).status).toBe(state==='initial'?403:401);
});
