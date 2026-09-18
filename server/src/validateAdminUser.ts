import { Role } from "@prisma/client";

export type AdminUserFields = {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
};

export class AdminValidationError extends Error {
  constructor(public fields: Record<string, string>, public code = "VALIDATION_FAILED") {
    super(code);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminValidationError({ body: "Provide a JSON object." });
  }
  return value as Record<string, unknown>;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && Object.values(Role).includes(value as Role);
}

export function validateAdminUser(body: unknown, creating: boolean): Partial<AdminUserFields> {
  const input = record(body);
  const fields: Record<string, string> = {};
  const value: Partial<AdminUserFields> = {};
  if (creating || "name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 100) {
      fields.name = "Name must contain 2–100 characters.";
    } else value.name = input.name.trim();
  }
  if (creating || "email" in input) {
    if (typeof input.email !== "string" || input.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      fields.email = "Enter a valid email address of at most 254 characters.";
    } else value.email = input.email.trim().toLowerCase();
  }
  if (creating || "role" in input) {
    if (!isRole(input.role)) fields.role = "Choose one permitted role.";
    else value.role = input.role;
  }
  if (creating || "isActive" in input) {
    if (typeof input.isActive !== "boolean") fields.isActive = "Active must be true or false.";
    else value.isActive = input.isActive;
  }
  if (!creating && Object.keys(value).length === 0 && Object.keys(fields).length === 0) {
    fields.body = "Provide at least one editable User field.";
  }
  if (Object.keys(fields).length) throw new AdminValidationError(fields);
  return value;
}

export function validateInitialPassword(body: unknown, confirmationRequired: boolean): string {
  const input = record(body);
  const password = input.initialPassword;
  const fields: Record<string, string> = {};
  if (typeof password !== "string" || password.length < 10 || password.length > 72 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    fields.initialPassword = "Password must be 10–72 characters with uppercase, lowercase, a digit, and a special character.";
  }
  if (confirmationRequired && (typeof input.confirmPassword !== "string" || input.confirmPassword !== password)) {
    fields.confirmPassword = "Passwords must match.";
  }
  if (Object.keys(fields).length) throw new AdminValidationError(fields);
  return password as string;
}

export function validateAdminQuery(query: Record<string, unknown>): { search?: string; role?: Role } {
  const fields: Record<string, string> = {};
  if (query.search !== undefined && typeof query.search !== "string") fields.search = "Provide one search string.";
  if (query.role !== undefined && !isRole(query.role)) fields.role = "Choose one permitted role.";
  if (Object.keys(fields).length) throw new AdminValidationError(fields, "INVALID_QUERY");
  return { search: (query.search as string | undefined)?.trim(), role: query.role as Role | undefined };
}
