import { expect,it } from "vitest";
import { validateRequesterTicketQuery as parse } from "../../src/validateRequesterTicketQuery.js";
it("preserves defaults, fallback sorts/pages, arbitrary page sizes and the cap",()=>{
  expect(parse({}).value).toMatchObject({page:1,pageSize:10,sortBy:"createdAt",sortDir:"desc"});
  expect(parse({page:"invalid",pageSize:"-1",sortBy:"summary",sortDir:"up"}).value).toMatchObject({page:1,pageSize:10,sortBy:"createdAt",sortDir:"desc"});
  expect(parse({pageSize:"2"}).value?.pageSize).toBe(2);expect(parse({pageSize:"100"}).value?.pageSize).toBe(50);
});
it("accepts matching aliases, rejects conflicts, and ignores all legacy identity input",()=>{
  expect(parse({status:"OPEN",currentStatus:"OPEN",requesterId:{arbitrary:"identity"}}).value?.currentStatus).toBe("OPEN");
  expect(parse({status:"OPEN",currentStatus:"RESOLVED"}).fields?.status).toBeDefined();
  expect(parse({requesterId:"123"}).value).not.toHaveProperty("requesterId");
});
it.each([{statusGroup:"closed"},{status:"invalid"},{status:["OPEN","OPEN"]},{userId:"2"},{category:"x"},{itPriority:"URGENT"},{page:"2147483647",pageSize:"50"}])("rejects invalid/structured/unsupported filters %j",query=>{expect(parse(query).fields).toBeDefined();});
