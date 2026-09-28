import { Priority, TicketStatus } from "@prisma/client";

const SORT_FIELDS = ["ticketNumber", "createdAt", "updatedAt", "requestedPriority", "itPriority", "status"] as const;
const QUERY_FIELDS = ["search", "category", "requestedPriority", "itPriority", "status", "owner", "sortBy", "sortDir", "page", "pageSize"];

interface StaffQueueQuery {
  search?: string;
  category?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  status?: TicketStatus;
  owner?: "unassigned" | "me" | number;
  sortBy: typeof SORT_FIELDS[number];
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}

// Staff queries are deliberately separate from the permissive Lab 2 list.
// Reject repeated/structured parameters instead of silently broadening a view.
export function validateStaffQueueQuery(query: Record<string, unknown>):
  | { fields: Record<string, string>; value?: never }
  | { value: StaffQueueQuery; fields?: never } {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!QUERY_FIELDS.includes(key)) fields[key] = "Unknown query parameter.";
    else if (typeof value !== "string") fields[key] = "Supply a single value.";
  }

  function text(key: string): string | undefined {
    return typeof query[key] === "string" ? query[key] as string : undefined;
  }

  function positiveInteger(key: string, fallback?: number): number | undefined {
    const raw = text(key);
    if (raw === undefined) return fallback;
    const number = Number(raw);
    if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
      fields[key] = "Use a positive integer within the supported range.";
      return fallback;
    }
    return number;
  }

  function choice<T extends string>(key: string, allowed: readonly T[], fallback?: T): T | undefined {
    const raw = text(key);
    if (raw === undefined) return fallback;
    if (!allowed.includes(raw as T)) {
      fields[key] = `Choose one of: ${allowed.join(", ")}.`;
      return fallback;
    }
    return raw as T;
  }

  const page = positiveInteger("page", 1)!;
  const pageSize = positiveInteger("pageSize", 10)!;
  if (![10, 20, 50].includes(pageSize)) fields.pageSize = "Choose 10, 20, or 50.";
  if ((page - 1) * pageSize > 2147483647) fields.page = "Page exceeds the supported range.";
  const ownerText = text("owner");
  const owner = ownerText === "me" || ownerText === "unassigned" ? ownerText : positiveInteger("owner");

  const value: StaffQueueQuery = {
    search: text("search")?.trim(),
    category: positiveInteger("category"),
    requestedPriority: choice("requestedPriority", Object.values(Priority)),
    itPriority: choice("itPriority", Object.values(Priority)),
    status: choice("status", Object.values(TicketStatus)),
    owner,
    sortBy: choice("sortBy", SORT_FIELDS, "updatedAt")!,
    sortDir: choice("sortDir", ["asc", "desc"] as const, "desc")!,
    page, pageSize,
  };
  return Object.keys(fields).length ? { fields } : { value };
}
