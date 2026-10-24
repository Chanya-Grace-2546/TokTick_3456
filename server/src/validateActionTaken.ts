import { createHash } from "node:crypto";
import { ActionState } from "@prisma/client";

export class ActionError extends Error {
  constructor(public status: number, public code: string, public fields?: Record<string, string>) {
    super(code);
  }
}

export interface ActionFields {
  actionAt?: Date;
  description?: string;
  result?: string | null;
  assignedToUserId?: number | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  state?: ActionState;
}

const editable = ["actionAt", "description", "result", "assignedToUserId", "followUpRequired", "followUpNote", "attachmentNotes", "state"];
const maxInt = 2147483647;
export function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= maxInt;
}

export function actionPathId(value: string, field: "ticketId" | "actionId"): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !positiveInt(id)) {
    throw new ActionError(400, field === "ticketId" ? "INVALID_TICKET_ID" : "INVALID_ACTION_ID");
  }
  return id;
}

export function actionPagination(query: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  for (const key of Object.keys(query)) if (!["page", "pageSize"].includes(key)) fields[key] = "Unknown query parameter.";
  function read(key: string, fallback: number) {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !positiveInt(Number(value))) {
      fields[key] = "Use a positive integer within the supported range.";
      return fallback;
    }
    return Number(value);
  }
  const page = read("page", 1);
  const pageSize = read("pageSize", 20);
  if ((page - 1) * pageSize > maxInt) fields.page = "Page exceeds the supported range.";
  if (Object.keys(fields).length) throw new ActionError(400, "INVALID_QUERY", fields);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function isoDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return;
  const [, year, month, day, hour, minute, second, zone] = match;
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][+month - 1];
  if (+month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59) return;
  if (zone !== "Z" && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59)) return;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function validateActionBody(body: unknown, patch: boolean): { data: ActionFields; version?: number } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ActionError(422, "VALIDATION_ERROR", { body: "Supply a JSON object." });
  }
  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const data: ActionFields = {};
  for (const key of Object.keys(input)) if (!editable.includes(key) && !(patch && key === "version")) fields[key] = "Field is not editable.";
  for (const key of ["description", "result", "followUpNote", "attachmentNotes"] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    if (key !== "description" && value === null) data[key] = null;
    else if (typeof value !== "string") fields[key] = "Supply text" + (key === "description" ? "." : " or null.");
    else {
      data[key] = value;
      if (key === "description" && !value.trim()) fields[key] = "Description is required.";
      if (key === "result" && value.length > 2000) fields[key] = "Result must not exceed 2000 characters.";
    }
  }
  if (!patch && !("description" in input)) fields.description = "Description is required.";
  if ("actionAt" in input) {
    const value = isoDate(input.actionAt);
    if (!value) fields.actionAt = "Supply a valid ISO-8601 date/time with timezone.";
    else data.actionAt = value;
  }
  if ("assignedToUserId" in input) {
    if (input.assignedToUserId === null || positiveInt(input.assignedToUserId)) data.assignedToUserId = input.assignedToUserId;
    else fields.assignedToUserId = "Supply a valid User ID or null.";
  }
  if ("followUpRequired" in input) {
    if (typeof input.followUpRequired !== "boolean") fields.followUpRequired = "Supply a boolean.";
    else data.followUpRequired = input.followUpRequired;
  }
  if ("state" in input) {
    if (!Object.values(ActionState).includes(input.state as ActionState)) fields.state = "Choose a valid Action state.";
    else data.state = input.state as ActionState;
  }
  if (patch && !positiveInt(input.version)) fields.version = "Supply the current positive integer version.";
  if (Object.keys(fields).length) throw new ActionError(422, "VALIDATION_ERROR", fields);
  return { data, version: patch ? input.version as number : undefined };
}

export function validateActionResult(value: { state: ActionState; result: string | null; followUpRequired: boolean; followUpNote: string | null }) {
  const fields: Record<string, string> = {};
  if (value.result && value.result.length > 2000) fields.result = "Result must not exceed 2000 characters.";
  if (value.state === "COMPLETED" && !value.result?.trim()) fields.result = "Result is required when completing an Action.";
  if (value.followUpRequired && !value.followUpNote?.trim()) fields.followUpNote = "Required when follow-up is enabled.";
  if (Object.keys(fields).length) throw new ActionError(422, "VALIDATION_ERROR", fields);
}

export function idempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined) return;
  if (!value.trim()) throw new ActionError(422, "VALIDATION_ERROR", { idempotencyKey: "Supply a nonblank idempotency key." });
  return value;
}

// Hash client input, not time-dependent defaults; object key order is immaterial.
export function actionPayloadHash(body: unknown): string {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => [key, canonical(item)]));
    return value;
  }
  return createHash("sha256").update(JSON.stringify(canonical(body)) ?? "undefined").digest("hex");
}

export function idempotencyExpired(now: Date, expiresAt: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}
