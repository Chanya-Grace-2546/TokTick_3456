# TokTickIT — Lab 4 REST API Specification

**Status:** Approved engineering contract — implementation and test evidence pending. New endpoints/filters are additive to existing Lab 3 routes; all endpoints require authentication.

## 1. Conventions
- JSON over HTTPS in deployment; reuse the existing Lab 3 opaque database-backed session cookie `toktickit_session` (not JWT); never trust client-supplied user or role IDs.
- IDs are positive PostgreSQL/Prisma `Int` values, matching Lab 3.
- Dates are ISO 8601 UTC (`2026-10-22T10:30:00.000Z`).
- Successful GET: 200; create: 201; update: 200; malformed/invalid input: 400/422; unauthenticated: 401; forbidden: 403; not found: 404; version conflict: 409; unexpected failure: 500 with safe generic message.
- Authorization first: do not disclose another Requester's Ticket existence. For inaccessible Ticket, respond 404 where appropriate.
- Error shape (Lab 3-compatible): `{ "error": "VALIDATION_ERROR", "fields": { "followUpNote": "Required when follow-up is enabled" } }`. No raw SQL, tokens or stack traces.
- Paginate collections; stable sort; whitelist filters and sort keys. Protect writes against CSRF as required by Lab 3 cookie auth.
- New Action update requests require `version` (positive integer); extending existing Ticket status updates to require version needs coordinated client migration; use atomic conditional updates; 409 on stale version. Server records actor from session.

## 2. Action resource
```json
{
  "id": 31,
  "ticketId": 105,
  "actionAt": "2026-10-22T10:30:00.000Z",
  "description": "Restarted access point",
  "result": "Connectivity restored",
  "performedBy": { "id": 7, "name": "Staff A" },
  "assignedTo": { "id": 8, "name": "Staff B" },
  "followUpRequired": true,
  "followUpNote": "Check again tomorrow",
  "attachmentNotes": "See router photo in Ticket attachments",
  "state": "IN_PROGRESS",
  "version": 2,
  "createdAt": "2026-10-22T10:30:00.000Z",
  "updatedAt": "2026-10-22T10:35:00.000Z"
}
```
**Visibility:** Requesters see every Action Taken field on owned Tickets; Internal Notes are a separate staff-private resource. Action `performedBy` is server populated. Attachment notes are descriptive text, not new upload support.

## 3. Endpoints
### GET `/api/tickets/:ticketId/actions?page=1&pageSize=20`
**Roles:** Requester on own Ticket; IT Staff/Admin on accessible Ticket.  
**Response 200:** `{ "items": [ActionTaken], "page": 1, "pageSize": 20, "total": 3 }`.  
**Ordering:** `actionAt ASC, id ASC`. Page size defaults to 20, has a maximum of 50, and values above 50 return 400 `INVALID_QUERY`.
**Errors:** 401, 404, 400 (pagination), 500.

### POST `/api/tickets/:ticketId/actions`
**Roles:** IT Staff/Admin with access.  
**Request:**
```json
{
  "actionAt": "2026-10-22T10:30:00.000Z",
  "description": "Checked router",
  "result": null,
  "assignedToUserId": 8,
  "followUpRequired": true,
  "followUpNote": "Recheck tomorrow",
  "attachmentNotes": "Ticket photo 2",
  "state": "PLANNED"
}
```
**Response 201:** `{ "action": ActionTaken }`.  
**Validation:** nonblank description; `result` optional while PLANNED/IN_PROGRESS and required when entering COMPLETED (max 2000 characters); valid timestamp; valid enum; optional active staff/admin assignee; followUpNote nonblank if followUpRequired. No client-provided performedBy or Ticket Owner override.  
**Errors:** 401, 403/404, 422, 409 (idempotency collision), 500.  
**Retry:** Optional `Idempotency-Key` header unique per user + Ticket + request payload, retained for a defined server-side window (proposed 24h). Repeat same key/body returns original outcome, different body returns 409.

### PATCH `/api/tickets/:ticketId/actions/:actionId`
**Roles:** IT Staff/Admin with access.  
**Request:** partial editable fields plus mandatory `version`:
```json
{ "version": 2, "result": "Tested successfully", "state": "COMPLETED", "followUpRequired": false, "followUpNote": null }
```
**Response 200:** `{ "action": ActionTaken }` with incremented version.  
**Rules:** Action belongs to path Ticket; no edits to `id`, `ticketId`, `performedByUserId`, `createdAt`; allowed Action state transitions only; Completed/Cancelled Actions are immutable and reject PATCH; record append-only state audit event. Only active staff/admin assignees are accepted. `followUpRequired` must be explicitly set false after follow-up is addressed, and the note/outcome retained in audit.  
**Errors:** 401, 403/404, 422, 409 stale version, 500.

### GET `/api/dashboard/requester`
**Roles:** Requester only. No `userId` parameter.  
**Response 200:**
```json
{
  "asOf": "2026-10-22T12:00:00.000Z",
  "recentWindowDays": 7,
  "metrics": {
    "openTickets": 3,
    "waitingForRequester": 1
  },
  "recentlyUpdated": [{ "id": 105, "ticketNumber": "TKT-2026-000001", "summary": "Wi-Fi not working", "status": "IN_PROGRESS", "updatedAt": "2026-10-22T10:30:00.000Z", "href": "/tickets/105" }],
  "recentlyResolved": [],
  "drillDown": { "openTickets": "/tickets?statusGroup=open", "waitingForRequester": "/tickets?status=WAITING_FOR_REQUESTER" }
}
```
**Rules:** Scope all counts and arrays to authenticated requester; open-work status set from specification; max 5 recent items; recent = rolling 7 days; zero values and empty arrays if none. Hrefs use the documented existing Ticket Detail routes.  
**Errors:** 401, 403, 500.

### GET `/api/dashboard/staff`
**Roles:** IT Staff/Admin.  
**Response 200:**
```json
{
  "asOf": "2026-10-22T12:00:00.000Z",
  "metrics": { "unassignedTickets": 4, "myOwnedTickets": 6, "ticketsWithMyActions": 2, "urgentOpenTickets": 2 },
  "byStatus": { "NEW": 1, "OPEN": 2, "IN_PROGRESS": 3, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 0, "CLOSED": 0, "REOPENED": 0, "CANCELLED": 0 },
  "byPriority": [{ "priority": "HIGH", "count": 2 }],
  "recentTickets": [{ "id": 105, "ticketNumber": "TKT-2026-000001", "summary": "Wi-Fi not working", "status": "IN_PROGRESS", "updatedAt": "2026-10-22T10:30:00.000Z", "href": "/staff/tickets/105" }],
  "drillDown": { "unassignedTickets": "/staff/tickets?owner=unassigned&statusGroup=open", "myOwnedTickets": "/staff/tickets?owner=me&statusGroup=open", "ticketsWithMyActions": "/staff/tickets?myAction=true", "urgentOpenTickets": "/staff/tickets?itPriority=HIGH&statusGroup=open" }
}
```
**Rules:** Staff sees authorized operational scope; Admin may reuse same view; status/priority zeros included for known enums; priority values must match actual Lab 3 schema. `ticketsWithMyActions` counts DISTINCT accessible Tickets containing at least one nonterminal Action assigned to the current staff member, not Action rows; `myAction=true` returns the same distinct Tickets. `urgentOpenTickets` counts HIGH IT-priority Tickets in the open-status group, matching the urgent drill-down.  
**Errors:** 401, 403, 500.

### PATCH `/api/staff/tickets/:id/status` (existing Lab 3 route, extended)
**Roles:** Per status matrix in specification.  
**Request (existing Lab 3-compatible shape):** `{ "status": "RESOLVED", "expectedStatus": "IN_PROGRESS" }`. The existing Lab 3 endpoint accepts `{ "status": "WAITING_FOR_REQUESTER" }`; `expectedStatus` is optional and additive; do not send `reason` on this endpoint; do not require `version` from legacy callers. If an optional version is later added, its absence must remain valid.  
**Response 200:** `{ "id": 105, "status": "RESOLVED", "ownerId": null }`.
**Rules:** transactional transition validation, role authorization, Action completion and follow-up gate; atomic cancellation of unfinished Actions when transitioning to CANCELLED; transactional revalidation of current Ticket status (without mandatory legacy version field); log actor/old/new status in append-only history; if optional `expectedStatus` differs from current status return 409 `STALE_UPDATE`. Requester apparent-resolution action is handled by existing Lab 3 API, and MUST NOT directly call this status update to resolve.  
**Errors:** 401, 403, 404, 409, 422, 500.

## 4. Dashboard Query and Drill-Down Contract
- Counts are computed using database count/groupBy queries and existing authorized filters; do not fetch all Tickets to count in browser.
- Open statuses: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`. Nonterminal means same set.
- Requester filter uses authenticated Requester identity, not request query.
- Time window uses UTC `asOf - 7 × 24 hours` inclusive through `asOf` inclusive; no ambiguity about calendar-day boundaries.
- Recent sort: `updatedAt DESC, id DESC`; max 5 per recent list. Actions: `actionAt ASC, id ASC`.
- Add `statusGroup=open` to both existing list validators and `myAction=true` to the staff queue validator. Preserve `owner=unassigned` and `owner=me`. These filters must yield the exact same Ticket set as dashboard counts; keep existing `400 INVALID_QUERY` for unknown params.
- Dashboard metric snapshot and clicked list may differ if data changes; no guarantee of transactional cross-request snapshot.

## 5. Authorization Matrix
| Endpoint | Requester | Staff | Admin |
|---|---|---|---|
| GET Ticket Actions | Own only | Accessible | Accessible |
| POST/PATCH Ticket Actions | Deny | Accessible | Accessible |
| GET requester dashboard | Own only | Deny | Deny |
| GET staff dashboard | Deny | Allow | Allow |
| PATCH Ticket status | Matrix only | Matrix | Matrix |

## 6. Security, Conflict and Failure Handling
- Validate path IDs, pagination and payload server-side; reject extra protected fields (`performedByUserId`, `createdAt`, `ticketId` in PATCH).
- No mass assignment; use explicit DTO allowlists and parameterized Prisma queries.
- Inactive assignee → 422 `INACTIVE_ASSIGNEE`; missing required follow-up or completion result → 422 `VALIDATION_ERROR`; invalid transition → 409 `INVALID_STATUS_TRANSITION` for existing Ticket status route (Lab 3 convention); Action validation may use 422; incomplete action or outstanding follow-up gate → 422 `RESOLUTION_BLOCKED`; stale version → 409 `STALE_UPDATE`.
- Server catches unexpected exceptions, logs safely and returns generic 500. Client retains entered form state after recoverable errors.
- For stale writes, return `{ "error": "STALE_UPDATE" }` but no unauthorized record data.
- Use transaction for Ticket status validation+update and Action state audit event.

## 7. Additional compatibility and persistence rules
- Action history, Ticket status history and Action idempotency keys are durable Prisma tables described in `specification.md` §8.2. All write + audit changes are transactional.
- Existing `{status}` PATCH continues to work; `expectedStatus` is an optional precondition only. Do not require `version` or `reason` for legacy Ticket clients.
- Action result is nullable until completion. Requesters see all Action Taken fields on owned Tickets, not Internal Notes.
- Dashboard responses use `summary`, `ticketNumber`, and uppercase Prisma enum wire values, not UI display labels.
- New filter `statusGroup=open` is accepted on `/tickets` and `/staff/tickets`; `myAction=true` is accepted only on staff queue. Unknown filters still receive 400 `INVALID_QUERY`.

## 8. Legacy API Compatibility and Health
Existing Lab 2/3 `/api/auth/*`, Ticket, Attachment, Public Comment, Internal Note, IT Queue and Administrator user-management routes must remain backward compatible. Reuse existing health route if present; do not introduce conflicting endpoints. Verify 401/403 behavior and cross-requester object-level authorization in regression tests.

## 9. API Acceptance/Test Mapping
| Endpoint/behavior | Acceptance criteria | Planned tests |
|---|---|---|
| Action GET/POST | AC-01, AC-02, AC-05 | API-01, API-02, AUTH-01 |
| Action PATCH, validation, states | AC-03, AC-04, AC-06, AC-07 | API-03, API-04, API-05 |
| Status PATCH | AC-08, AC-09, AC-10, AC-11 | API-06, API-07, CON-01 |
| Requester dashboard | AC-13 | API-08, AUTH-02 |
| Staff dashboard | AC-12 | API-09 |
| Migration and legacy APIs | AC-14, AC-15 | MIG-01, REG-01 |
| Retry/failure | AC-17, AC-18 | API-10, UI-07 |

## 10. Implementation Alignment Checklist
- [ ] Confirm actual Ticket/User Prisma ID types, names and status/priority enums.
- [ ] Confirm existing auth middleware and API envelope conventions.
- [ ] Confirm frontend route names for Ticket Queue and My Tickets.
- [ ] Confirm Action state, assignee, version, history and resolution gate with team.
- [ ] Confirm time window and dashboard metric set with specification agent.


### Issue 5 — follow-up satisfaction and Action write restrictions

POST `/api/tickets/:ticketId/actions/:actionId/follow-up-resolution` requires authenticated active IT Staff/Administrator, completed password setup and the existing write Origin check. Body: `{ "version": 3, "outcome": "Verified service restored" }`. Only these fields are accepted; version is a positive integer and outcome is a nonblank string. No additional character/word minimum or maximum is introduced. The Action must be COMPLETED with required follow-up.

First success: 201 `{ "followUpResolution": { "outcome": "Verified service restored", "actor": { "id": 9, "name": "Staff" }, "occurredAt": "ISO timestamp" } }`; identical repeat: 200 with the same object. An exclusive Ticket lock prevents duplicate events. The Action row is unchanged. Errors use existing `{ "error": "CODE", "fields"?: {...} }`: 401 authentication, 403 permission/Origin/password setup, 404 NOT_FOUND, 422 VALIDATION_ERROR (invalid body or unsuitable Action), 409 STALE_UPDATE, 409 FOLLOW_UP_ALREADY_SATISFIED (different outcome), 409 TICKET_ACTIONS_READ_ONLY.

Action resources add nullable `followUpResolution` with the shape above. Existing saved creation responses may predate this additive field. Only authorized Ticket readers receive it. No additional GET endpoint is introduced.

New Action POST, PATCH and follow-up satisfaction return 409 TICKET_ACTIONS_READ_ONLY on RESOLVED, CLOSED or CANCELLED Tickets. Existing creation idempotency lookup/replay and expiry rules run before this restriction; no new write is performed by replay. Follow-up satisfaction itself is rejected on a restricted Ticket, including repeats; reopen first if permitted.

The existing Ticket status PATCH accepts `{ "status": "RESOLVED", "expectedStatus": "IN_PROGRESS" }` or the legacy `{ "status": "RESOLVED" }`. `expectedStatus` uses the existing Ticket enum; invalid values return 400 VALIDATION_FAILED and mismatch returns 409 STALE_UPDATE. The flat success response remains exactly `{id,status,ownerId}`. Resolution failure returns 422 RESOLUTION_BLOCKED. Existing transition/authorization errors and the Lab 3 transition matrix are unchanged.

### Issue 6 — approved dashboard implementation alignment

GET /api/dashboard/staff retains the response documented in §3. Status buckets contain all eight known enums; byPriority includes LOW/MEDIUM/HIGH even when zero. Breakdowns cover all accessible Tickets without open-status/date restrictions. Recent Tickets alone uses the inclusive seven-day UTC window and updatedAt DESC, id DESC; no extra response fields or dashboard filters are introduced. Calculations use one read-consistent database snapshot.

Existing GET /api/staff/tickets additionally accepts statusGroup=open and myAction=true. Other values, repeated/structured values and unknown filters retain 400 INVALID_QUERY with safe field errors. Valid filters combine with AND semantics; an incompatible status/open-group combination returns zero matches. Existing sort choices, id ASC tie-break and the {items,page,pageSize,totalItems,totalPages} envelope remain unchanged. The requester-side additions documented elsewhere are reserved for Issue 7.

### Issue 7 — approved Requester Dashboard and list alignment

GET /api/dashboard/requester returns exactly the requester response in §3, including recentWindowDays:7. It requires an active authenticated Requester who has completed password setup. Staff/Admin receive 403; missing/expired/inactive sessions receive existing 401 responses. Counts and both bounded recent queries use the authenticated requesterId in one read-consistent transaction. No client query supplies identity or filtering; supplied userId/requesterId values are not used to select data. Errors and logs contain no SQL, credentials or foreign Ticket data.

GET /api/tickets adds status and statusGroup=open while preserving currentStatus. Matching status/currentStatus aliases are accepted; conflicting values return 400 INVALID_QUERY with safe fields. Valid filters combine with AND, so status=RESOLVED&statusGroup=open returns no matches. Repeated/structured filters, invalid enums and unsupported parameters return 400 INVALID_QUERY. The sole compatibility exception is requesterId, which remains ignored and never affects ownership. Legacy sort/page defaults and fallbacks, valid page sizes capped at 50, and {items,page,pageSize,totalItems,totalPages,noResults} are unchanged. My Tickets items still expose currentStatus; dashboard items use status, summary and ticketNumber as documented. Recent lists alone use updatedAt DESC, id DESC.
