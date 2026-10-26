import { expect, it } from "vitest";
import { openTickets, ticketsWithMyActions, recentTicketWindow } from "../../src/staffTicketFilters.js";
it("defines the five open-work statuses independently of terminal/reopenable terminology", () => {
  expect(openTickets()).toEqual({status:{in:["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","REOPENED"]}});
});
it("matches assignment rather than performer and counts Ticket existence rather than Action rows", () => {
  expect(ticketsWithMyActions(7)).toEqual({actionsTaken:{some:{assignedToUserId:7,state:{in:["PLANNED","IN_PROGRESS"]}}}});
});
it("uses inclusive rolling UTC bounds across Bangkok midnight", () => {
  const end = new Date("2026-10-26T17:00:00.123Z");
  expect(recentTicketWindow(end)).toEqual({gte:new Date("2026-10-19T17:00:00.123Z"),lte:end});
});
