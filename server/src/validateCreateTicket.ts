// Lab 2 Issue 4 — Ticket Creation
// Pure validation function, kept separate from the route handler so it can
// be unit-tested directly (tests.md requires a Unit-level test level).

export interface CreateTicketInput {
  requesterId?: unknown;
  categoryId?: unknown;
  relatedSystemId?: unknown;
  summary?: unknown;
  description?: unknown;
  requestedPriority?: unknown;
}

export type FieldErrors = Record<string, string>;

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export function validateCreateTicket(input: CreateTicketInput): FieldErrors {
  const errors: FieldErrors = {};

  // BR-14: Summary required, trimmed, 5-120 chars.
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!summary) {
    errors.summary = "Summary is required";
  } else if (summary.length < 5 || summary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters";
  }

  // BR-15: Description required, trimmed, 10-2000 chars.
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description) {
    errors.description = "Description is required";
  } else if (description.length < 10 || description.length > 2000) {
    errors.description = "Description must be between 10 and 2000 characters";
  }

  // BR-16: Category, Related System, Requested Priority required.
  if (typeof input.categoryId !== "number" || !Number.isInteger(input.categoryId)) {
    errors.categoryId = "Category is required";
  }
  if (typeof input.relatedSystemId !== "number" || !Number.isInteger(input.relatedSystemId)) {
    errors.relatedSystemId = "Related System is required";
  }
  if (
    typeof input.requestedPriority !== "string" ||
    !VALID_PRIORITIES.includes(input.requestedPriority)
  ) {
    errors.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH";
  }

  if (typeof input.requesterId !== "number" || !Number.isInteger(input.requesterId)) {
    errors.requesterId = "A Development Requester must be selected";
  }

  return errors;
}
