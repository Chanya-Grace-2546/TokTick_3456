import { StaffDashboardData } from "../../../src/api.js";
export const dashboardFixture: StaffDashboardData = {
  asOf: "2026-10-26T17:00:00.000Z",
  metrics: { unassignedTickets: 4, myOwnedTickets: 6, ticketsWithMyActions: 2, urgentOpenTickets: 3 },
  byStatus: { NEW: 1, OPEN: 2, IN_PROGRESS: 3, WAITING_FOR_REQUESTER: 1, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
  byPriority: [{priority:"LOW",count:2},{priority:"MEDIUM",count:2},{priority:"HIGH",count:3}],
  recentTickets: [{id:42,ticketNumber:"TKT-42",summary:"Wi-Fi repair",status:"IN_PROGRESS",updatedAt:"2026-10-26T17:00:00.000Z",href:"/staff/tickets/42"}],
  drillDown: {unassignedTickets:"/staff/tickets?owner=unassigned&statusGroup=open",myOwnedTickets:"/staff/tickets?owner=me&statusGroup=open",ticketsWithMyActions:"/staff/tickets?myAction=true",urgentOpenTickets:"/staff/tickets?itPriority=HIGH&statusGroup=open"},
};
