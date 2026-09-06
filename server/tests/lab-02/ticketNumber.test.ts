import { describe, it, expect } from "vitest";
import { formatTicketNumber } from "../../src/ticketNumber.js";

describe("formatTicketNumber", () => {
  it("pads the sequence to 6 digits", () => {
    expect(formatTicketNumber(2026, 1)).toBe("TKT-2026-000001");
  });

  it("does not truncate a sequence already 6+ digits", () => {
    expect(formatTicketNumber(2026, 123456)).toBe("TKT-2026-123456");
  });

  it("uses the given year", () => {
    expect(formatTicketNumber(2027, 5)).toBe("TKT-2027-000005");
  });
});
