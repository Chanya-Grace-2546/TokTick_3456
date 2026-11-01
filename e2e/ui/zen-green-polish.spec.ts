import {test,expect} from '../fixtures';
import {mockApi} from './mockApi';
async function noOverflow(page:import('@playwright/test').Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function visibleFocus(locator:import('@playwright/test').Locator){await locator.page().keyboard.press("Tab");await locator.focus();expect(await locator.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');}
function contrast(a:string,b:string){const light=(s:string)=>{const channels=s.match(/[0-9.]+/g)!.slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return channels.reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);};const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

async function checkMediumBadges(page:import('@playwright/test').Page, updatedTheme = true){
 const badges=page.locator('.badge:visible').filter({hasText:/^medium$/i});await expect(badges.first()).toBeVisible();
 for(let i=0;i<await badges.count();i++){
  const badge=badges.nth(i);if(updatedTheme){await expect(badge).toHaveCSS('color','rgb(31, 46, 39)');await expect(badge).toHaveCSS('background-color','rgb(255, 244, 214)');}
  await expect.poll(async()=>{const colors=await badge.evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));return colors.fg&&colors.bg?contrast(colors.fg,colors.bg):0;}).toBeGreaterThanOrEqual(4.5);
 }
}
test('Requester sorting, links, focus and priority contrast',async({page},info)=>{
 await mockApi(page);await page.goto('/tickets?search=wifi&pageSize=2');await expect(page.getByRole('heading',{name:'My Tickets',exact:true})).toBeVisible();await expect(page.locator('table tbody tr')).toHaveCount(1);
 const trigger=page.getByRole('button',{name:/Sort:/});await trigger.click();await expect(page.getByRole('group',{name:'Ticket sorting'})).toHaveAttribute('id',(await trigger.getAttribute('aria-controls'))!);await page.keyboard.press('Tab');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await trigger.click();await page.getByRole('group',{name:'Ticket sorting'}).getByRole('button',{name:/Ticket No/}).click();await expect(trigger).toBeFocused();await expect(page).toHaveURL(/sortBy=ticketNumber/);expect(new URL(page.url()).searchParams.get('search')).toBe('wifi');expect(new URL(page.url()).searchParams.get('pageSize')).toBe('2');
 if(info.project.name==='desktop'){
  const header=page.getByRole('columnheader').filter({has:page.getByRole('button',{name:/Ticket No/})});await expect(header).toHaveAttribute('aria-sort','descending');const sort=header.getByRole('button');await sort.focus();await page.keyboard.press('Enter');await expect(header).toHaveAttribute('aria-sort','ascending');await expect(sort).toBeFocused();
  const table=page.getByRole('table');const scroll=page.getByRole('region',{name:/My Tickets table/});
  await expect(scroll).toHaveCSS('overflow-x','auto');await scroll.focus();await expect(scroll).toBeFocused();
  await expect.poll(()=>scroll.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  for(const index of [0,2,3,4,5,6])expect(await table.locator('thead th').nth(index).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await expect(table.locator('tbody td').nth(4)).toHaveText('Waiting for Requester');
  await expect(table.locator('tbody td').nth(2)).toHaveText('Software');
  await expect(table.locator('tbody td').first()).toHaveCSS('white-space','nowrap');
  await expect(table.locator('tbody td').nth(1)).toHaveCSS('overflow-wrap','break-word');
  await scroll.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  expect(await scroll.evaluate(e=>e.scrollLeft)).toBe(0);
  await scroll.evaluate(e=>{e.scrollLeft=0;});
 }
 await checkMediumBadges(page);await noOverflow(page);
 const link=page.getByRole('link',{name:info.project.name==='desktop'?'Open ticket TKT-2026-000042':'View ticket TKT-2026-000042',exact:true});await visibleFocus(link);await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/tickets\/42$/);
});

for(const role of ['REQUESTER','IT_STAFF','ADMINISTRATOR'])test(`${role} shell and long-content layouts`,async({page},info)=>{
 const mock=await mockApi(page,role);const paths=role==='REQUESTER'?['/dashboard','/tickets/new','/tickets/42','/change-password']:role==='IT_STAFF'?['/staff/dashboard','/staff/tickets','/staff/tickets/42']:['/admin/users'];
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of paths){await page.goto(path);if(path==='/tickets/42')await page.getByRole('heading',{name:'Actions Taken',exact:true}).waitFor();else await page.getByRole('heading',{level:1}).waitFor();
  if(path==='/tickets/new')await page.getByLabel(/^Category/).waitFor();
  if(path.endsWith('/dashboard'))await page.locator('.dashboard-kpi').first().waitFor();
  if(path==='/staff/tickets'){await page.getByText('TKT-2026-000042',{exact:true}).locator('visible=true').first().waitFor();if(info.project.name==='desktop'){const cell=page.locator('table tbody td').last();expect(await cell.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}}
  if(path==='/admin/users'){await page.getByRole('button',{name:/Edit Alexandra/}).locator('visible=true').first().waitFor();await page.getByRole('button',{name:'+ Create User',exact:true}).click();await page.getByRole('heading',{name:'Create User',exact:true}).waitFor();}
  if(path.endsWith('/42'))await page.getByRole('heading',{name:'Actions Taken',exact:true}).waitFor();
  if(['/tickets/42','/staff/tickets','/staff/tickets/42'].includes(path))await checkMediumBadges(page,path!=='/staff/tickets');
  await noOverflow(page);
 }
 const trigger=info.project.name==='mobile'?page.getByRole('button',{name:'Toggle navigation',exact:true}):page.locator('.app-header').getByRole('button',{name:/Alexandra/});
 await visibleFocus(trigger);await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');const id=await trigger.getAttribute('aria-controls');expect(await page.evaluate(id=>!!document.getElementById(id!)?.getClientRects().length,id)).toBe(true);await noOverflow(page);const bounds=await page.evaluate(id=>{const e=document.getElementById(id!)!,r=e.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,clipped:e.scrollWidth>e.clientWidth};},id);expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);expect(bounds.clipped).toBe(false);await page.keyboard.press('Tab');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
 if(role==='REQUESTER')expect(mock.requests.some(path=>path==='/api/staff/owners')).toBe(false);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath(`${role}-layout.png`),fullPage:true});
});
test('Create Ticket retry, validation semantics and approved limits',async({page})=>{
 const mock=await mockApi(page);mock.failReferences=true;await page.goto('/tickets/new');await expect(page.getByRole('alert')).toContainText("Couldn't load Categories");mock.failReferences=false;await page.getByRole('button',{name:'Retry reference data',exact:true}).click();
 const summary=page.getByLabel(/^Summary/),description=page.getByLabel(/^Description/);await expect(summary).toHaveAttribute('maxlength','150');await expect(description).toHaveAttribute('maxlength','5000');await expect(summary).toHaveAttribute('aria-required','true');
 await page.getByLabel(/^Category/).selectOption('1');await page.getByLabel(/^Related System/).selectOption('1');await page.getByLabel(/^Requested Priority/).selectOption('MEDIUM');await summary.fill('S'.repeat(150));await description.fill('D'.repeat(5000));mock.invalidCreation=true;await page.getByRole('button',{name:'Submit Ticket',exact:true}).click();await expect(summary).toHaveAttribute('aria-invalid','true');await expect(summary).toHaveAccessibleDescription('Review the summary.');await expect(summary).toHaveValue('S'.repeat(150));await expect(description).toHaveValue('D'.repeat(5000));expect(mock.created.summary.length).toBe(150);expect(mock.created.description.length).toBe(5000);await noOverflow(page);
});
test('Action and follow-up form buttons retain Zen Green and visible focus',async({page})=>{
 const mock=await mockApi(page,'IT_STAFF');await page.goto('/staff/tickets/42');await page.getByRole('button',{name:'Edit Action 1',exact:true}).click();const save=page.getByRole('button',{name:'Save Action',exact:true});expect(await save.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(0, 107, 60)');await visibleFocus(save);await noOverflow(page);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 mock.action={...mock.action,state:'COMPLETED',followUpRequired:true};await page.reload();await page.getByRole('button',{name:'Record Follow-Up Outcome',exact:true}).click();const record=page.getByRole('button',{name:'Record Outcome',exact:true});expect(await record.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(0, 107, 60)');await visibleFocus(record);await noOverflow(page);
});

for(const role of ['REQUESTER','IT_STAFF'])test(`${role} quick actions and search focus`,async({page})=>{
 await mockApi(page,role);const staff=role==='IT_STAFF';
 await page.goto(staff?'/staff/dashboard':'/dashboard');
 const nav=page.getByRole('navigation',{name:'Dashboard quick actions'});
 await expect(nav.getByRole('link')).toHaveText(staff?['Search Tickets ↗','My Queue ↗']:['Create Ticket ↗','Search Tickets ↗','My Tickets ↗']);
 await nav.getByRole('link',{name:'Search Tickets',exact:true}).focus();await page.keyboard.press('Enter');
 const field=page.getByRole(staff?'searchbox':'textbox',{name:'Search tickets',exact:true});await expect(field).toBeFocused();await field.fill('wifi');
 await expect(page).toHaveURL(/search=wifi/);await expect(field).toHaveValue('wifi');await noOverflow(page);
 await page.goto(staff?'/staff/dashboard':'/dashboard');
 await page.getByRole('navigation',{name:'Dashboard quick actions'}).getByRole('link',{name:staff?'My Queue':'My Tickets',exact:true}).click();
 expect(new URL(page.url()).search).toBe(staff?'?owner=me':'');await noOverflow(page);
 if(!staff){await page.goto('/dashboard');await page.getByRole('navigation',{name:'Dashboard quick actions'}).getByRole('link',{name:'Create Ticket',exact:true}).click();await expect(page).toHaveURL(/\/tickets\/new$/);}
});

for(const role of ['REQUESTER','IT_STAFF'])test(`${role} green interactions remain distinct from static information`,async({page})=>{
 await mockApi(page,role);const staff=role==='IT_STAFF';await page.goto(staff?'/staff/dashboard':'/dashboard');
 const quick=page.getByRole('navigation',{name:'Dashboard quick actions'}).getByRole('link').first();
 await expect(quick).toHaveCSS('color','rgb(0, 107, 60)');await expect(quick).toHaveCSS('text-decoration-line','underline');await visibleFocus(quick);
 const kpi=page.locator('.dashboard-kpi').first();await expect(kpi).toBeVisible();
 expect(await kpi.evaluate(e=>getComputedStyle(e).borderTopColor)).not.toBe('rgb(220, 230, 223)');await visibleFocus(kpi);
 await expect(kpi.locator('strong')).toHaveCSS('color','rgb(31, 46, 39)');
 await expect(page.locator('.dashboard-subtitle')).toHaveCSS('color','rgb(82, 101, 91)');
 const ticket=page.locator('.dashboard-ticket').first();await expect(ticket.locator('.dashboard-ticket-number')).toHaveCSS('text-decoration-line','underline');await visibleFocus(ticket);
 if(staff){const row=page.locator('.dashboard-status-bars a').first();await expect(row.locator('.dashboard-bar-label > span')).toHaveCSS('color','rgb(0, 107, 60)');await expect(row.locator('strong')).toHaveCSS('color','rgb(31, 46, 39)');await visibleFocus(row);await expect(page.locator('.dashboard-priority-high .dashboard-priority-dot')).toHaveCSS('background-color','rgb(179, 38, 30)');await expect(page.locator('.dashboard-priority-medium .dashboard-priority-dot')).toHaveCSS('background-color','rgb(184, 134, 11)');}
 await noOverflow(page);await page.goto(staff?'/staff/tickets/42':'/tickets/42');
 const details=page.getByRole('button',{name:/View Details for Action/});await expect(details).toHaveCSS('text-decoration-line','underline');await visibleFocus(details);
 await expect(page.locator('.action-description')).toHaveCSS('color','rgb(31, 46, 39)');await expect(page.locator('.action-card')).not.toHaveAttribute('role','link');
 await page.getByRole('button',{name:/View Details for Action/}).click();await expect(page.getByRole('region',{name:/Action .* details/})).toBeVisible();await noOverflow(page);
 await page.goto(staff?'/staff/tickets':'/tickets');
 const identifier=page.locator(staff?'table tbody td:first-child, .ticket-link-label':'table tbody td:first-child a, .ticket-link-label').locator('visible=true').first();
 await expect(identifier).toHaveCSS('color','rgb(0, 107, 60)');await expect(identifier).toHaveCSS('text-decoration-line','underline');await noOverflow(page);
});
