import { afterEach,expect,it,vi } from "vitest";
import { fetchRequesterDashboard,fetchTickets,RequesterApiError } from "../../src/api.js";
import { requesterDashboardFixture as data } from "./helpers/requesterDashboardFixture.js";
afterEach(()=>vi.unstubAllGlobals());
it("calls the documented endpoint with cookies and no client-supplied identity",async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));vi.stubGlobal("fetch",fetch);expect(await fetchRequesterDashboard()).toEqual(data);expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/dashboard\/requester$/),{credentials:"include"});});
it("preserves typed HTTP errors for dashboard and My Tickets",async()=>{vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({error:"UNAUTHENTICATED"}),{status:401}))));await expect(fetchRequesterDashboard()).rejects.toBeInstanceOf(RequesterApiError);await expect(fetchTickets({})).rejects.toMatchObject({status:401,code:"UNAUTHENTICATED"});});
it("serializes both new filters and the legacy status alias",async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({items:[]})));vi.stubGlobal("fetch",fetch);await fetchTickets({statusGroup:"open",status:"OPEN",currentStatus:"OPEN",pageSize:2});expect(fetch.mock.calls[0][0]).toContain("statusGroup=open&status=OPEN&currentStatus=OPEN&pageSize=2");});
