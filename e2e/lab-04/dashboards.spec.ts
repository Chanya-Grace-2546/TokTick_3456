import {test,expect} from '../fixtures';
import {login,logout,USERS,createTicket,apiOrigin,asStaff,postAction,captureScreen,status} from './helpers';
test('E2E-03/05: own-only dashboard metrics match complete filtered My Tickets',async({page},info)=>{
 const ticket=await createTicket(page,'Dashboard ownership fixture');
 // createTicket logs in through the UI; end the first session before creating another fixture.
 await logout(page);
 const resolved=await createTicket(page,'Recently resolved dashboard evidence');await asStaff(page,resolved.id);expect((await status(page,resolved.id,'OPEN','NEW')).status()).toBe(200);expect((await status(page,resolved.id,'RESOLVED','OPEN')).status()).toBe(200);await logout(page);
 await login(page,USERS.requester.email);
 // Wait for authentication and its normal redirect; a full navigation can abort the pending login POST.
 await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.getByRole('heading',{name:'My Dashboard',exact:true})).toBeVisible();
 const response=await page.request.get(`${apiOrigin()}/api/dashboard/requester`);expect(response.status()).toBe(200);const data=await response.json();expect(data.recentlyUpdated.some((row:any)=>row.id===ticket.id)).toBe(true);expect(data.recentlyResolved.some((row:any)=>row.id===resolved.id)).toBe(true);await expect(page.getByRole('link',{name:new RegExp(resolved.ticketNumber)}).first()).toBeVisible();await captureScreen(page,info,'requester-dashboard');
 for(const [label,key]of [['Open Tickets','openTickets'],['Waiting for Me','waitingForRequester']] as const){
  const card=page.getByRole('link',{name:`${label}: ${data.metrics[key]}`,exact:true});await expect(card).toHaveAttribute('href',data.drillDown[key]);await card.click();await expect(page.getByRole('heading',{name:'My Tickets',exact:true})).toBeVisible();
  const filter=new URL(data.drillDown[key],'http://localhost').search;
  const list=await page.request.get(`${apiOrigin()}/api/tickets${filter}&pageSize=2`);const first=await list.json();expect(first.totalItems).toBe(data.metrics[key]);const ids=new Set(first.items.map((row:any)=>row.id));for(let p=2;p<=first.totalPages;p++){const next=await page.request.get(`${apiOrigin()}/api/tickets${filter}&pageSize=2&page=${p}`);for(const row of (await next.json()).items)ids.add(row.id);}expect(ids.size).toBe(data.metrics[key]);if(key==='openTickets'){await expect(page.getByText('Dashboard ownership fixture',{exact:true}).locator('visible=true').first()).toBeVisible();await captureScreen(page,info,'requester-dashboard','open-tickets-drill-down');}await page.goto('/dashboard');
 }
 expect(data.recentlyUpdated.length).toBeLessThanOrEqual(5);expect(data.recentlyResolved.length).toBeLessThanOrEqual(5);
 expect((await page.request.get(`${apiOrigin()}/api/dashboard/staff`)).status()).toBe(403);
 await page.goto('/tickets/new');await expect(page.getByLabel(/^Summary/)).toBeVisible();
 await logout(page);await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);const other=await page.request.get(`${apiOrigin()}/api/dashboard/requester`);expect((await other.json()).recentlyUpdated.some((row:any)=>row.summary==='Dashboard ownership fixture')).toBe(false);
});
test('E2E-03/05: Staff metrics and breakdowns drill down; Administrator landing stays unchanged',async({page},info)=>{
 const ticket=await createTicket(page,'Assigned dashboard evidence');await asStaff(page,ticket.id);const me=await page.request.get(`${apiOrigin()}/api/auth/me`);expect(me.status()).toBe(200);expect((await postAction(page,ticket.id,{description:'Current staff planned work',assignedToUserId:(await me.json()).id})).status()).toBe(201);await page.goto('/staff/dashboard');await expect(page.getByRole('heading',{name:'IT Staff Dashboard',exact:true})).toBeVisible();const response=await page.request.get(`${apiOrigin()}/api/dashboard/staff`);expect(response.status()).toBe(200);const data=await response.json();
 await expect(page.getByRole('link',{name:`Tickets with My Actions: ${data.metrics.ticketsWithMyActions}`,exact:true})).toBeVisible();expect(data.metrics.ticketsWithMyActions).toBeGreaterThan(0);expect(data.metrics.urgentOpenTickets).toBeGreaterThan(0);expect(data.recentTickets.some((row:any)=>row.id===ticket.id)).toBe(true);
 await captureScreen(page,info,'staff-dashboard');
 for(const key of ['unassignedTickets','myOwnedTickets','ticketsWithMyActions','urgentOpenTickets']){const path=data.drillDown[key];const list=await page.request.get(`${apiOrigin()}${path.replace('/staff/tickets','/api/staff/tickets')}`);expect(list.status()).toBe(200);expect((await list.json()).totalItems).toBe(data.metrics[key]);if(key==='ticketsWithMyActions'){await page.locator(`a.dashboard-kpi[href="${path}"]`).click();await expect(page.getByRole('heading',{name:'Ticket Queue',exact:true})).toBeVisible();await expect(page.getByText(ticket.ticketNumber,{exact:true}).locator('visible=true').first()).toBeVisible();await captureScreen(page,info,'staff-dashboard','my-actions-drill-down');await page.goto('/staff/dashboard');await expect(page.getByRole('link',{name:/Tickets with My Actions:/})).toBeVisible();}}
 expect(Object.keys(data.byStatus)).toHaveLength(8);expect(data.byPriority).toHaveLength(3);expect(data.recentTickets.length).toBeLessThanOrEqual(5);
 expect((await page.request.get(`${apiOrigin()}/api/dashboard/requester`)).status()).toBe(403);
 await page.goto('/staff/tickets');await expect(page.getByRole('heading',{name:'Ticket Queue',exact:true})).toBeVisible();
 await logout(page);await login(page,USERS.admin.email);await expect(page).toHaveURL(/\/admin\/users$/);await page.goto('/staff/dashboard');await expect(page.getByRole('heading',{name:'IT Staff Dashboard',exact:true})).toBeVisible();
});
test('AC-16/24: empty lists and retry are accessible without fake metric values',async({page},info)=>{
 await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('heading',{name:'No recently updated tickets',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'No recently resolved tickets',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Open Tickets: 0',exact:true})).toBeVisible();
 await captureScreen(page,info,'requester-dashboard','empty');
 await page.route('**/api/dashboard/requester',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'UNEXPECTED_ERROR'})}));await page.getByRole('button',{name:'Refresh Dashboard',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Could not load your dashboard');await expect(page.getByRole('link',{name:/Open Tickets:/})).toHaveCount(0);await captureScreen(page,info,'requester-dashboard','injected-error');await page.unroute('**/api/dashboard/requester');await page.getByRole('button',{name:'Retry Dashboard',exact:true}).click();await expect(page.getByRole('link',{name:'Open Tickets: 0',exact:true})).toBeVisible();
});

test('Staff Dashboard controlled empty and injected error states retain retry behavior',async({page},info)=>{
 info.annotations.push({type:'evidence',description:'Empty dashboard response and HTTP 500 are deliberately injected; screenshots verify UI states, not database counts.'});
 await login(page,USERS.staff.email);await expect(page).toHaveURL(/\/staff\/dashboard$/);
 const response=await page.request.get(`${apiOrigin()}/api/dashboard/staff`);expect(response.status()).toBe(200);const actual=await response.json();
 const empty={...actual,metrics:Object.fromEntries(Object.keys(actual.metrics).map(key=>[key,0])),byStatus:Object.fromEntries(Object.keys(actual.byStatus).map(key=>[key,0])),byPriority:actual.byPriority.map((row:any)=>({...row,count:0})),recentTickets:[]};
 await page.route('**/api/dashboard/staff',route=>route.fulfill({status:200,json:empty}));
 await page.getByRole('button',{name:'Refresh Dashboard',exact:true}).click();
 await expect(page.getByRole('link',{name:'Tickets with My Actions: 0',exact:true})).toBeVisible();await expect(page.getByText('No recent tickets',{exact:true})).toBeVisible();
 await captureScreen(page,info,'staff-dashboard','controlled-empty');
 await page.unroute('**/api/dashboard/staff');await page.route('**/api/dashboard/staff',route=>route.fulfill({status:500,json:{error:'UNEXPECTED_ERROR'}}));
 await page.getByRole('button',{name:'Refresh Dashboard',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Could not load the dashboard');await expect(page.locator('.dashboard-kpi')).toHaveCount(0);
 await captureScreen(page,info,'staff-dashboard','injected-error');
 await page.unroute('**/api/dashboard/staff');await page.getByRole('button',{name:'Retry Dashboard',exact:true}).click();
 await expect(page.getByRole('link',{name:`Tickets with My Actions: ${actual.metrics.ticketsWithMyActions}`,exact:true})).toBeVisible();
});
