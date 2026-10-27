import { Priority, TicketStatus } from "@prisma/client";
const allowed = ["search","category","requestedPriority","itPriority","currentStatus","status","statusGroup","sortBy","sortDir","page","pageSize","requesterId"];
const sorts = ["ticketNumber","createdAt","updatedAt"] as const;
export function validateRequesterTicketQuery(query: Record<string, unknown>) {
  const fields: Record<string,string> = Object.create(null);
  for (const [key,value] of Object.entries(query)) {
    if (key === "requesterId") continue; // Legacy ignored parameter; never an authorization input.
    if (!allowed.includes(key)) fields[key] = "Unknown query parameter.";
    else if (typeof value !== "string") fields[key] = "Supply a single value.";
  }
  const text = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  function choice<T extends string>(key:string,values:readonly T[]) {
    const value = text(key);
    if (value !== undefined && value !== "" && !values.includes(value as T)) fields[key] = "Choose a valid value.";
    return value ? value as T : undefined;
  }
  const status = choice("status",Object.values(TicketStatus)), currentStatus = choice("currentStatus",Object.values(TicketStatus));
  if (status && currentStatus && status !== currentStatus) fields.status = "status and currentStatus must match.";
  const statusGroup = choice("statusGroup",["open"] as const);
  if (text("statusGroup") === "") fields.statusGroup = "Supply a valid status group.";
  if (text("status") === "") fields.status = "Supply a valid status.";
  const categoryText = text("category"), category = categoryText ? Number(categoryText) : undefined;
  if (category !== undefined && (!Number.isInteger(category) || category <= 0 || category > 2147483647)) fields.category = "Choose a valid category ID.";
  // Preserve Lab 2 defaults, accepted page sizes and the 50-row cap.
  const rawPage = Number(text("page")), rawSize = Number(text("pageSize"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize,50) : 10;
  if (!Number.isSafeInteger(page) || (page-1)*pageSize > 2147483647) fields.page = "Page exceeds the supported range.";
  const value = { search:text("search"), category, requestedPriority:choice("requestedPriority",Object.values(Priority)),
    itPriority:choice("itPriority",Object.values(Priority)), currentStatus:status ?? currentStatus, statusGroup,
    sortBy:sorts.includes(text("sortBy") as typeof sorts[number]) ? text("sortBy") as typeof sorts[number] : "createdAt" as const,
    sortDir:text("sortDir") === "asc" ? "asc" as const : "desc" as const, page,pageSize };
  return Object.keys(fields).length ? { fields, value: undefined } : { value, fields: undefined };
}
