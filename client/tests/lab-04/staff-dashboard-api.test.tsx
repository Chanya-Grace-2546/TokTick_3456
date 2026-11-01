import { afterEach, expect, it, vi } from "vitest";
import { fetchStaffDashboard, fetchStaffTickets, StaffQueueError } from "../../src/api.js";
import { dashboardFixture } from "./helpers/staffDashboardFixture.js";
afterEach(()=>vi.unstubAllGlobals());
it("uses the documented staff endpoint with session cookies",async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(dashboardFixture)));vi.stubGlobal("fetch",fetch);expect(await fetchStaffDashboard()).toEqual(dashboardFixture);expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/staff"),{credentials:"include"});});
it("retains existing typed safe errors",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:"FORBIDDEN"}),{status:403})));await expect(fetchStaffDashboard()).rejects.toBeInstanceOf(StaffQueueError);});
it("serializes additive staff drill-down filters without changing the Queue envelope",async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({items:[],totalItems:0,page:1,pageSize:10,totalPages:1})));vi.stubGlobal("fetch",fetch);await fetchStaffTickets({statusGroup:"open",myAction:true,owner:"me"});expect(fetch.mock.calls[0][0]).toContain("statusGroup=open&myAction=true&owner=me");});
