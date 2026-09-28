import { TicketStatus } from "@prisma/client";

// Lab 3 Issue 6 — Ticket status workflow.
//
// BR-30 defines every permitted status transition. Any pair that is not
// listed here, including a transition to the current status, is invalid.
// Keeping the matrix in one helper lets the API and unit tests use the same
// documented workflow rules.
export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, value)
  );
}

export function canTransitionTicketStatus(
  currentStatus: TicketStatus,
  targetStatus: TicketStatus
): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

export function permittedTicketStatusTransitions(
  currentStatus: TicketStatus
): readonly TicketStatus[] {
  return STATUS_TRANSITIONS[currentStatus];
}
