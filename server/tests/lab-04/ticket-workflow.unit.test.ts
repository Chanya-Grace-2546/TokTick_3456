import { expect, it } from "vitest";
import { resolutionBlocked, validateTicketTransition } from "../../src/ticketWorkflow.js";
import { actionWritesAllowed } from "../../src/actionTakenService.js";
it("accepts legacy and conditional status bodies without inventing a Ticket version", () => {
  expect(validateTicketTransition({ status: "OPEN" })).toEqual({ status: "OPEN", expectedStatus: undefined });
  expect(validateTicketTransition({ status: "RESOLVED", expectedStatus: "OPEN" })).toEqual({ status: "RESOLVED", expectedStatus: "OPEN" });
  expect(() => validateTicketTransition({ status: "OPEN", expectedStatus: "invalid" })).toThrow();
});
it("requires completed non-cancelled work and satisfied follow-up, including zero Actions", () => {
  expect(resolutionBlocked([])).toBe(false);
  for (const state of ["PLANNED", "IN_PROGRESS"]) expect(resolutionBlocked([{ state, followUpRequired: false, satisfied: false }])).toBe(true);
  expect(resolutionBlocked([{ state: "COMPLETED", followUpRequired: true, satisfied: false }])).toBe(true);
  expect(resolutionBlocked([{ state: "COMPLETED", followUpRequired: true, satisfied: true }, { state: "CANCELLED", followUpRequired: true, satisfied: false }])).toBe(false);
});
it("restricts writes on Resolved and Closed without treating them as unreopenable", () => {
  for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) expect(actionWritesAllowed(status)).toBe(false);
  expect(actionWritesAllowed("REOPENED")).toBe(true);
});
