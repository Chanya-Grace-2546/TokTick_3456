import {test,expect} from '../fixtures';
import {createTicket,asStaff,postAction,captureScreen,status,logout,login,USERS,apiOrigin} from './helpers';
async function noOverflow(page:import('@playwright/test').Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test('E2E-04: dashboards and populated Action cards have accessible responsive controls',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const ticket=await createTicket(page,'Responsive '+ 'long summary '.repeat(12));
 await page.goto('/dashboard');await expect(page.getByRole('link',{name:/Open Tickets:/})).toBeVisible();await noOverflow(page);
 const card=page.getByRole('link',{name:/Open Tickets:/});await card.focus();expect(await card.evaluate(element=>getComputedStyle(element).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'My Tickets',exact:true})).toBeVisible();await noOverflow(page);
 await page.goto('/dashboard');await expect(page.getByRole('link',{name:/Open Tickets:/})).toBeVisible();
 await asStaff(page,ticket.id);const saved=await postAction(page,ticket.id,{description:'Readable multiline Action\n'+ 'long content '.repeat(25),attachmentNotes:'Existing attachment reference',followUpRequired:true,followUpNote:'Confirm result'});expect(saved.status()).toBe(201);const action=(await saved.json()).action;await page.reload();
 const details=page.getByRole('button',{name:'View Details for Action 1',exact:true});await details.focus();await page.keyboard.press('Enter');await expect(details).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('region',{name:'Action 1 details',exact:true})).toContainText('Existing attachment reference');await noOverflow(page);await captureScreen(page,info,'actions-taken');
 await page.getByRole('button',{name:'Edit Action 1',exact:true}).click();await expect(page.getByRole('heading',{name:'Edit Action',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByLabel(/^Action Date\/Time/)).toBeFocused();await noOverflow(page);
 await page.goto('/staff/dashboard');await expect(page.getByRole('heading',{name:'IT Staff Dashboard',exact:true})).toBeVisible();await noOverflow(page);await expect(page.getByRole('link',{name:/Unassigned Tickets:/})).toBeVisible();expect(errors).toEqual([]);
});
test('AC-18: stored Action markup is rendered as text',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const malicious='<img src=x onerror="window.issue8Injected=true">';expect((await postAction(page,ticket.id,{description:malicious})).status()).toBe(201);await page.reload();await expect(page.getByText(malicious,{exact:true})).toBeVisible();expect(await page.evaluate(()=>Boolean((window as any).issue8Injected))).toBe(false);expect(await page.locator('.action-description img').count()).toBe(0);
});

test('Ticket Status History shows genuine transitions to Staff and owning Requester',async({page},info)=>{
 const ticket=await createTicket(page,'Status history evidence');await asStaff(page,ticket.id);
 for(const [previous,next] of [['NEW','OPEN'],['OPEN','IN_PROGRESS'],['IN_PROGRESS','WAITING_FOR_REQUESTER']])expect((await status(page,ticket.id,next,previous)).status()).toBe(200);
 await page.reload();const timeline=page.getByRole('region',{name:'Ticket Status History',exact:true});
 await expect(timeline.getByRole('listitem')).toHaveCount(3);await expect(timeline.getByRole('listitem').first()).toContainText('In Progress → Waiting for Requester');await expect(timeline.getByRole('listitem').last()).toContainText('New → Open');await expect(timeline.getByRole('listitem').first()).toContainText(USERS.staff.name);await noOverflow(page);
 await captureScreen(page,info,'actions-taken','ticket-status-history');
 await logout(page);await login(page,USERS.requester.email);await expect(page).toHaveURL(/\/dashboard$/);await page.goto(`/tickets/${ticket.id}`);await expect(timeline.getByRole('listitem')).toHaveCount(3);await expect(timeline.getByRole('button')).toHaveCount(0);await noOverflow(page);
 await logout(page);await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);const denied=await page.request.get(`${apiOrigin()}/api/tickets/${ticket.id}/status-history`);expect(denied.status()).toBe(404);expect(await denied.json()).toEqual({error:'NOT_FOUND'});
 await logout(page);await login(page,USERS.admin.email);await expect(page).toHaveURL(/\/admin\/users$/);await page.goto(`/staff/tickets/${ticket.id}`);await expect(timeline.getByRole('listitem')).toHaveCount(3);await expect(timeline.getByRole('button')).toHaveCount(0);await noOverflow(page);
});

test('Requester My Tickets fits desktop and preserves stacked layouts',async({page},info)=>{
 const ticket=await createTicket(page,'Readable summary with ordinary words and '+ 'long detail '.repeat(5));await page.goto('/tickets');
 const desktop=info.project.name==='desktop';const link=page.getByRole('link',{name:`${desktop?'Open':'View'} ticket ${ticket.ticketNumber}`,exact:true});await expect(link).toBeVisible();
 if(desktop){const region=page.getByRole('region',{name:'My Tickets table',exact:true});await expect(region.getByRole('columnheader')).toHaveCount(7);expect(await region.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);for(const header of await region.getByRole('columnheader').all())expect(await header.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
 else {await expect(page.getByRole('list',{name:'My Tickets cards'})).toBeVisible();await expect(page.getByRole('table')).not.toBeVisible();}
 await noOverflow(page);await captureScreen(page,info,'requester-dashboard','my-tickets');await link.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}$`));
});
