const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  // TODO(Issue 2 & 4): implement the two fetch calls described above.
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Backend health check failed");
  }
  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error("Failed to load categories");
  }
  const categories: Category[] = await categoriesRes.json();

  return { online: true, categories };
}
// Lab 2 Issue 2 — Development Requester Context
export interface Requester {
  id: number;
  name: string;
  email: string;
}
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Failed to load categories");
  }
  return res.json();
}

export async function fetchActiveRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error("Failed to load development requesters");
  }
  return res.json();
}
// Lab 2 Issue 4 — Ticket Creation

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to load related systems");
  }
  return res.json();
}

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface CreateTicketPayload {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  status: string;
  createdAt: string;
}

export interface FieldErrors {
  [field: string]: string;
}

export class CreateTicketValidationError extends Error {
  fields: FieldErrors;
  constructor(fields: FieldErrors) {
    super("VALIDATION_FAILED");
    this.fields = fields;
  }
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 400) {
    const body = await res.json();
    throw new CreateTicketValidationError(body.fields ?? {});
  }
  if (!res.ok) {
    throw new Error("Failed to create ticket");
  }
  return res.json();
}

// Lab 2 Issue 5 — My Tickets

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  category: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  noResults: boolean;
}

export interface TicketListParams {
  requesterId: number;
  search?: string;
  category?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  currentStatus?: string;
  sortBy?: "ticketNumber" | "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function fetchTickets(params: TicketListParams): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });

  const res = await fetch(`${API_URL}/api/tickets?${query.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to load tickets");
  }
  return res.json();
}

// Lab 2 Issue 6 — Ticket Detail + Attachments

export interface AttachmentMeta {
  id: number;
  fileName: string;
  sizeBytes: number;
  mimeType?: string;
  isRemoved: boolean;
  removedAt: string | null;
  removedReason: string | null;
  createdAt: string;
}

export interface TicketDetailData {
  id: number;
  ticketNumber: string;
  requesterId: number;
  category: string;
  relatedSystem: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMeta[];
}

export class TicketNotFoundError extends Error {}

export async function fetchTicketDetail(
  ticketId: number,
  requesterId: number
): Promise<TicketDetailData> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}?requesterId=${requesterId}`);
  if (res.status === 404) {
    throw new TicketNotFoundError("TICKET_NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error("Failed to load ticket");
  }
  return res.json();
}

export class AttachmentUploadError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function uploadAttachment(
  ticketId: number,
  requesterId: number,
  file: File
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("requesterId", String(requesterId));
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UPLOAD_FAILED" }));
    throw new AttachmentUploadError(body.error ?? "UPLOAD_FAILED");
  }
  return res.json();
}

export function attachmentDownloadUrl(attachmentId: number, requesterId: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download?requesterId=${requesterId}`;
}

export async function removeAttachment(
  attachmentId: number,
  requesterId: number,
  reason: string
): Promise<AttachmentMeta> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, reason }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "REMOVE_FAILED" }));
    throw new Error(body.error ?? "REMOVE_FAILED");
  }
  return res.json();
}
