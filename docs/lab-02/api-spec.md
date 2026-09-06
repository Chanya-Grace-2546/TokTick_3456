# Lab 2 API Contract — TokTickIT

All endpoints scope Requester-owned data to the `requesterId` sent by the
client (selected via the Development Requester Selection screen — a Lab 2
testing convention, not real auth). All responses are JSON.

## 1. `GET /api/requesters`
Active Development Requesters, for the selector.
- **200**: `[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer@example.com" }, ...]`
- **500**: `{ "error": "REQUESTERS_UNAVAILABLE" }`

## 2. `GET /api/categories`
Active Categories.
- **200**: `[{ "id": 1, "name": "Hardware" }, ...]`

## 3. `GET /api/related-systems`
Active Related Systems.
- **200**: `[{ "id": 1, "name": "Corporate Laptop" }, ...]`

## 4. `POST /api/tickets`
Create a Ticket for the selected Requester.
- **Request body**:
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains fast even when idle, started after last update.",
  "requestedPriority": "MEDIUM"
}
```
- **201**:
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000101",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains fast even when idle, started after last update.",
  "requestedPriority": "MEDIUM",
  "itPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-05-12T09:14:00Z"
}
```
- **400**: `{ "error": "VALIDATION_FAILED", "fields": { "summary": "Summary is required" } }`
- **404**: `{ "error": "REQUESTER_NOT_FOUND" }` (inactive/unknown requesterId)
- **500**: `{ "error": "UNEXPECTED_ERROR" }`

## 5. `GET /api/tickets`
Paginated, searchable, filterable, sortable list scoped to `requesterId`.

**Query parameters**
| Param | Type | Notes |
|---|---|---|
| `requesterId` | number | required |
| `search` | string | matches ticket number or summary |
| `category` | number | optional filter |
| `requestedPriority` | string | optional filter |
| `itPriority` | string | optional filter |
| `currentStatus` | string | optional filter |
| `sortBy` | `ticketNumber` \| `createdAt` \| `updatedAt` | default `createdAt` |
| `sortDir` | `asc` \| `desc` | default `desc` |
| `page` | number | default 1; invalid → 1 |
| `pageSize` | number | default 10, max 50; invalid → 10 |

Example: `GET /api/tickets?requesterId=1&search=laptop&page=1&pageSize=10`

- **200**:
```json
{
  "items": [ { "id": 101, "ticketNumber": "TKT-2026-000101", "summary": "...", "category": "Hardware", "requestedPriority": "MEDIUM", "itPriority": "MEDIUM", "currentStatus": "NEW", "updatedAt": "..." } ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1,
  "noResults": false
}
```
- **400**: `{ "error": "REQUESTER_ID_REQUIRED" }`

## 6. `GET /api/tickets/:id`
One owned Ticket.
- **Query**: `requesterId` (required, for ownership check)
- **200**: full Ticket object (see §4) plus `attachments: [...]` metadata
- **404**: `{ "error": "TICKET_NOT_FOUND" }` (not owned, or doesn't exist — same response either way, per BR-07)

## 7. `POST /api/tickets/:id/attachments`
Upload an Attachment (multipart/form-data).
- **Form fields**: `file` (binary), `requesterId`
- **201**: `{ "id": 55, "fileName": "screenshot.png", "sizeBytes": 204800, "mimeType": "image/png", "isRemoved": false, "createdAt": "..." }`
- **400**: `{ "error": "INVALID_FILE_TYPE" }` / `{ "error": "FILE_TOO_LARGE" }` / `{ "error": "MAX_ATTACHMENTS_REACHED" }`
- **404**: `{ "error": "TICKET_NOT_FOUND" }` (not owned)

## 8. `GET /api/tickets/:id/attachments`
Attachment metadata for a Ticket (active and removed).
- **Query**: `requesterId` (required)
- **200**: `[{ "id": 55, "fileName": "screenshot.png", "sizeBytes": 204800, "isRemoved": false, "removedAt": null, "removedReason": null, "createdAt": "..." }]`
- **404**: `{ "error": "TICKET_NOT_FOUND" }`

## 9. `GET /api/attachments/:id/download`
Download an active Attachment.
- **Query**: `requesterId` (required, for ownership check)
- **200**: binary file stream with correct `Content-Type`/`Content-Disposition`
- **404**: `{ "error": "ATTACHMENT_NOT_FOUND" }` (not owned, or doesn't exist)
- **410**: `{ "error": "ATTACHMENT_REMOVED" }` (exists but soft-removed)

## 10. `PATCH /api/attachments/:id/remove`
Soft-remove an Attachment.
- **Request body**: `{ "requesterId": 1, "reason": "Uploaded wrong file" }`
- **200**: `{ "id": 55, "isRemoved": true, "removedAt": "...", "removedReason": "Uploaded wrong file" }`
- **400**: `{ "error": "REASON_REQUIRED" }`
- **404**: `{ "error": "ATTACHMENT_NOT_FOUND" }`
- **409**: `{ "error": "ALREADY_REMOVED" }`

## 11. Expected HTTP Statuses
| Status | Use |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Resource created (Ticket, Attachment) |
| 400 | Invalid input / validation failure / unsupported file type / oversized upload |
| 404 | Missing resource or ownership failure (never distinguished from "doesn't exist") |
| 409 | Conflict (e.g. removing an already-removed attachment) |
| 410 | Resource existed but is no longer available (removed attachment download) |
| 500 | Unexpected server error (safe, generic message only) |

## 12. Notes on Ownership Enforcement
Every endpoint that reads or mutates Ticket/Attachment data requires
`requesterId` and re-checks ownership server-side (BR-07) — the frontend
sending the "right" `requesterId` is never trusted as the sole
authorization mechanism, even though there is no real auth yet, so the
ownership-check code path carries over cleanly when Lab 3 replaces
`requesterId` with an authenticated user id.
