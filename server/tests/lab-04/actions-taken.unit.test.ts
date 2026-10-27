import { describe, expect, it } from "vitest";
import { ActionState } from "@prisma/client";
import { canUpdateActionState } from "../../src/actionStateTransitions.js";
import { actionPagination, actionPathId, actionPayloadHash, validateActionBody, validateActionResult, idempotencyExpired } from "../../src/validateActionTaken.js";

describe("Action lifecycle and validation (UNIT-01, ACTION-STATE-01)", () => {
  const permitted = new Set(["PLANNED:PLANNED", "PLANNED:IN_PROGRESS", "PLANNED:COMPLETED", "PLANNED:CANCELLED",
    "IN_PROGRESS:IN_PROGRESS", "IN_PROGRESS:COMPLETED", "IN_PROGRESS:CANCELLED"]);
  for (const from of Object.values(ActionState)) for (const to of Object.values(ActionState)) {
    it(`${from} → ${to}`, () => expect(canUpdateActionState(from, to)).toBe(permitted.has(`${from}:${to}`)));
  }
  it.each([null, [], "text", 1, { description: " " }, { description: "x", performedByUserId: 1 },
    { description: "x", followUpRequired: "true" }, { description: "x", assignedToUserId: -1 },
    { description: "x", state: "OPEN" }, { description: "x", result: "x".repeat(2001) },
    { description: "x", actionAt: "2026-02-30T12:00:00Z" }, { description: "x", actionAt: "2026-01-01" },
    { description: "x", actionAt: "2026-01-01T25:00:00Z" }, { description: "x", actionAt: "2026-01-01T00:00:00+25:00" },
    { description: "x", attachmentNotes: 4 }, { description: null },
  ])("rejects invalid body %j", body => expect(() => validateActionBody(body, false)).toThrow());
  it("accepts nullable notes, timezone timestamps and the documented result limit", () => {
    const { data } = validateActionBody({ description: "x", result: "x".repeat(2000), assignedToUserId: null,
      followUpNote: null, attachmentNotes: null, actionAt: "2026-10-24T12:00:00+07:00" }, false);
    expect(data.actionAt?.toISOString()).toBe("2026-10-24T05:00:00.000Z");
  });
  it.each([{}, { version: 0 }, { version: "1" }, { version: 2147483648 }])("requires integer PATCH version %j", body => {
    expect(() => validateActionBody(body, true)).toThrow();
  });
  it("validates merged follow-up and completion data without adding a completion gate", () => {
    expect(() => validateActionResult({ state: "COMPLETED", result: "Done", followUpRequired: true, followUpNote: "Check tomorrow" })).not.toThrow();
    expect(() => validateActionResult({ state: "PLANNED", result: null, followUpRequired: true, followUpNote: " " })).toThrow();
    expect(() => validateActionResult({ state: "COMPLETED", result: " ", followUpRequired: false, followUpNote: null })).toThrow();
  });
  it("hashes equivalent object key order consistently and distinguishes null/omission", () => {
    expect(actionPayloadHash({ description: "x", state: "PLANNED" })).toBe(actionPayloadHash({ state: "PLANNED", description: "x" }));
    expect(actionPayloadHash({ description: "x" })).not.toBe(actionPayloadHash({ description: "x", result: null }));
  });
  it.each(["0", "-1", "1.2", "1e2", "2147483648", "abc"])("rejects malformed ID %s", id => {
    expect(() => actionPathId(id, "ticketId")).toThrow();
    expect(() => actionPathId(id, "actionId")).toThrow();
  });
  it("uses documented pagination defaults and rejects malformed/overflow queries", () => {
    expect(actionPagination({})).toEqual({ page: 1, pageSize: 20, skip: 0 });
    for (const query of [{ page: ["1", "2"] }, { page: "0" }, { sortBy: "id" }, { pageSize: "2147483648" }, { page: "2147483647", pageSize: "50" }]) {
      expect(() => actionPagination(query)).toThrow();
    }
  });
  it("expires at exact equality, preserving the half-open 24-hour window", () => {
    const expiresAt = new Date("2026-10-25T00:00:00.000Z");
    expect(idempotencyExpired(new Date(expiresAt.getTime() - 1), expiresAt)).toBe(false);
    expect(idempotencyExpired(expiresAt, expiresAt)).toBe(true);
    expect(idempotencyExpired(new Date(expiresAt.getTime() + 1), expiresAt)).toBe(true);
  });

});

it("bounds Action pages at 50 while retaining default 20", () => {
  expect(actionPagination({}).pageSize).toBe(20);
  expect(actionPagination({pageSize:"50"}).pageSize).toBe(50);
  expect(() => actionPagination({pageSize:"51"})).toThrow("INVALID_QUERY");
});
