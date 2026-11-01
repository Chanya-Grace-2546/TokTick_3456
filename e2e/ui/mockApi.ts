import {Page} from '@playwright/test';
const date='2026-10-28T03:00:00Z';
const recent={id:42,ticketNumber:'TKT-2026-000042',summary:'Wi-Fi request',status:'OPEN',updatedAt:date};
const dashboardFixture={asOf:date,metrics:{unassignedTickets:1,myOwnedTickets:1,ticketsWithMyActions:1,urgentOpenTickets:1},byStatus:{NEW:0,OPEN:1,IN_PROGRESS:0,WAITING_FOR_REQUESTER:0,RESOLVED:0,CLOSED:0,REOPENED:0,CANCELLED:0},byPriority:[{priority:'LOW',count:0},{priority:'MEDIUM',count:1},{priority:'HIGH',count:0}],recentTickets:[{...recent,href:'/staff/tickets/42'}],drillDown:{unassignedTickets:'/staff/tickets?owner=unassigned&statusGroup=open',myOwnedTickets:'/staff/tickets?owner=me&statusGroup=open',ticketsWithMyActions:'/staff/tickets?myAction=true',urgentOpenTickets:'/staff/tickets?itPriority=HIGH&statusGroup=open'}};
const requesterDashboardFixture={asOf:date,recentWindowDays:7,metrics:{openTickets:1,waitingForRequester:0},recentlyUpdated:[{...recent,href:'/tickets/42'}],recentlyResolved:[],drillDown:{openTickets:'/tickets?statusGroup=open',waitingForRequester:'/tickets?status=WAITING_FOR_REQUESTER'}};
const savedAction={id:31,ticketId:42,actionAt:date,description:'Repair',result:'Working',performedBy:{id:7,name:'Alex Staff'},assignedTo:{id:8,name:'Priya Staff'},followUpRequired:true,followUpNote:'Check tomorrow',attachmentNotes:'Existing attachment note',state:'PLANNED',version:2,createdAt:date,updatedAt:date,followUpResolution:null};
export async function mockApi(page:Page,role='REQUESTER'){
 const base=process.env.TOKTICKIT_E2E_BASE_URL!;
 const name='Alexandra'+ 'LongName'.repeat(9),email='long.email.'.repeat(12)+'@example.test';
 const user={id:7,name,email,role,isActive:true,mustChangePassword:false};
 const date='2026-10-28T03:00:00Z';
 const ticket={id:42,ticketNumber:'TKT-2026-000042',summary:'LongSummary'.repeat(13),description:'Readable long description. '.repeat(15),requestedPriority:'MEDIUM',itPriority:'HIGH',currentStatus:'WAITING_FOR_REQUESTER',status:'WAITING_FOR_REQUESTER',requesterId:7,requesterResolvedAt:null,requesterResolvedById:null,createdAt:date,updatedAt:date,category:'Software',relatedSystem:'Laptop',attachments:[]};
 const state={user:user as typeof user|null,failReferences:false,invalidCreation:false,requests:[] as string[],action:{...savedAction,description:'LongAction'.repeat(30)},created:undefined as any};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!url.pathname.startsWith('/api/'))return url.origin===base?route.continue():route.abort();
  state.requests.push(url.pathname+url.search);
  const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  let body:any,status=200;
  if(url.pathname==='/api/auth/me'){body=state.user??{error:'UNAUTHENTICATED'};if(!state.user)status=401;}
  else if(url.pathname==='/api/auth/logout'){state.user=null;body={};}
  else if(url.pathname==='/api/dashboard/requester')body=requesterDashboardFixture;
  else if(url.pathname==='/api/dashboard/staff')body=dashboardFixture;
  else if(['/api/categories','/api/related-systems'].includes(url.pathname)){body=state.failReferences?{error:'UNEXPECTED_ERROR'}:[{id:1,name:'Hardware'}];if(state.failReferences)status=500;}
  else if(['/api/staff/owners','/api/staff/action-assignees'].includes(url.pathname))body=[{id:8,name,email,role:'IT_STAFF'}];
  else if(url.pathname==='/api/admin/users')body={items:[{...user,id:8,name,email}]};
  else if(url.pathname.endsWith('/comments')||url.pathname.endsWith('/internal-notes'))body={items:[]};
  else if(url.pathname.endsWith('/status-history'))body={items:[{id:1,oldStatus:'NEW',newStatus:'OPEN',actor:{name:'Alex Staff',role:'IT_STAFF'},occurredAt:date}]};
  else if(url.pathname.endsWith('/actions'))body={items:[state.action],page:1,pageSize:20,total:1};
  else if(url.pathname==='/api/tickets'&&route.request().method()==='POST'){
   state.created=route.request().postDataJSON();body=state.invalidCreation?{error:'VALIDATION_FAILED',fields:{summary:'Review the summary.',description:'Review the description.',categoryId:'Select a category.'}}:{...ticket,...state.created,ticketNumber:ticket.ticketNumber};status=state.invalidCreation?400:201;
  }
  else if(url.pathname==='/api/tickets')body={items:[ticket],page:1,pageSize:10,totalItems:1,totalPages:1,noResults:false};
  else if(url.pathname==='/api/staff/tickets')body={items:[{...ticket,requester:{id:7,name,email},category:{id:1,name:'Hardware'},owner:{id:8,name,email,role:'IT_STAFF'}}],page:1,pageSize:10,totalItems:1,totalPages:1};
  else if(url.pathname==='/api/tickets/42')body=ticket;
  else if(url.pathname==='/api/staff/tickets/42')body={...ticket,requester:{id:7,name,email},category:{id:1,name:'Hardware'},relatedSystem:{id:1,name:'Laptop'},publicComments:[],internalNotes:[],owner:{id:8,name,email,role:'IT_STAFF'}};
  else throw new Error(`Unexpected mocked UI API ${url.pathname}`);
  await route.fulfill({status,json:body,headers});
 });
 return state;
}
