import { describe, expect, it } from "vitest";

import {
  canTransitionTicketStatus,
  permittedTicketStatusTransitions,
} from "../../src/statusTransitions.js";

describe("Lab 3 Issue 6 — Ticket status transitions", () => {
  const permitted: Record<string, string[]> = {
    NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
    OPEN: [
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ],
    IN_PROGRESS: [
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ],
    WAITING_FOR_REQUESTER: [
      "IN_PROGRESS",
      "RESOLVED",
      "CANCELLED",
    ],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: [
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ],
    CANCELLED: [],
  };

  const statuses = Object.keys(permitted);

  it("returns exactly the BR-30 permitted targets for every status", () => {
    for (const current of statuses) {
      expect(permittedTicketStatusTransitions(current as never)).toEqual(
        permitted[current]
      );
    }
  });

  it("allows every documented BR-30 transition", () => {
    for (const [current, targets] of Object.entries(permitted)) {
      for (const target of targets) {
        expect(
          canTransitionTicketStatus(current as never, target as never)
        ).toBe(true);
      }
    }
  });

  it("rejects same-status transitions", () => {
    for (const status of statuses) {
      expect(
        canTransitionTicketStatus(status as never, status as never)
      ).toBe(false);
    }
  });

  it("rejects every status pair not present in BR-30", () => {
    for (const current of statuses) {
      for (const target of statuses) {
        const shouldBeAllowed = permitted[current].includes(target);

        expect(
          canTransitionTicketStatus(current as never, target as never)
        ).toBe(shouldBeAllowed);
      }
    }
  });
});
