import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffDashboard from "../../src/pages/StaffDashboard.js";
import * as api from "../../src/api.js";
import { dashboardFixture as data } from "./helpers/staffDashboardFixture.js";
const refreshUser=vi.hoisted(()=>vi.fn().mockResolvedValue(undefined));
vi.mock("../../src/context/AuthContext.js",()=>({useAuth:()=>({refreshUser})}));
vi.mock("../../src/api.js",async original=>({...await original<typeof import("../../src/api.js")>(),fetchStaffDashboard:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchStaffDashboard).mockResolvedValue(data);});
function show(){return render(<MemoryRouter><Routes><Route path="/" element={<StaffDashboard/>}/><Route path="/login" element={<p>Login destination</p>}/><Route path="/change-password" element={<p>Password destination</p>}/></Routes></MemoryRouter>);}
it("renders accurate linked metrics, breakdowns, recent wire values and Bangkok dates",async()=>{
  show();await screen.findByText("Last updated:",{exact:false});
  for(const [name,key] of [["Unassigned Tickets","unassignedTickets"],["My Owned Tickets","myOwnedTickets"],["Tickets with My Actions","ticketsWithMyActions"],["Urgent Open Tickets","urgentOpenTickets"]] as const){const link=screen.getByRole("link",{name:new RegExp(name)});expect(link).toHaveAttribute("href",data.drillDown[key]);expect(link).toHaveTextContent(String(data.metrics[key]));}
  expect(screen.getByRole("link",{name:"Waiting for Requester: 1 Tickets"})).toHaveAttribute("href","/staff/tickets?status=WAITING_FOR_REQUESTER");
  expect(screen.getByRole("link",{name:"High: 3 Tickets"})).toHaveAttribute("href","/staff/tickets?itPriority=HIGH");
  expect(screen.getByRole("link",{name:"TKT-42 — Wi-Fi repair"})).toHaveAttribute("href","/staff/tickets/42");
  expect(screen.getAllByText(/27\/10\/2026, 00:00:00/)).toHaveLength(2);
  expect(screen.queryByRole("link",{name:/Create Ticket/i})).not.toBeInTheDocument();
});
it("shows loading rather than fake zeros",()=>{vi.mocked(api.fetchStaffDashboard).mockReturnValue(new Promise(()=>{}));show();expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");expect(screen.queryByRole("link",{name:/Unassigned Tickets/})).not.toBeInTheDocument();});
it("supports zero and empty results with usable links",async()=>{vi.mocked(api.fetchStaffDashboard).mockResolvedValue({...data,metrics:{unassignedTickets:0,myOwnedTickets:0,ticketsWithMyActions:0,urgentOpenTickets:0},recentTickets:[]});show();await screen.findByText("No recent tickets");expect(screen.getByRole("link",{name:/Unassigned Tickets/})).toHaveTextContent("0");});
it("retries safely without displaying exception details",async()=>{vi.mocked(api.fetchStaffDashboard).mockRejectedValueOnce(new Error("PRIVATE SQL"));show();await screen.findByRole("alert");expect(screen.queryByText("PRIVATE SQL")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Retry Dashboard"}));await screen.findByRole("link",{name:/Unassigned Tickets/});expect(api.fetchStaffDashboard).toHaveBeenCalledTimes(2);});
it.each([[401,"UNAUTHENTICATED","Login destination"],[403,"PASSWORD_CHANGE_REQUIRED","Password destination"]] as const)("handles auth failure %s",async(status,code,destination)=>{vi.mocked(api.fetchStaffDashboard).mockRejectedValue(new api.StaffQueueError(status,code));show();await screen.findByText(destination);expect(refreshUser).toHaveBeenCalledOnce();});
it("does not expose old metrics after a forbidden refresh",async()=>{show();await screen.findByRole("link",{name:/Unassigned Tickets/});vi.mocked(api.fetchStaffDashboard).mockRejectedValue(new api.StaffQueueError(403,"FORBIDDEN"));fireEvent.click(screen.getByRole("button",{name:"Refresh Dashboard"}));await screen.findByRole("alert");expect(screen.queryByRole("link",{name:/Unassigned Tickets/})).not.toBeInTheDocument();});
it("ignores a response after unmount",async()=>{let resolve!:(value:api.StaffDashboardData)=>void;vi.mocked(api.fetchStaffDashboard).mockReturnValue(new Promise(r=>{resolve=r;}));const view=show();view.unmount();await act(async()=>resolve(data));expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();});

it("renders all status/priority bars proportionally with accessible values and existing destinations",async()=>{
  show(); await screen.findByRole("progressbar",{name:"New proportion"});
  expect(screen.getAllByRole("progressbar")).toHaveLength(11);
  const progress=screen.getByRole("progressbar",{name:"In Progress proportion"});
  expect(progress).toHaveAttribute("aria-valuenow","3");expect(progress).toHaveAttribute("aria-valuemax","7");expect(progress).toHaveAttribute("aria-valuetext","3 of 7 Tickets (43%)");
  expect((progress.firstElementChild as HTMLElement).style.width).toBe(`${3/7*100}%`);
  expect(screen.getByRole("progressbar",{name:"Closed proportion"})).toHaveAttribute("aria-valuenow","0");
  for(const {priority,count} of data.byPriority)expect(screen.getByRole("link",{name:`${priority[0]+priority.slice(1).toLowerCase()}: ${count} Tickets`})).toHaveAttribute("href",`/staff/tickets?itPriority=${priority}`);
});
it("renders zero-total bars without invalid proportions",async()=>{
  vi.mocked(api.fetchStaffDashboard).mockResolvedValue({...data,byStatus:Object.fromEntries(Object.keys(data.byStatus).map(key=>[key,0])) as api.StaffDashboardData["byStatus"],byPriority:data.byPriority.map(row=>({...row,count:0}))});
  show();await screen.findByRole("progressbar",{name:"New proportion"});
  for(const bar of screen.getAllByRole("progressbar")){expect(bar).toHaveAttribute("aria-valuenow","0");expect(bar).toHaveAttribute("aria-valuetext","0 of 0 Tickets (0%)");expect(bar.firstElementChild).toHaveStyle({width:"0%"});}
});
it("keeps complete recent Ticket labels and summaries available despite visual truncation",async()=>{
  show();const link=await screen.findByRole("link",{name:"TKT-42 — Wi-Fi repair"});
  expect(link).toHaveClass("dashboard-ticket");expect(screen.getByTitle("Wi-Fi repair")).toHaveClass("dashboard-ticket-summary");
  expect(link.querySelector("time")).toHaveAttribute("dateTime",data.recentTickets[0].updatedAt);
  expect(link).toHaveTextContent("In Progress");expect(link).toHaveTextContent("Asia/Bangkok");
});
