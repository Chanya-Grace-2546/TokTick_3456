import {test,expect} from '../fixtures';
import {createTicket,asStaff,actions,login,logout,USERS,postAction,apiOrigin,clientOrigin} from './helpers';
import {startProcess,stopProcess} from '../processes';
test('E2E-01: create, assign, edit and complete work; owned Requester reads safely',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);
 await page.getByRole('button',{name:'Add Action',exact:true}).click();
 await page.getByLabel('Description (required)',{exact:true}).fill('Investigated network\nConnection restored.');
 await page.getByLabel('Assigned To',{exact:true}).selectOption({label:`${USERS.admin.name} (Administrator)`});
 await page.getByRole('button',{name:'Save Action',exact:true}).click();await expect(page.getByText('Action saved.',{exact:true})).toBeVisible();
 const action=(await actions(page,ticket.id)).items[0];expect(action.performedBy.name).toBe(USERS.staff.name);expect(action.assignedTo.name).toBe(USERS.admin.name);
 await page.getByRole('button',{name:`Edit Action ${action.id}`,exact:true}).click();await page.getByLabel('State',{exact:true}).selectOption('COMPLETED');await page.getByLabel('Result (required)',{exact:true}).fill('Validated successful connection');await page.getByRole('button',{name:'Save Action',exact:true}).click();
 await expect(page.getByRole('article',{name:`Action #${action.id}`})).toContainText('Completed');await expect(page.getByRole('button',{name:`Edit Action ${action.id}`,exact:true})).toHaveCount(0);
 await logout(page);await login(page,USERS.requester.email);await expect(page).toHaveURL(/\/dashboard$/);await page.goto(`/tickets/${ticket.id}`);await expect(page.getByText('Validated successful connection',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Add Action',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:/Internal Notes/})).toHaveCount(0);
 await logout(page);await login(page,USERS.otherRequester.email);await expect(page).toHaveURL(/\/dashboard$/);const response=await page.request.get(`${apiOrigin()}/api/tickets/${ticket.id}/actions`);expect(response.status()).toBe(404);
});
test('E2E-01/17: a committed POST with lost response retries the identical body/key once',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const attempts:{key:string;body:string}[]=[];
 await page.route('**/api/tickets/*/actions',async route=>{if(route.request().method()!=='POST')return route.continue();attempts.push({key:route.request().headers()['idempotency-key'],body:route.request().postData()!});if(attempts.length===1){const response=await route.fetch();expect(response.status()).toBe(201);await route.abort('failed');}else await route.continue();});
 await page.getByRole('button',{name:'Add Action',exact:true}).click();await page.getByLabel('Description (required)',{exact:true}).fill('Ambiguous persisted create');await page.getByRole('button',{name:'Save Action',exact:true}).click();await expect(page.getByRole('button',{name:'Retry original request',exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry original request',exact:true}).click();await expect(page.getByText('Action saved.',{exact:true})).toBeVisible();expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);expect((await actions(page,ticket.id)).items).toHaveLength(1);
});
test('AC-43: saved response and history survive an actual owned backend restart',async({page})=>{
 const ticket=await createTicket(page);await asStaff(page,ticket.id);const key=crypto.randomUUID(),body={description:'Restart durable creation'};
 const {PrismaClient}=await import('../../server/node_modules/@prisma/client/index.js');const {verifyE2ETarget}=await import('../../server/tests/helpers/e2eSafety.mjs');const prisma=new PrismaClient();
 let backend:Awaited<ReturnType<typeof startProcess>>|undefined;
 try {
  await verifyE2ETarget(prisma);
  backend=await startProcess('backend',process.env);
  const first=await page.request.post(`${backend.origin}/api/tickets/${ticket.id}/actions`,{headers:{Origin:clientOrigin(),'Idempotency-Key':key},data:body});expect(first.status()).toBe(201);const saved=await first.json();
  const history=await prisma.actionTakenHistory.findMany({where:{actionId:saved.action.id},orderBy:{id:'asc'}});expect(history).toHaveLength(1);
  await stopProcess(backend.child);backend=await startProcess('backend',process.env);
  const replay=await page.request.post(`${backend.origin}/api/tickets/${ticket.id}/actions`,{headers:{Origin:clientOrigin(),'Idempotency-Key':key},data:body});expect(replay.status()).toBe(201);expect(await replay.json()).toEqual(saved);
  const conflict=await page.request.post(`${backend.origin}/api/tickets/${ticket.id}/actions`,{headers:{Origin:clientOrigin(),'Idempotency-Key':key},data:{description:'Different'}});expect(conflict.status()).toBe(409);
  expect(await prisma.actionTakenHistory.findMany({where:{actionId:saved.action.id},orderBy:{id:'asc'}})).toEqual(history);expect(await prisma.actionTaken.count({where:{ticketId:ticket.id}})).toBe(1);
 } finally {if(backend)await stopProcess(backend.child);await prisma.$disconnect();}
});
