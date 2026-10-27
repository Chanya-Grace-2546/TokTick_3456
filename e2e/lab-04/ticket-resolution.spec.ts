import {test,expect} from '../fixtures';
import {createTicket,asStaff,actions,status,postAction,apiOrigin,clientOrigin} from './helpers';
test('E2E-02: resolution gate, append-only outcome, read-only and reopen lifecycle',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);expect((await status(page,ticket.id,'OPEN')).status()).toBe(200);
 const created=await postAction(page,ticket.id,{description:'Repair',state:'COMPLETED',result:'Restored',followUpRequired:true,followUpNote:'Confirm stability'});expect(created.status()).toBe(201);const action=(await created.json()).action;
 const blocked=await status(page,ticket.id,'RESOLVED','OPEN');expect(blocked.status()).toBe(422);expect(await blocked.json()).toEqual({error:'RESOLUTION_BLOCKED'});
 await page.reload();await page.getByRole('button',{name:'Record Follow-Up Outcome',exact:true}).click();await page.getByLabel('Follow-Up Outcome (required)',{exact:true}).fill('Confirmed stable by follow-up');await page.getByRole('button',{name:'Record Outcome',exact:true}).click();await expect(page.getByText('Confirmed stable by follow-up',{exact:true})).toBeVisible();
 const resolved=await status(page,ticket.id,'RESOLVED','OPEN');expect(resolved.status()).toBe(200);await page.reload();await expect(page.getByText(/Actions on this Ticket are read-only/)).toBeVisible();expect((await actions(page,ticket.id)).items[0]).toMatchObject({version:action.version,followUpRequired:true,followUpResolution:{outcome:'Confirmed stable by follow-up'}});
 expect((await status(page,ticket.id,'CLOSED','RESOLVED')).status()).toBe(200);expect((await status(page,ticket.id,'REOPENED','CLOSED')).status()).toBe(200);await page.reload();await expect(page.getByRole('button',{name:'Add Action',exact:true})).toBeVisible();
});
test('E2E-02: cancellation cancels unfinished work and preserves completed work',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const pending=await postAction(page,ticket.id,{description:'Unfinished',state:'IN_PROGRESS'});expect(pending.status()).toBe(201);const completed=await postAction(page,ticket.id,{description:'Finished',state:'COMPLETED',result:'Done'});expect(completed.status()).toBe(201);
 expect((await status(page,ticket.id,'CANCELLED','NEW')).status()).toBe(200);const rows=(await actions(page,ticket.id)).items;expect(rows.find((row:any)=>row.description==='Unfinished')).toMatchObject({state:'CANCELLED',version:2});expect(rows.find((row:any)=>row.description==='Finished')).toMatchObject({state:'COMPLETED',version:1});await page.reload();await expect(page.getByRole('button',{name:'Add Action',exact:true})).toHaveCount(0);
});
test('E2E-02: stale edit requires review and retains the browser draft',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const response=await postAction(page,ticket.id,{description:'Original'});const action=(await response.json()).action;await page.reload();await page.getByRole('button',{name:`Edit Action ${action.id}`,exact:true}).click();await page.getByLabel('Description (required)',{exact:true}).fill('Unsaved draft');
 const updated=await page.request.patch(`${apiOrigin()}/api/tickets/${ticket.id}/actions/${action.id}`,{headers:{Origin:clientOrigin()},data:{version:1,description:'Concurrent staff update'}});expect(updated.status()).toBe(200);
 await page.getByRole('button',{name:'Save Action',exact:true}).click();await expect(page.getByText(/This Action changed. Your draft is retained/)).toBeVisible();await page.getByRole('button',{name:'Reload latest Action',exact:true}).click();await expect(page.getByRole('button',{name:'Use reviewed version',exact:true})).toBeVisible();await expect(page.getByLabel('Description (required)',{exact:true})).toHaveValue('Unsaved draft');expect((await actions(page,ticket.id)).items[0].description).toBe('Concurrent staff update');
});
test('AC-08/45: Requester advisory is not resolution and zero-Action legacy resolution remains valid',async({page})=>{
 const ticket=await createTicket(page);await page.goto(`/tickets/${ticket.id}`);await page.getByRole('button',{name:'Problem Appears Resolved',exact:true}).click();await expect(page.getByText(/appears resolved/i).first()).toBeVisible();
 const own=await page.request.get(`${apiOrigin()}/api/tickets/${ticket.id}`);expect((await own.json()).currentStatus).toBe('NEW');
 await asStaff(page,ticket.id);expect((await status(page,ticket.id,'OPEN')).status()).toBe(200);expect((await status(page,ticket.id,'RESOLVED','OPEN')).status()).toBe(200);expect((await actions(page,ticket.id)).items).toEqual([]);
});
