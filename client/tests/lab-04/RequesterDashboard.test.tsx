import { beforeEach,expect,it,vi } from "vitest";
import { act,fireEvent,render,screen } from "@testing-library/react";
import { MemoryRouter,Routes,Route } from "react-router-dom";
import RequesterDashboard from "../../src/pages/RequesterDashboard.js";
import * as api from "../../src/api.js";
import { requesterDashboardFixture as data } from "./helpers/requesterDashboardFixture.js";
const refresh=vi.hoisted(()=>vi.fn().mockResolvedValue(undefined));
vi.mock("../../src/context/AuthContext.js",()=>({useAuth:()=>({refreshUser:refresh})}));
vi.mock("../../src/api.js",async original=>({...await original<typeof import("../../src/api.js")>(),fetchRequesterDashboard:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(data);});
function show(){return render(<MemoryRouter><Routes><Route path="/" element={<RequesterDashboard/>}/><Route path="/login" element={<p>Login destination</p>}/><Route path="/change-password" element={<p>Password destination</p>}/></Routes></MemoryRouter>);}
it("shows the documented two metrics and two scoped recent lists with Bangkok dates",async()=>{
  show();await screen.findByRole("link",{name:"Open Tickets: 3"});
  expect(screen.getByRole("link",{name:"Open Tickets: 3"})).toHaveAttribute("href",data.drillDown.openTickets);
  expect(screen.getByRole("link",{name:"Waiting for Me: 1"})).toHaveAttribute("href",data.drillDown.waitingForRequester);
  expect(screen.getByRole("link",{name:"TKT-42 — My Wi-Fi request"})).toHaveAttribute("href","/tickets/42");expect(screen.getByRole("link",{name:"TKT-43 — My resolved request"})).toHaveAttribute("href","/tickets/43");
  expect(screen.getByRole("heading",{name:"My Dashboard"})).toBeInTheDocument();expect(screen.getAllByText(/28\/10\/2026, 00:00:00/)).toHaveLength(2);expect(screen.queryByText("Tickets by Status")).not.toBeInTheDocument();
});
it("shows loading rather than fake zero counts",()=>{vi.mocked(api.fetchRequesterDashboard).mockReturnValue(new Promise(()=>{}));show();expect(screen.getByRole("status")).toHaveTextContent("Loading");expect(screen.queryByRole("link",{name:/Open Tickets:/})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Refresh Dashboard"})).toBeDisabled();});
it("renders zero counts and independent empty messages with working links",async()=>{vi.mocked(api.fetchRequesterDashboard).mockResolvedValue({...data,metrics:{openTickets:0,waitingForRequester:0},recentlyUpdated:[],recentlyResolved:[]});show();await screen.findByText("No recently updated tickets");expect(screen.getByText("No recently resolved tickets")).toBeInTheDocument();expect(screen.getByText(/Older requests are still available/)).toBeInTheDocument();expect(screen.getAllByRole("link",{name:"View My Tickets"})).toHaveLength(2);expect(screen.getByRole("link",{name:"Open Tickets: 0"})).toHaveAttribute("href","/tickets?statusGroup=open");});
it("retries without leaking server details",async()=>{vi.mocked(api.fetchRequesterDashboard).mockRejectedValueOnce(new Error("PRIVATE SQL"));show();await screen.findByRole("alert");expect(screen.queryByText("PRIVATE SQL")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Retry Dashboard"}));await screen.findByRole("link",{name:/Open Tickets:/});expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(2);});
it.each([[401,"UNAUTHENTICATED","Login destination"],[403,"PASSWORD_CHANGE_REQUIRED","Password destination"]] as const)("handles auth %s safely",async(status,code,destination)=>{vi.mocked(api.fetchRequesterDashboard).mockRejectedValue(new api.RequesterApiError(status,code));show();await screen.findByText(destination);expect(refresh).toHaveBeenCalledOnce();});
it("clears previous data on a forbidden refresh",async()=>{show();await screen.findByRole("link",{name:/Open Tickets:/});vi.mocked(api.fetchRequesterDashboard).mockRejectedValue(new api.RequesterApiError(403,"FORBIDDEN"));fireEvent.click(screen.getByRole("button",{name:"Refresh Dashboard"}));await screen.findByRole("alert");expect(screen.queryByRole("link",{name:/Open Tickets:/})).not.toBeInTheDocument();});
it("ignores late responses after navigation/unmount",async()=>{let release!:(value:api.RequesterDashboardData)=>void;vi.mocked(api.fetchRequesterDashboard).mockReturnValue(new Promise(resolve=>{release=resolve;}));const view=show();view.unmount();await act(async()=>release(data));expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();});
