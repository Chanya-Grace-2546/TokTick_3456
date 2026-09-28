const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Lab 3 Issue 7 — Administrator User Management.
export type AdminUser = AuthUser;
export type AdminUserFields = Pick<AdminUser, "name" | "email" | "role" | "isActive">;
export interface AdminUserQuery { search?: string; role?: UserRole }
export class AdminUserError extends Error {
  constructor(public status: number, public code: string, public fields: FieldErrors = {}) { super(code); }
}

async function adminRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api/admin/users${path}`, {
    method, credentials: "include",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new AdminUserError(response.status, error.error ?? "ADMIN_REQUEST_FAILED", error.fields ?? {});
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function fetchAdminUsers(params: AdminUserQuery): Promise<{ items: AdminUser[] }> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  return adminRequest(query.size ? `?${query}` : "");
}
export function createAdminUser(body: AdminUserFields & { initialPassword: string }): Promise<AdminUser> {
  return adminRequest("", "POST", body);
}
export function updateAdminUser(id: number, body: Partial<AdminUserFields>): Promise<AdminUser> {
  return adminRequest(`/${id}`, "PATCH", body);
}
export function setAdminInitialPassword(id: number, body: { initialPassword: string; confirmPassword: string }): Promise<void> {
  return adminRequest(`/${id}/initial-password`, "POST", body);
}

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

  const categoriesRes = await fetch(
    `${API_URL}/api/categories`,
    { credentials: "include" }
  );

  if (!categoriesRes.ok) {
    throw new Error("Failed to load categories");
  }

  const categories: Category[] =
    await categoriesRes.json();

  return {
    online: true,
    categories,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(
    `${API_URL}/api/categories`,
    { credentials: "include" }
  );

  if (!res.ok) {
    throw new Error("Failed to load categories");
  }

  return res.json();
}

// Lab 2 Issue 4 — Ticket Creation
// Lab 3: Requester identity now comes from the authenticated Session.

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(
    `${API_URL}/api/related-systems`,
    { credentials: "include" }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to load related systems"
    );
  }

  return res.json();
}

export type Priority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface CreateTicketPayload {
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

export async function createTicket(
  payload: CreateTicketPayload
): Promise<Ticket> {
  const res = await fetch(
    `${API_URL}/api/tickets`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (res.status === 400) {
    const body = await res.json();

    throw new CreateTicketValidationError(
      body.fields ?? {}
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "CREATE_TICKET_FAILED",
      }));

    throw new Error(
      body.error ?? "Failed to create ticket"
    );
  }

  return res.json();
}

// Lab 2 Issue 5 — My Tickets
// Lab 3: requesterId is no longer supplied by the client.

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
  search?: string;
  category?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  currentStatus?: string;
  sortBy?:
    | "ticketNumber"
    | "createdAt"
    | "updatedAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// Lab 3 Issue 5 — shared Staff Queue. This is not the Requester list contract.
export type StaffTicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
export type StaffQueueSort = "ticketNumber" | "createdAt" | "updatedAt" | "requestedPriority" | "itPriority" | "status";

export interface StaffQueueParams {
  search?: string;
  category?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  status?: StaffTicketStatus;
  owner?: "unassigned" | "me" | number;
  sortBy?: StaffQueueSort;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export interface StaffQueueItem {
  id: number;
  ticketNumber: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  category: Category;
  requester: { id: number; name: string; email: string };
  requestedPriority: Priority;
  itPriority: Priority;
  status: StaffTicketStatus;
  owner: { id: number; name: string } | null;
}

export interface StaffQueueResponse {
  items: StaffQueueItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StaffOwner {
  id: number;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}

export class StaffQueueError extends Error {
  constructor(public status: number, public code: string, public fields: FieldErrors = {}) {
    super(code);
  }
}

async function readStaffResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new StaffQueueError(res.status, body.error ?? "LOAD_QUEUE_FAILED", body.fields ?? {});
  }
  return res.json();
}

export async function fetchStaffTickets(params: StaffQueueParams): Promise<StaffQueueResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return readStaffResponse(await fetch(`${API_URL}/api/staff/tickets${suffix}`, { credentials: "include" }));
}

export async function fetchStaffOwners(): Promise<StaffOwner[]> {
  return readStaffResponse(await fetch(`${API_URL}/api/staff/owners`, { credentials: "include" }));
}

export async function fetchTickets(
  params: TicketListParams
): Promise<TicketListResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        );
      }
    }
  );

  const queryString = query.toString();

  const url = queryString
    ? `${API_URL}/api/tickets?${queryString}`
    : `${API_URL}/api/tickets`;

  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "LOAD_TICKETS_FAILED",
      }));

    throw new Error(
      body.error ?? "Failed to load tickets"
    );
  }

  return res.json();
}

// Lab 2 Issue 6 — Ticket Detail + Attachments
// Lab 3: ownership is determined from the authenticated Session.

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

  // Lab 3 Issue 4 — Requester apparent-resolution indication.
  // This does not formally change the Ticket status.
requesterResolvedAt?: string | null;
requesterResolvedById?: number | null;

  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMeta[];
}

export class TicketNotFoundError extends Error {}

export async function fetchTicketDetail(
  ticketId: number
): Promise<TicketDetailData> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}`,
    {
      credentials: "include",
    }
  );

  if (res.status === 404) {
    throw new TicketNotFoundError(
      "TICKET_NOT_FOUND"
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "LOAD_TICKET_FAILED",
      }));

    throw new Error(
      body.error ?? "Failed to load ticket"
    );
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
  file: File
): Promise<AttachmentMeta> {
  const formData = new FormData();

  formData.append("file", file);

  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/attachments`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "UPLOAD_FAILED",
      }));

    throw new AttachmentUploadError(
      body.error ?? "UPLOAD_FAILED"
    );
  }

  return res.json();
}

// Lab 3:
// Attachment downloads are authenticated, so use this helper instead of
// putting requesterId in the download URL.
export async function downloadAttachment(
  attachmentId: number
): Promise<Blob> {
  const res = await fetch(
    `${API_URL}/api/attachments/${attachmentId}/download`,
    {
      credentials: "include",
    }
  );

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "DOWNLOAD_FAILED",
      }));

    throw new Error(
      body.error ?? "DOWNLOAD_FAILED"
    );
  }

  return res.blob();
}

export async function removeAttachment(
  attachmentId: number,
  reason: string
): Promise<AttachmentMeta> {
  const res = await fetch(
    `${API_URL}/api/attachments/${attachmentId}/remove`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason,
      }),
    }
  );

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "REMOVE_FAILED",
      }));

    throw new Error(
      body.error ?? "REMOVE_FAILED"
    );
  }

  return res.json();
}

// Lab 3 Issue 3 — Authentication

export type UserRole =
  | "REQUESTER"
  | "IT_STAFF"
  | "ADMINISTRATOR";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  user: AuthUser;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(
    `${API_URL}/api/auth/login`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error ?? "LOGIN_FAILED"
    );
  }

  // A successful authentication guarantees an active account. Keep the
  // client user model while reading only the documented authentication fields.
  return { user: { ...body.user, isActive: true, mustChangePassword: body.mustChangePassword } };
}

export async function logout(): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/auth/logout`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (
    !res.ok &&
    res.status !== 401
  ) {
    throw new Error("LOGOUT_FAILED");
  }
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await fetch(
    `${API_URL}/api/auth/me`,
    {
      credentials: "include",
    }
  );

  if (res.status === 401) {
    return null;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error ?? "ME_FAILED"
    );
  }

  return { ...body, isActive: true };
}

export async function changePassword(
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/auth/change-password`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        newPassword,
        confirmPassword,
      }),
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error ??
        "CHANGE_PASSWORD_FAILED"
    );
  }
}

// Lab 3 Issue 4 — Public Comments

export interface PublicCommentAuthor {
  id: number;
  name: string;
  role: UserRole;
}

export interface PublicComment {
  id: number;
  content: string;
  author: PublicCommentAuthor;
  createdAt: string;
}

export interface PublicCommentsResponse {
  items: PublicComment[];
}

export async function fetchPublicComments(
  ticketId: number
): Promise<PublicCommentsResponse> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/comments`,
    {
      credentials: "include",
    }
  );

  if (res.status === 404) {
    throw new TicketNotFoundError(
      "TICKET_NOT_FOUND"
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "LOAD_COMMENTS_FAILED",
      }));

    throw new Error(
      body.error ??
        "Failed to load Public Comments"
    );
  }

  return res.json();
}

export async function createPublicComment(
  ticketId: number,
  content: string
): Promise<PublicComment> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/comments`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    }
  );

  if (res.status === 404) {
    throw new TicketNotFoundError(
      "TICKET_NOT_FOUND"
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error: "CREATE_COMMENT_FAILED",
      }));

    throw new Error(
      body.error ??
        "Failed to create Public Comment"
    );
  }

  return res.json();
}

// Lab 3 Issue 4 — Requester apparent-resolution indication.
// This action records the Requester's indication only.
// It does not formally resolve or close the Ticket.

export interface ProblemAppearsResolvedResponse {
  requesterResolvedAt: string;
  status: string;
}

export async function markProblemAppearsResolved(
  ticketId: number
): Promise<ProblemAppearsResolvedResponse> {
  const res = await fetch(
    `${API_URL}/api/tickets/${ticketId}/problem-appears-resolved`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (res.status === 404) {
    throw new TicketNotFoundError(
      "TICKET_NOT_FOUND"
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({
        error:
          "PROBLEM_APPEARS_RESOLVED_FAILED",
      }));

    throw new Error(
      body.error ??
        "Failed to save resolution indication"
    );
  }

  return res.json();
}


// Lab 3 Issue 6 — IT Staff Ticket Detail & Operations

export interface StaffTicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  status: StaffTicketStatus;
  requesterResolvedAt: string | null;
  requesterResolvedById: number | null;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: number;
    name: string;
    email: string;
  };
  category: Category;
  relatedSystem: RelatedSystem;
  owner: StaffOwner | null;
  attachments: AttachmentMeta[];
  publicComments: PublicComment[];
  internalNotes: InternalNote[];
}

export interface InternalNote {
  id: number;
  content: string;
  author: PublicCommentAuthor;
  createdAt: string;
}

export interface InternalNotesResponse {
  items: InternalNote[];
}

export class StaffTicketOperationError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields: FieldErrors = {}
  ) {
    super(code);
  }
}

async function readStaffOperationResponse<T>(
  res: Response
): Promise<T> {
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({}));

    throw new StaffTicketOperationError(
      res.status,
      body.error ?? "STAFF_TICKET_OPERATION_FAILED",
      body.fields ?? {}
    );
  }

  return res.json();
}

export async function fetchStaffTicketDetail(
  ticketId: number
): Promise<StaffTicketDetail> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/staff/tickets/${ticketId}`,
      {
        credentials: "include",
      }
    )
  );
}

export async function claimStaffTicket(
  ticketId: number
): Promise<{
  id: number;
  owner: StaffOwner;
}> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/staff/tickets/${ticketId}/claim`,
      {
        method: "POST",
        credentials: "include",
      }
    )
  );
}

export async function updateStaffTicketOwner(
  ticketId: number,
  ownerId: number | null
): Promise<{
  id: number;
  owner: StaffOwner | null;
}> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/staff/tickets/${ticketId}/owner`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerId,
        }),
      }
    )
  );
}

export async function updateStaffTicketPriority(
  ticketId: number,
  itPriority: Priority
): Promise<{
  id: number;
  requestedPriority: Priority;
  itPriority: Priority;
}> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/staff/tickets/${ticketId}/it-priority`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itPriority,
        }),
      }
    )
  );
}

export async function updateStaffTicketStatus(
  ticketId: number,
  status: StaffTicketStatus
): Promise<{
  id: number;
  status: StaffTicketStatus;
  ownerId: number | null;
}> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/staff/tickets/${ticketId}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      }
    )
  );
}

export async function fetchInternalNotes(
  ticketId: number
): Promise<InternalNotesResponse> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/tickets/${ticketId}/internal-notes`,
      {
        credentials: "include",
      }
    )
  );
}

export async function createInternalNote(
  ticketId: number,
  content: string
): Promise<InternalNote> {
  return readStaffOperationResponse(
    await fetch(
      `${API_URL}/api/tickets/${ticketId}/internal-notes`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
      }
    )
  );
}
