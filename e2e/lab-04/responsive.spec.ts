import {test,expect} from '../fixtures';
import {createTicket,asStaff,postAction} from './helpers';
async function noOverflow(page:import('@playwright/test').Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test('E2E-04: dashboards and populated Action cards have accessible responsive controls',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const ticket=await createTicket(page,'Responsive '+ 'long summary '.repeat(12));
 await page.goto('/dashboard');await expect(page.getByRole('link',{name:/Open Tickets:/})).toBeVisible();await noOverflow(page);
 const card=page.getByRole('link',{name:/Open Tickets:/});await card.focus();expect(await card.evaluate(element=>getComputedStyle(element).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'My Tickets',exact:true})).toBeVisible();await noOverflow(page);
 await page.goto('/dashboard');await page.screenshot({path:info.outputPath('requester-dashboard.png'),fullPage:true});
 await asStaff(page,ticket.id);const saved=await postAction(page,ticket.id,{description:'Readable multiline Action\n'+ 'long content '.repeat(25),attachmentNotes:'Existing attachment reference',followUpRequired:true,followUpNote:'Confirm result'});expect(saved.status()).toBe(201);const action=(await saved.json()).action;await page.reload();
 const details=page.getByRole('button',{name:`View Details for Action ${action.id}`,exact:true});await details.focus();await page.keyboard.press('Enter');await expect(details).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('region',{name:`Action ${action.id} details`,exact:true})).toContainText('Existing attachment reference');await noOverflow(page);await page.screenshot({path:info.outputPath('actions-taken.png'),fullPage:true});
 await page.getByRole('button',{name:`Edit Action ${action.id}`,exact:true}).click();await expect(page.getByRole('heading',{name:'Edit Action',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByLabel(/^Action Date\/Time/)).toBeFocused();await noOverflow(page);
 await page.goto('/staff/dashboard');await expect(page.getByRole('heading',{name:'IT Staff Dashboard',exact:true})).toBeVisible();await noOverflow(page);await page.screenshot({path:info.outputPath('staff-dashboard.png'),fullPage:true});expect(errors).toEqual([]);
});
test('AC-18: stored Action markup is rendered as text',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const malicious='<img src=x onerror="window.issue8Injected=true">';expect((await postAction(page,ticket.id,{description:malicious})).status()).toBe(201);await page.reload();await expect(page.getByText(malicious,{exact:true})).toBeVisible();expect(await page.evaluate(()=>Boolean((window as any).issue8Injected))).toBe(false);expect(await page.locator('.action-description img').count()).toBe(0);
});
