import { beforeEach,expect,it,vi } from "vitest";
import { fireEvent,render,screen,waitFor } from "@testing-library/react";
import { MemoryRouter,useNavigate } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { requesterDashboardFixture } from "./helpers/requesterDashboardFixture.js";
import { dashboardFixture } from "./helpers/staffDashboardFixture.js";
vi.mock("../../src/pages/UserManagement.js",()=>({default:()=> <h1>Users</h1>}));
const person:api.AuthUser={id:9,name:"Requester",email:"requester@example.test",role:"REQUESTER",isActive:true,mustChangePassword:false};
beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(api,"getMe").mockResolvedValue(person);vi.spyOn(api,"fetchRequesterDashboard").mockResolvedValue(requesterDashboardFixture);vi.spyOn(api,"fetchStaffDashboard").mockResolvedValue(dashboardFixture);vi.spyOn(api,"fetchTickets").mockImplementation(async params=>({items:[{id:42,ticketNumber:"TKT-42",summary:"My Ticket",category:"Network",requestedPriority:"MEDIUM",itPriority:"MEDIUM",currentStatus:"OPEN",createdAt:requesterDashboardFixture.asOf,updatedAt:requesterDashboardFixture.asOf}],page:params.page??1,pageSize:2,totalItems:8,totalPages:4,noResults:false}));});
function History(){const navigate=useNavigate();return <><button onClick={()=>navigate(-1)}>Browser Back</button><button onClick={()=>navigate(1)}>Browser Forward</button></>;}
function show(path="/"){return render(<MemoryRouter initialEntries={[path]}><History/><App/></MemoryRouter>);}
it("lands Requesters on My Dashboard with desktop/mobile navigation and preserved quick actions",async()=>{show();await screen.findByRole("heading",{name:"My Dashboard"});expect(screen.getByRole("link",{name:"Dashboard"})).toHaveAttribute("href","/dashboard");fireEvent.click(screen.getByRole("button",{name:"Toggle navigation"}));expect(screen.getAllByRole("link",{name:"Dashboard"})).toHaveLength(2);expect(screen.getAllByRole("link",{name:/Create Ticket/}).length).toBeGreaterThan(0);});
it.each([["IT_STAFF","IT Staff Dashboard"],["ADMINISTRATOR","Users"]] as const)("preserves %s landing and denies requester dashboard data",async(role,heading)=>{vi.mocked(api.getMe).mockResolvedValue({...person,role});show("/dashboard");await screen.findByRole("heading",{name:heading});expect(api.fetchRequesterDashboard).not.toHaveBeenCalled();});
it.each(["/tickets?statusGroup=open&pageSize=2","/tickets?status=WAITING_FOR_REQUESTER&pageSize=2"])("supports filter/pagination/browser history at %s",async path=>{
  show(path);await waitFor(()=>expect(api.fetchTickets).toHaveBeenCalled());const filter=path.includes("statusGroup")?{statusGroup:"open"}:{status:"WAITING_FOR_REQUESTER"};expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining(filter));
  fireEvent.click(screen.getByRole("button",{name:"Next"}));await waitFor(()=>expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({...filter,page:2})));
  fireEvent.click(screen.getByRole("button",{name:"Browser Back"}));await waitFor(()=>expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({...filter,page:1})));
  fireEvent.click(screen.getByRole("button",{name:"Browser Forward"}));await waitFor(()=>expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({...filter,page:2})));
  fireEvent.click(screen.getByRole("button",{name:"Clear Filters"}));await waitFor(()=>expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.not.objectContaining(filter)));
});
it("refuses repeated status filters instead of silently broadening results",async()=>{show("/tickets?status=OPEN&status=RESOLVED");await screen.findByRole("alert");expect(api.fetchTickets).not.toHaveBeenCalled();});
it("redirects expired My Tickets access through existing auth refresh",async()=>{vi.mocked(api.getMe).mockResolvedValueOnce(person).mockResolvedValue(null);vi.mocked(api.fetchTickets).mockRejectedValue(new api.RequesterApiError(401,"UNAUTHENTICATED"));show("/tickets");await screen.findByRole("button",{name:/sign in/i});expect(screen.queryByText(/Page 1/)).not.toBeInTheDocument();});
it("gates initial password setup before dashboard loading",async()=>{vi.mocked(api.getMe).mockResolvedValue({...person,mustChangePassword:true});show("/dashboard");await screen.findByLabelText(/confirm new password/i);expect(api.fetchRequesterDashboard).not.toHaveBeenCalled();});

it("recovers a URL page beyond the current result set without dropping filters",async()=>{
  vi.mocked(api.fetchTickets).mockImplementation(async params=>({items:[],page:params.page??1,pageSize:2,totalItems:1,totalPages:1,noResults:false}));
  show("/tickets?statusGroup=open&page=99");fireEvent.click(await screen.findByRole("button",{name:"Return to first page"}));
  await waitFor(()=>expect(api.fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({page:1,statusGroup:"open"})));
});
