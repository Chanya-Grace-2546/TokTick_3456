export interface CreateTicketInput {
  categoryId?: unknown;
  relatedSystemId?: unknown;
  summary?: unknown;
  description?: unknown;
  requestedPriority?: unknown;
}

export interface ValidationErrors {
  [field: string]: string;
}

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

// ---------------------------------------------------------------------------
// Lab 2 Issue 4 — Create Ticket validation
//
// Lab 3 authentication change:
// requesterId is intentionally NOT validated here anymore.
// The Requester identity comes from the authenticated Session on the server.
// ---------------------------------------------------------------------------
export function validateCreateTicket(
  input: CreateTicketInput
): ValidationErrors {
  const errors: ValidationErrors = {};

  // Category is required and must be represented by an integer ID.
  if (
    typeof input.categoryId !== "number" ||
    !Number.isInteger(input.categoryId)
  ) {
    errors.categoryId = "Category is required";
  }

  // Related System is required and must be represented by an integer ID.
  if (
    typeof input.relatedSystemId !== "number" ||
    !Number.isInteger(input.relatedSystemId)
  ) {
    errors.relatedSystemId = "Related System is required";
  }

  // BR-14:
  // Summary is required and must contain at least 5 characters.
  if (
    typeof input.summary !== "string" ||
    input.summary.trim().length === 0
  ) {
    errors.summary = "Summary is required";
  } else if (input.summary.trim().length < 5) {
    errors.summary = "Summary must be at least 5 characters";
  } else if (input.summary.trim().length > 150) {
    errors.summary = "Summary must be 150 characters or fewer";
  }

  // BR-15:
  // Description is required and must contain at least 10 characters.
  if (
    typeof input.description !== "string" ||
    input.description.trim().length === 0
  ) {
    errors.description = "Description is required";
  } else if (input.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (input.description.trim().length > 5000) {
    errors.description = "Description must be 5000 characters or fewer";
  }

  // Requested Priority must be one of the supported values.
  if (
    typeof input.requestedPriority !== "string" ||
    !VALID_PRIORITIES.includes(input.requestedPriority)
  ) {
    errors.requestedPriority = "Requested Priority is required";
  }

  return errors;
}