# Lab 3 REST API Contract — TokTickIT

Base path: `/api`. JSON unless an Attachment endpoint is multipart/binary. All protected requests use the server-issued authentication cookie and `credentials: "include"` on the client.

## 1. Authentication Mechanism

### Session design
- Login creates a cryptographically random opaque token (minimum 32 random bytes).
- Client receives the raw token only as cookie `toktickit_session`; JavaScript cannot read it (`HttpOnly`).
- Database stores only SHA-256 `tokenHash`, never the raw token.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, `Max-Age` aligned to an 8-hour server-side expiry.
- Logout invalidates the current Session row and clears the cookie.
- Password reset by Administrator and account deactivation invalidate all sessions for the target User.
- CORS allows only the configured client origin with credentials. State-changing authenticated requests must pass same-origin `Origin` validation.
- No authentication secret, password hash, or session token is returned in JSON.

### Common auth errors
- `401 { "error": "UNAUTHENTICATED" }` — no valid session.
- `403 { "error": "PASSWORD_CHANGE_REQUIRED" }` — authenticated but normal operation blocked until mandatory password change.
- `403 { "error": "FORBIDDEN" }` — authenticated role is not permitted.

## 2. Authentication Endpoints

### `POST /api/auth/login`
Public.

Request:
```json
{ "email": "requester1@example.test", "password": "LocalOnly!123" }
```

Success `200`:
```json
{
  "user": { "id": 1, "name": "Requester One", "email": "requester1@example.test", "role": "REQUESTER" },
  "mustChangePassword": true
}
```

Failure `401` for wrong password, unknown email, or inactive account:
```json
{ "error": "INVALID_CREDENTIALS", "message": "Email or password is incorrect, or the account is unavailable." }
```
Validation `400`: `VALIDATION_FAILED` with field messages. No session is created on failure.

### `POST /api/auth/logout`
Authenticated, including password-change-required sessions. Invalidates current session and clears cookie.
Success `204`.

### `GET /api/auth/me`
Authenticated, including password-change-required sessions.
Success `200`:
```json
{
  "id": 1,
  "name": "Requester One",
  "email": "requester1@example.test",
  "role": "REQUESTER",
  "mustChangePassword": false
}
```

### `POST /api/auth/change-password`
Authenticated; intended for mandatory first-login/reissued-password flow.

Request:
```json
{ "newPassword": "NewStrong!456", "confirmPassword": "NewStrong!456" }
```

Success `200` returns safe current User with `mustChangePassword: false`.
Validation `400` for mismatch/password-rule failure. `401` invalid session.

## 3. Reference Data
Existing endpoints remain authenticated for normal app use:
- `GET /api/categories` — active Categories.
- `GET /api/related-systems` — active Related Systems.

Requester, IT Staff, and Administrator may read these where needed by their permitted screens.

## 4. Authenticated Requester Ticket APIs

### `POST /api/tickets`
Role: Requester only.

Lab 2 request fields continue **except `requesterId` is removed**:
```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot connect to campus Wi-Fi",
  "description": "Connection fails after entering my credentials.",
  "requestedPriority": "MEDIUM"
}
```
Backend sets `requesterId = req.user.id`, `itPriority = requestedPriority`, and initial status `NEW`.
Success `201`. Validation `400`. Forbidden role `403`.

### `GET /api/tickets`
Role: Requester only. Authenticated User ID replaces Lab 2 `requesterId` query parameter.

Query retains Lab 2 Requester list behavior: `search`, `category`, `requestedPriority`, `itPriority`, `currentStatus`, `sortBy`, `sortDir`, `page`, `pageSize`.
Results are always scoped to authenticated Requester.

### `GET /api/tickets/:id`
Role: Requester only for this route behavior. Returns owned Ticket Detail, Public Comments summary metadata as specified by UI needs, and Attachments. Missing/not-owned both return `404 {"error":"NOT_FOUND"}`.

### Existing Attachment endpoints
Requester ownership is derived from authenticated User through the Ticket; no `requesterId` is accepted:
- `POST /api/tickets/:id/attachments`
- `GET /api/tickets/:id/attachments`
- `GET /api/attachments/:id/download`
- `PATCH /api/attachments/:id/remove`

Lab 2 type/size/count/soft-removal behavior remains unchanged. Not-owned/missing protected resources use safe `404`.

## 5. IT Staff Queue and Operational Ticket Detail

### `GET /api/staff/tickets`
Role: IT Staff; Administrator also permitted by approved matrix.

Query:
- `search` — Ticket Number, Summary, Requester name/email.
- `category` — Category ID.
- `requestedPriority` — `LOW|MEDIUM|HIGH`.
- `itPriority` — `LOW|MEDIUM|HIGH`.
- `status` — one TicketStatus.
- `owner` — `unassigned`, `me`, or numeric active staff/admin User ID.
- `sortBy` — `ticketNumber|createdAt|updatedAt|requestedPriority|itPriority|status`.
- `sortDir` — `asc|desc`.
- `page` — positive integer.
- `pageSize` — `10|20|50`.

Defaults: `sortBy=updatedAt`, `sortDir=desc`, `page=1`, `pageSize=10`.
Invalid query -> `400 {"error":"INVALID_QUERY","fields":{...}}`.

Success `200`:
```json
{
  "items": [
    {
      "id": 15,
      "ticketNumber": "TKT-2026-000015",
      "createdAt": "...",
      "updatedAt": "...",
      "summary": "Wi-Fi disconnects",
      "category": { "id": 1, "name": "Network" },
      "requester": { "id": 4, "name": "A Requester", "email": "a@example.test" },
      "requestedPriority": "MEDIUM",
      "itPriority": "HIGH",
      "status": "IN_PROGRESS",
      "owner": { "id": 8, "name": "IT Staff One" }
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 24,
  "totalPages": 3
}
```

### `GET /api/staff/tickets/:id`
Role: IT Staff or Administrator.
Returns full operational detail: Requester, category/system, requested/IT priority, status, owner, apparent-resolution indication, timestamps, Attachments, Public Comments, and Internal Notes.
Missing -> `404 NOT_FOUND`.

### `GET /api/staff/owners`
Role: IT Staff or Administrator.
Returns active Users eligible as Ticket Owner (`IT_STAFF` or `ADMINISTRATOR`), safe fields only: `id`, `name`, `email`, `role`.

## 6. Ticket Ownership

### `POST /api/staff/tickets/:id/claim`
Role: IT Staff or Administrator.
No body. Assigns current User only if unassigned.
Success `200` updated owner summary. Already assigned -> `409 TICKET_ALREADY_ASSIGNED`.

### `PATCH /api/staff/tickets/:id/owner`
Role: IT Staff or Administrator.
Request:
```json
{ "ownerId": 8 }
```
`ownerId: null` is allowed to explicitly unassign. Non-null owner must be active IT Staff/Administrator.
Success `200`. Invalid owner `400 INVALID_OWNER`; missing Ticket `404`.

## 7. IT Priority and Status

### `PATCH /api/staff/tickets/:id/it-priority`
Role: IT Staff or Administrator.
Request: `{ "itPriority": "HIGH" }`.
Success `200`; invalid value `400 VALIDATION_FAILED`.

### `PATCH /api/staff/tickets/:id/status`
Role: IT Staff or Administrator.
Request: `{ "status": "WAITING_FOR_REQUESTER" }`.
Backend validates current->target transition from specification BR-30.
Success `200`; invalid transition `409 INVALID_STATUS_TRANSITION`; invalid enum `400`.

## 8. Public Comments

### `GET /api/tickets/:id/comments`
Roles:
- Requester: owned Ticket only; not-owned/missing -> safe `404`.
- IT Staff/Administrator: any existing Ticket.

Success `200`:
```json
{
  "items": [
    {
      "id": 1,
      "content": "Could you try again now?",
      "author": { "id": 8, "name": "IT Staff One", "role": "IT_STAFF" },
      "createdAt": "..."
    }
  ]
}
```

### `POST /api/tickets/:id/comments`
Same authorization as GET.
Request: `{ "content": "It works now, thank you." }`.
Trimmed 1–2000 chars. Backend sets author/time. Success `201`.
Requester post clears any existing `requesterResolvedAt` indication (BR-35).

## 9. Requester Apparent Resolution

### `POST /api/tickets/:id/problem-appears-resolved`
Role: Requester, owned Ticket only.
No body. Stores Requester indication/time without changing formal status. Idempotent.
Success `200`:
```json
{ "requesterResolvedAt": "...", "status": "WAITING_FOR_REQUESTER" }
```
The returned status is whatever formal status already exists; this endpoint does not set it.

## 10. Internal Notes

### `GET /api/tickets/:id/internal-notes`
Role: IT Staff or Administrator only.
Success `200` with append-only entries and author/time. Requester -> `403 FORBIDDEN` with no note data.

### `POST /api/tickets/:id/internal-notes`
Role: IT Staff or Administrator only.
Request: `{ "content": "Suspect AP roaming issue; monitor after controller change." }`.
Trimmed 1–2000 chars. Success `201`. Requester -> `403`.

## 11. Administrator User Management

### `GET /api/admin/users`
Role: Administrator only.
Query: optional `search` (name/email), optional `role` (one role).
No mandatory pagination in Lab 3.
Success `200` safe fields only:
```json
{
  "items": [
    { "id": 1, "name": "User One", "email": "user1@example.test", "role": "REQUESTER", "isActive": true, "mustChangePassword": false }
  ]
}
```

### `POST /api/admin/users`
Role: Administrator.
Request:
```json
{
  "name": "New User",
  "email": "new.user@example.test",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "LocalOnly!123"
}
```
Name: trimmed 2–100 chars. Email: normalized valid email, max 254. Role: one permitted enum. Password: BR-05.
Success `201` safe User; duplicate email `409 EMAIL_ALREADY_EXISTS`.

### `PATCH /api/admin/users/:id`
Role: Administrator.
Request may contain one or more of:
```json
{ "name": "Updated Name", "email": "updated@example.test", "role": "IT_STAFF", "isActive": false }
```
Success `200` safe User.
Conflicts: `SELF_DEACTIVATION_FORBIDDEN`, `LAST_ACTIVE_ADMIN_REQUIRED`, `EMAIL_ALREADY_EXISTS`, `USER_HAS_REQUESTER_TICKETS`.
Deactivation invalidates target sessions.

### `POST /api/admin/users/:id/initial-password`
Role: Administrator.
Request:
```json
{ "initialPassword": "Another!1234", "confirmPassword": "Another!1234" }
```
Success `204`. Stores hash, sets `mustChangePassword=true`, invalidates all target sessions. Never returns password/hash.

## 12. Safe Error Contract

Common shape:
```json
{ "error": "ERROR_CODE", "message": "Safe user-facing summary", "fields": { "field": "Field message" } }
```
`message`/`fields` are optional depending on error.

Status usage:
- `400` invalid input/query.
- `401` unauthenticated/invalid login.
- `403` authenticated but forbidden or password-change-required.
- `404` missing resource; also Requester ownership-safe not-found.
- `409` duplicate email, assignment conflict, invalid status transition, Administrator safety conflict.
- `500` `UNEXPECTED_ERROR` with no stack/database/auth-secret details.

## 13. Removed/Replaced Lab 2 API Behavior
- `GET /api/requesters` is removed from normal Lab 3 product behavior.
- `requesterId` is removed from Requester Ticket list/create/detail/attachment authorization inputs.
- Any stale client-supplied `requesterId` is ignored or rejected by validation; it can never override authenticated identity.
