import {Page,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {apiOrigin,clientOrigin} from '../fixtures';
import {login,logout,USERS} from '../lab-03/helpers';
export {login,logout,USERS,apiOrigin,clientOrigin};
export async function createTicket(page:Page,summary='Issue 8 isolated Ticket') {
 await login(page,USERS.requester.email);await expect(page).toHaveURL(/\/dashboard$/);
 const categories=await page.request.get(`${apiOrigin()}/api/categories`),systems=await page.request.get(`${apiOrigin()}/api/related-systems`);
 expect(categories.status()).toBe(200);expect(systems.status()).toBe(200);
 const response=await page.request.post(`${apiOrigin()}/api/tickets`,{headers:{Origin:clientOrigin()},data:{categoryId:(await categories.json())[0].id,relatedSystemId:(await systems.json())[0].id,summary:summary.slice(0,110),description:`Disposable full-stack fixture ${randomUUID()}`,requestedPriority:'MEDIUM'}});
 expect(response.status()).toBe(201);return response.json();
}
export async function asStaff(page:Page,ticketId:number) {await logout(page);await login(page,USERS.staff.email);await expect(page).toHaveURL(/\/staff\/dashboard$/);await page.goto(`/staff/tickets/${ticketId}`);await expect(page.getByRole('heading',{name:'Actions Taken',exact:true})).toBeVisible();}
export async function actions(page:Page,ticketId:number){const response=await page.request.get(`${apiOrigin()}/api/tickets/${ticketId}/actions`);expect(response.status()).toBe(200);return response.json();}
export async function status(page:Page,ticketId:number,value:string,expectedStatus?:string){return page.request.patch(`${apiOrigin()}/api/staff/tickets/${ticketId}/status`,{headers:{Origin:clientOrigin()},data:{status:value,...(expectedStatus?{expectedStatus}:{})}});}
export async function postAction(page:Page,ticketId:number,data:object,key?:string){return page.request.post(`${apiOrigin()}/api/tickets/${ticketId}/actions`,{headers:{Origin:clientOrigin(),...(key?{'Idempotency-Key':key}:{})},data});}
