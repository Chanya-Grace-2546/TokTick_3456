import { test as base, expect } from '@playwright/test';
export const test=base.extend({baseURL:async({},use)=>{
  const origin=process.env.TOKTICKIT_E2E_BASE_URL;
  if(!origin || new URL(origin).hostname!=='localhost')throw new Error('Missing owned E2E frontend.');
  await use(origin);
}});
export {expect};
export function apiOrigin(){const origin=process.env.TOKTICKIT_E2E_API_URL;if(!origin || new URL(origin).hostname!=='localhost')throw new Error('Missing owned E2E backend.');return origin;}
export function clientOrigin(){const origin=process.env.TOKTICKIT_E2E_BASE_URL;if(!origin)throw new Error('Missing owned E2E frontend.');return origin;}
