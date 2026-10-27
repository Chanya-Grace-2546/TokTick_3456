import {test,expect} from '../fixtures';
import {login,logout,USERS,createTicket,apiOrigin} from './helpers';
test('E2E-03/05: own-only dashboard metrics match complete filtered My Tickets',async({page})=>{
 await createTicket(page,'Dashboard ownership fixture');await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'My Dashboard',exact:true})).toBeVisible();
 const response=await page.request.get(`${apiOrigin()}/api/dashboard/requester`);expect(response.status()).toBe(200);const data=await response.json();
 for(const [label,key]of [['Open Tickets','openTickets'],['Waiting for Me','waitingForRequester']] as const){
  const card=page.getByRole('link',{name:`${label}: ${data.metrics[key]}`,exact:true});await expect(card).toHaveAttribute('href',data.drillDown[key]);await card.click();await expect(page.getByRole('heading',{name:'My Tickets',exact:true})).toBeVisible();
  const filter=new URL(data.drillDown[key],'http://localhost').search;
  const list=await page.request.get(`${apiOrigin()}/api/tickets${filter}&pageSize=2`);const first=await list.json();expect(first.totalItems).toBe(data.metrics[key]);const ids=new Set(first.items.map((row:any)=>row.id));for(let p=2;p<=first.totalPages;p++){const next=await page.request.get(`${apiOrigin()}/api/tickets${filter}&pageSize=2&page=${p}`);for(const row of (await next.json()).items)ids.add(row.id);}expect(ids.size).toBe(data.metrics[key]);await page.goto('/dashboard');
 }
 expect(data.recentlyUpdated.length).toBeLessThanOrEqual(5);expect(data.recentlyResolved.length).toBeLessThanOrEqual(5);
 expect((await page.request.get(`${apiOrigin()}/api/dashboard/staff`)).status()).toBe(403);
 await page.goto('/tickets/new');await expect(page.getByLabel(/^Summary/)).toBeVisible();
 await logout(page);await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);const other=await page.request.get(`${apiOrigin()}/api/dashboard/requester`);expect((await other.json()).recentlyUpdated.some((row:any)=>row.summary==='Dashboard ownership fixture')).toBe(false);
});
test('E2E-03/05: Staff metrics and breakdowns drill down; Administrator landing stays unchanged',async({page})=>{
 await login(page,USERS.staff.email);await expect(page).toHaveURL(/\/staff\/dashboard$/);const response=await page.request.get(`${apiOrigin()}/api/dashboard/staff`);expect(response.status()).toBe(200);const data=await response.json();
 for(const key of ['unassignedTickets','myOwnedTickets','ticketsWithMyActions','urgentOpenTickets']){const path=data.drillDown[key];const list=await page.request.get(`${apiOrigin()}${path.replace('/staff/tickets','/api/staff/tickets')}`);expect(list.status()).toBe(200);expect((await list.json()).totalItems).toBe(data.metrics[key]);}
 expect(Object.keys(data.byStatus)).toHaveLength(8);expect(data.byPriority).toHaveLength(3);expect(data.recentTickets.length).toBeLessThanOrEqual(5);
 expect((await page.request.get(`${apiOrigin()}/api/dashboard/requester`)).status()).toBe(403);
 await page.goto('/staff/tickets');await expect(page.getByRole('heading',{name:'Ticket Queue',exact:true})).toBeVisible();
 await logout(page);await login(page,USERS.admin.email);await expect(page).toHaveURL(/\/admin\/users$/);await page.goto('/staff/dashboard');await expect(page.getByRole('heading',{name:'IT Staff Dashboard',exact:true})).toBeVisible();
});
test('AC-16/24: empty lists and retry are accessible without fake metric values',async({page})=>{
 await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('heading',{name:'No recently updated tickets',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'No recently resolved tickets',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Open Tickets: 0',exact:true})).toBeVisible();
 await page.route('**/api/dashboard/requester',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'UNEXPECTED_ERROR'})}));await page.getByRole('button',{name:'Refresh Dashboard',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Could not load your dashboard');await expect(page.getByRole('link',{name:/Open Tickets:/})).toHaveCount(0);await page.unroute('**/api/dashboard/requester');await page.getByRole('button',{name:'Retry Dashboard',exact:true}).click();await expect(page.getByRole('link',{name:'Open Tickets: 0',exact:true})).toBeVisible();
});
