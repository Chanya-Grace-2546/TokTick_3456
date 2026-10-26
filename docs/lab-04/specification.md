# TokTickIT — Lab 4 Sprint 4 Engineering Specification

**Status:** Approved engineering contract — implementation and test evidence pending  
**Scope:** Actions Taken, final Ticket workflow, role dashboards, and final regression  
**Source:** CPE 334 Lab 4 handout, pp. 1–11. This document makes explicit implementation decisions where the handout leaves choices open.

## 1. Sprint Goal
Complete the service-desk lifecycle by recording individual IT Staff Actions Taken on Tickets, enforcing consistent Ticket status and resolution rules, giving Requesters and IT Staff role-specific dashboards, and preserving and hardening all Labs 2–3 features.

## 2. Stakeholder Request
The service desk needs a verifiable record of work carried out on each Ticket, including the responsible actor, result, follow-up, and attachment notes. A Ticket has one primary Owner but other IT Staff may perform actions. Requesters can signal apparent resolution; IT Staff formally resolve the Ticket. Role-specific dashboards must summarize accurate operational data and link to existing detailed screens. The final UI remains Zen Green.

## 3. Scope
### Included
- Action Taken model, database migration, idempotent seed, APIs, authorization, UI and tests.
- Complete Ticket transition matrix, resolution gate, stale-update handling and audit-safe behavior.
- Requester, IT Staff, and Administrator-compatible dashboards with server-calculated metrics and drill-down.
- Regression, accessibility, responsive design, error states, security and final integration.
### Excluded
Automatic SLA/escalation, external notifications, inventory/purchasing, timesheets/payroll, approval workflows, BI/report builders, multi-tenancy, production cloud operations, and unapproved features.

## 4. Roles and Authorization
| Capability | Requester | IT Staff | Administrator |
|---|---|---|---|
| View Actions Taken | Own Tickets only | Accessible Tickets | Accessible Tickets |
| Create/update Action | No | Accessible Tickets | Accessible Tickets |
| View Requester dashboard | Own data | No | No |
| View Staff dashboard | No | Yes | Yes |
| Perform permitted Ticket transition | Limited, per matrix | Yes | Yes |
| Manage users (existing Lab 3) | No | No | Yes |

**Security invariant:** The server checks session identity, role, Ticket visibility, record ownership and allowed transitions on every request. Client visibility is never authorization. A Requester never receives another Requester's Ticket, Action, dashboard count or drill-down result.

## 5. Functional Requirements (FR-01–FR-40)

| ID | Requirement |
|---|---|
| FR-01 | Staff/Admin can list Actions Taken for an accessible Ticket, newest/oldest order documented. |
| FR-02 | Staff/Admin can create an Action Taken with action date/time, description, result, performer from authenticated identity, follow-up flag/note, attachment notes and optional assignee. |
| FR-03 | Staff/Admin can edit permitted Action fields without changing original performer or creation timestamp. |
| FR-04 | Requester can view read-only Actions Taken on owned Tickets. |
| FR-05 | Staff/Admin can assign, complete or cancel Action work as defined by the Action state model. |
| FR-06 | Server validates Action data and rejects inactive assignees, invalid Ticket IDs and unauthorized writes. |
| FR-07 | Ticket status changes follow the role-based transition matrix and resolution gate. |
| FR-08 | Requester's “Problem Appears Resolved” remains advisory and does not itself resolve a Ticket. |
| FR-09 | Staff dashboard shows approved current-user, unassigned, priority/status and recent Ticket information. |
| FR-10 | Requester dashboard shows only owned Ticket counts, attention-required and recent/resolved Tickets. |
| FR-11 | Dashboard counts are server-derived and drill down to matching filtered lists/details. |
| FR-12 | API detects stale updates and returns a safe conflict instead of silently overwriting. |
| FR-13 | Labs 2–3 login, user roles, Ticket CRUD, attachments, comments, notes, queues and user management continue to work. |
| FR-14 | All Lab 4 screens have loading, empty, success, validation, forbidden, not-found, conflict and safe-failure states. |
| FR-15 | Application preserves Zen Green, keyboard operation, accessible labels, visible focus and responsive layouts. |
| FR-16 | Staff/Admin can view one Action Taken in detail, including performer, assignment, timestamps, state and follow-up fields. |
| FR-17 | Action list pagination, filtering and stable ordering must follow the approved API contract. |
| FR-18 | Action creation and editing distinguish server-controlled fields from editable user fields. |
| FR-19 | Action assignment selects only active eligible IT Staff/Admin users. |
| FR-20 | Action state changes record actor and event history without erasing earlier audit entries. |
| FR-21 | Action cancellation and completion require approved transitions and provide clear confirmation feedback. |
| FR-22 | Ticket Detail refreshes Action list and Ticket summary after successful operations. |
| FR-23 | Requester Action views hide edit controls and staff-private content while showing approved Action information. |
| FR-24 | Ticket status controls show only allowed next states for the authenticated role and current status. |
| FR-25 | Backend rejects an invalid Ticket transition even if a client sends it directly. |
| FR-26 | Resolution attempts failing the approved gate return an actionable safe error and leave Ticket unchanged. |
| FR-27 | Ticket state changes refresh the status badge, history and related dashboard summaries. |
| FR-28 | Staff dashboard distinguishes current-user ownership from unassigned Ticket counts. |
| FR-29 | Staff dashboard provides status and priority breakdowns based on documented backend queries. |
| FR-30 | Requester dashboard separately identifies waiting-for-requester and recently resolved Tickets. |
| FR-31 | Dashboard date boundaries, recent-list limits and sort order follow the approved metric definitions. |
| FR-32 | Dashboard empty results display zero counts and an accessible empty message. |
| FR-33 | Dashboard actionable cards navigate to filtered lists whose results match the metric definition. |
| FR-34 | Administrator can access the approved Staff dashboard without losing existing administration navigation. |
| FR-35 | Legacy Tickets with no Actions Taken remain viewable and editable through approved workflows. |
| FR-36 | UI presents specific recoverable conflict feedback and allows users to reload before retrying. |
| FR-37 | All newly introduced forms preserve entered values after recoverable validation or network failures. |
| FR-38 | Final demonstration supports both populated and empty dashboard states and Tickets with zero, one and multiple Actions Taken. |
| FR-39 | All approved earlier role navigation, attachment, comment, internal-note and administrator workflows remain reachable. |
| FR-40 | Application provides documented health and safe API failure behavior consistent with prior labs. |

## 5A. Non-Functional Requirements (NFR-01–NFR-20)

**Approved team quality thresholds** (not numerical values mandated by the handout): 95th-percentile dashboard and Actions Taken API response <= 2 seconds with a reproducible fixture of 1,000 Tickets and 3,000 Actions; no more than 5 recent Tickets per dashboard list; viewport checks at 375/768/1440 px; WCAG 2.1 AA accessibility checks for new screens. Measure after warm-up over at least 30 requests and record machine/environment.

| ID | Quality | Testable requirement | Verification |
|---|---|---|---|
| NFR-01 | Security | Every protected Action, Ticket and dashboard endpoint verifies session, role and object ownership on the server; unauthorized access returns a safe denial without cross-user data. | AUTH-01, AUTH-02, API-02 |
| NFR-02 | Data integrity | Concurrent edits must not silently overwrite a newer Ticket or Action; stale writes return 409 with no modification. | CON-01 |
| NFR-03 | Reliability | Duplicate clicks or retries must not create duplicate Actions for the same idempotent request; recoverable errors preserve form input. | API-10, UI-07 |
| NFR-04 | Performance | Dashboard and Actions Taken endpoints use bounded queries; p95 response <= 2 seconds on the documented 1,000-Ticket/3,000-Action fixture, measured over at least 30 warmed requests per endpoint. | PERF-01 |
| NFR-05 | Accessibility | All Lab 4 controls are keyboard operable, visibly focused, semantically labeled, and status is not communicated by color alone; validate against the Lab 2–3 accessibility baseline. | UI-06, RESP-01 |
| NFR-06 | Responsive UI | Major screens work at 375px, 768px and 1440px viewport widths with no clipped controls, overlapping content or horizontal page scrolling. | RESP-01 |
| NFR-07 | Compatibility | Existing Lab 2–3 authentication, Ticket, attachment, comment, note, queue and administration behavior remains functional. | REG-01, REG-02, REG-03 |
| NFR-08 | Safe failures | Validation, forbidden, not-found, conflict and server errors provide usable feedback without exposing secrets, stack traces or internal SQL details. | API-03, API-10, UI-07 |
| NFR-09 | Migration safety | Schema migration preserves existing records and repeat seed runs do not create duplicates; a recovery procedure is documented and tested. | MIG-01 |
| NFR-10 | Visual consistency | New screens follow the established Zen Green patterns for navigation, typography, forms, badges and states. | UI-06 and manual visual checklist |
| NFR-11 | Auditability | Each Action state change and protected Ticket transition retains actor, timestamp and before/after context in a durable history; existing audit entries cannot be overwritten. | API-05, API-06 |
| NFR-12 | Determinism | Action lists and Ticket recent lists use a documented tie-break sort so equal timestamps do not reorder items between requests. | API-11 |
| NFR-13 | Date/time correctness | Store event times in UTC and use an explicitly documented display timezone and dashboard day boundary; verify a boundary fixture. | UNIT-04 |
| NFR-14 | Input validation | Reject malformed dates, invalid enums, over-limit text and blank required follow-up notes with field-specific safe feedback. | API-03, UI-03 |
| NFR-15 | Privacy | Requester-visible Action payloads exclude staff-private fields and records from other Requesters. | AUTH-01, API-02 |
| NFR-16 | Usability | All new create/edit flows show pending, success and recoverable failure feedback and prevent repeated submission. | UI-07 |
| NFR-17 | Observability | Server failures are diagnosable through safe server-side logging without returning stack traces or credentials to clients. | API-10 |
| NFR-18 | Maintainability | New API, UI and test code follows existing project conventions and has named requirement/AC coverage in tests.md. | REG-01, traceability review |
| NFR-19 | Recovery | Migration recovery steps are documented and tested on a disposable database backup; original records remain intact. | MIG-01 |
| NFR-20 | Performance consistency | Recent-ticket and Action lists are bounded/paginated and use indexes appropriate to owner, status and ordering; record query and latency evidence against the 1,000-Ticket fixture. | PERF-01, API-11 |

## 6. Business Rules
| ID | Rule |
|---|---|
| BR-01 | Each Action Taken belongs to exactly one Ticket. |
| BR-02 | Ticket Owner coordinates a Ticket; Action performer may be a different IT Staff member. |
| BR-03 | `performedByUserId` is assigned by the server from the authenticated session; never accepted from client input. |
| BR-04 | `followUpNote` is required and nonblank when `followUpRequired=true`; otherwise it may be null. |
| BR-05 | Action date/time must be valid ISO-8601 and persisted in UTC; display in user-local time. |
| BR-06 | Only active IT Staff/Admin may be assigned to an Action. |
| BR-07 | Action state is `Planned`, `In Progress`, `Completed`, or `Cancelled` (approved Sprint 4 decision); a terminal action cannot be reactivated without an explicitly approved rule. |
| BR-08 | Each Action retains immutable `id`, `ticketId`, `performedByUserId`, `createdAt`; edits update `updatedAt` and `version`. |
| BR-09 | Action records are not hard-deleted through the API. Action history/audit events are append-only. |
| BR-10 | A Ticket may have zero or many Actions Taken; existing Tickets with zero actions remain valid. |
| BR-11 | Requester apparent-resolution flag/comment does not change Ticket status. |
| BR-12 | A Ticket may transition to `Resolved` only through authorized Staff/Admin operation and only if every non-cancelled Action is `Completed` and no Action has an outstanding required follow-up (approved resolution gate). Zero Actions are allowed for legacy Tickets, provided an authorized staff member records the resolution outcome using the existing Ticket workflow. |
| BR-13 | `Cancelled` is terminal; `Closed` can transition to `Reopened` under the preserved Lab 3 matrix. |
| BR-14 | A stale `version` must yield HTTP 409 and must not modify the record. |
| BR-15 | Dashboard data is scoped on the server to the authenticated user/role, never a client-supplied user ID. |
| BR-16 | Dashboard empty counts are `0`; recent arrays are `[]`; no matching data is not an error. |
| BR-17 | Dashboard Recent Tickets ordering is descending `updatedAt`, then descending `id`. Compatibility exception: the existing Lab 3 Staff Queue keeps its selected sort and `id ASC` tie-break; Issue 6 does not change requester list ordering. Actions: ascending `actionAt`, then ascending `id`. |
| BR-18 | Duplicate submissions must be prevented by disabled pending controls and safe server retry handling; clients may send an idempotency key for Action creation. |
| BR-19 | Requesters can view all Action Taken fields on their own Tickets. Internal Notes remain a separate staff-private resource. |
| BR-20 | Legacy Tickets and related Users, Attachments, Public Comments and Internal Notes must survive migration unchanged. |
| BR-21 | Any authorized IT Staff/Admin with Ticket access may create an Action and assign it only to an active IT Staff/Admin; Action performer is always the authenticated creator, independently of assignee and Ticket Owner. |
| BR-22 | Once an Action reaches `Completed` or `Cancelled`, it is read-only and cannot be reactivated, edited or deleted. Its audit history remains accessible to authorized roles. |
| BR-23 | Cancelling a Ticket atomically changes each of its `Planned`/`In Progress` Actions to `Cancelled`, records the actor and timestamp for each change, and retains completed/cancelled Actions and audit history. |
| BR-24 | An Action with `followUpRequired=true` is outstanding until cleared while nonterminal or, after completion, satisfied by an append-only `FOLLOW_UP_SATISFIED` history event with a nonblank outcome; a Ticket cannot be Resolved while any non-cancelled Action has outstanding follow-up. |
| BR-25 | Dashboard recent period is a rolling 7 × 24-hour interval ending at server `asOf` (UTC), with local date/time displayed in Asia/Bangkok; count and recent-list definitions are independent. |
| BR-26 | New Actions use optimistic integer `version` checks on writes; existing Lab 3 Ticket status payloads remain accepted while the server provides compatible stale-update safeguards. |

## 7. Workflow Decisions
### 7.1 Ticket status-transition matrix (preserves Lab 3 transitions)
| From | Allowed To | Authorized actor / conditions |
|---|---|---|
| New | Open, In Progress, Cancelled | Staff/Admin; requester cancellation only if explicitly approved and implemented |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled | Staff/Admin; resolution gate for Resolved |
| In Progress | Waiting for Requester, Resolved, Cancelled | Staff/Admin; resolution gate for Resolved |
| Waiting for Requester | In Progress, Resolved, Cancelled | Staff/Admin; resolution gate for Resolved |
| Resolved | Closed, Reopened | Staff/Admin |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | Staff/Admin; resolution gate for Resolved |
| Closed | Reopened | Staff/Admin; preserve existing Lab 3 reopen behavior |
| Cancelled | — | Terminal |

This matrix preserves the transitions recorded in the supplied Lab 3 `statusTransitions.ts`; the exact role restrictions remain subject to the existing backend policy and must be verified before implementation. All unlisted transitions are rejected. No transition happens as a side effect of a Requester's apparent-resolution indication. The UI offers only transitions the API permits, but the API enforces them independently.

### 7.2 Action state transitions (approved)
`Planned → In Progress | Completed | Cancelled`; `In Progress → Completed | Cancelled`; `Completed` and `Cancelled` are terminal and immutable. Every transition records an append-only audit event. Authorized staff can create and assign Actions independently of Ticket ownership; assignment is limited to active IT Staff/Admin. Ticket cancellation atomically cancels only unfinished Actions, preserving completed/cancelled Actions and all history.

**Resolution check:** A permitted `→ Resolved` Ticket transition succeeds if every non-cancelled Action is Completed and no non-cancelled Action has outstanding required follow-up. Zero Actions satisfy this gate, preserving existing Lab 3 resolution behavior. For nonterminal Actions the flag may be cleared with appropriate documentation. Completed Actions remain immutable: Staff/Admin records a nonblank outcome through the follow-up satisfaction endpoint, appending a typed history event without changing the Action flag, version or timestamps. A follow-up note alone never satisfies the gate. This check runs on the backend in the same transaction as the Ticket transition. Legacy Tickets with zero Actions may transition to RESOLVED through an authorized, otherwise-valid Lab 3 transition; no new Action is required.

### 7.3 Concurrency
New Action records use integer `version` initialized to 1. Existing Ticket clients remain compatible: add Ticket versioning only with a coordinated API/client migration; `UPDATE ... WHERE id=? AND version=?` increments Action version atomically. A conditional update matching zero rows returns 409 Conflict; UI reloads and preserves recoverable input. Existing Ticket status requests without `version` must continue to work; the server serializes Ticket workflow changes in a database transaction and checks the current status and Action gate at write time. New Action PATCH requests require `version`. Status transition plus gate check must be performed transactionally.

## 8. Data Design, Migration and Seed
### 8.1 Additive Prisma model increment
```prisma
enum ActionState {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model ActionTaken {
  id                Int         @id @default(autoincrement())
  ticketId          Int
  performedByUserId Int
  assignedToUserId  Int?
  actionAt          DateTime    @default(now())
  description       String
  result            String?
  followUpRequired  Boolean     @default(false)
  followUpNote      String?
  attachmentNotes   String?
  state             ActionState @default(PLANNED)
  version           Int         @default(1)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  ticket            Ticket      @relation(fields: [ticketId], references: [id])
  performedBy       User        @relation("ActionPerformedBy", fields: [performedByUserId], references: [id])
  assignedTo        User?       @relation("ActionAssignedTo", fields: [assignedToUserId], references: [id])
  @@index([ticketId, actionAt, id])
  @@index([assignedToUserId, state])
}
```
**Required inverse Prisma relations:** Add `actionsTaken ActionTaken[]` to the existing `Ticket` model, and `actionsPerformed ActionTaken[] @relation("ActionPerformedBy")` plus `actionsAssigned ActionTaken[] @relation("ActionAssignedTo")` to the existing `User` model. These are concrete relations for the contract; verify the actual existing Prisma model names and ID types before migration. No Ticket `version` field is required. Keep existing status enum values.

### 8.2 Durable history and idempotency storage (additive Prisma concepts)

Add `ActionTakenHistory` (id, actionId, actorUserId, oldState, newState, beforeJson, afterJson, occurredAt), `TicketStatusHistory` (id, ticketId, actorUserId, oldStatus, newStatus, occurredAt), and `ActionIdempotencyKey` (id, actorUserId, ticketId, key, payloadHash, responseJson, responseStatus, createdAt, expiresAt). Use proper Prisma relations to existing `User`, `Ticket`, and `ActionTaken` and composite uniqueness `(actorUserId, ticketId, key)`. Persist history in the same transaction as each mutation; prohibit UPDATE/DELETE through application routes. Retain expired idempotency records until a scheduled cleanup; replays inside the 24-hour retention window return the saved response and mismatched bodies return 409. Migration adds tables without deleting legacy rows. Status history includes transitions from the new workflow onward; do not fabricate historic Lab 3 events.

### 8.3 Decisions and justifications
1. **Separate ActionTaken child table:** preserves a one-to-many history and avoids repeated action columns on Ticket; allows multiple staff contributors without changing Ticket ownership.
2. **Server-assigned performer and immutable creation fields:** protects auditability against impersonation or historical rewriting.
3. **Optimistic versions:** prevents lost updates without holding long database locks across UI editing.
4. **Indexes on Ticket/action time and assignee/state:** support detail history and current-user dashboard efficiently.

### 8.4 Migration and recovery
1. Back up database and record migration baseline.
2. Apply additive migration (new table, indexes, nullable relation/notes as required, no Ticket version column required).
3. Validate pre/post counts and existing foreign keys for Users, Tickets, Attachments, Comments and Notes.
4. Existing Tickets have zero Actions Taken; dashboard metrics count their existing statuses normally.
5. On failure, restore from tested backup or apply reviewed corrective migration; never destructively reset a shared database.
6. Run migration on a seeded copy and run Labs 2–3 regression before production-like integration.

### 8.5 Idempotent seed
Use stable unique fixture keys/upsert. Include active and inactive staff, requester-owned and unassigned Tickets, every major status/priority, zero/one/multiple Actions, different Action states, follow-up true/false, recent and older timestamps, and both zero and non-zero dashboard cases. Re-running seed must not duplicate records.

## 9. Dashboard Metrics and Calculation Rules
**All times stored UTC.** “Recent” means last 7×24 hours from server current time (rolling interval, not calendar week). For display, use Asia/Bangkok; API sends ISO timestamps. Define open-work statuses as `New`, `Open`, `In Progress`, `Waiting for Requester`, `Reopened`.

### 9.1 Requester dashboard (only `Ticket.requesterId = session.user.id` (existing Prisma field))
| Metric | Query definition | Drill-down |
|---|---|---|
| Open Tickets | Count owned Tickets in open-work statuses | `/tickets?statusGroup=open` |
| Waiting for Me | Count owned Tickets with `Waiting for Requester` | `/tickets?status=WAITING_FOR_REQUESTER` |
| Recently Updated | Up to 5 owned Tickets updated within rolling 7 days, newest first | Owned Ticket Detail |
| Recently Resolved | Up to 5 owned Tickets with `Resolved` status and recent `updatedAt` | Owned Ticket Detail |

### 9.2 IT Staff/Admin dashboard
| Metric | Query definition | Drill-down |
|---|---|---|
| Unassigned Tickets | Count nonterminal Tickets with no Ticket Owner | `/staff/tickets?owner=unassigned&statusGroup=open` |
| My Owned Tickets | Count nonterminal Tickets owned by session user | `/staff/tickets?owner=me&statusGroup=open` |
| Tickets with My Actions | Count distinct accessible Tickets having at least one nonterminal Action assigned to session user | `/staff/tickets?myAction=true` (new validated filter) |
| Urgent Open Tickets | Count accessible HIGH-priority Tickets in the five open-work statuses | `/staff/tickets?itPriority=HIGH&statusGroup=open` |
| Tickets by Status | Counts by all eight Ticket statuses (include zeros) | Staff Queue status filter |
| Tickets by IT Priority | Counts by existing priority values (include zeros) | Staff Queue priority filter |
| Recent Tickets | Up to 5 accessible Tickets by updatedAt/id | Ticket Detail |

The staff dashboard `myAction=true` drill-down returns distinct Tickets, not Action rows; its total must equal the Tickets with My Actions card. The urgent card uses the existing `itPriority=HIGH` filter and the additive `statusGroup=open` filter. Extend the existing Requester My Tickets and Staff Queue query validators with `statusGroup=open` (five open statuses), and Staff Queue with `myAction=true` (Tickets having an assigned nonterminal Action for current staff). These additive filters MUST produce the same set as their dashboard card counts, including ownership scope. Unknown parameters still return Lab 3 `400 INVALID_QUERY`. Use indexed/count/groupBy queries, not full Ticket collections. Admin may reuse staff dashboard. On no matches return counts 0 and lists []. Every drill-down filter must apply the same server-side scope as its metric.

## 10. API and UI Contract Summary
Detailed endpoints, request/response shapes, status codes, and conflicts are in [api-spec.md](api-spec.md). Detailed layouts, forms, role behavior, feedback and responsive rules are in [ui-spec.md](ui-spec.md). Tests and traceability are in [tests.md](tests.md).

## 11. Acceptance Criteria
| ID | Observable acceptance criterion |
|---|---|
| AC-01 | Staff creates Action on accessible Ticket; server saves correct Ticket and authenticated performer. |
| AC-02 | Different staff may perform Actions on a Ticket owned by another staff member. |
| AC-03 | Follow-up true with blank note returns validation error; valid note saves. |
| AC-04 | Inactive assignee, invalid Action state or invalid Ticket returns safe rejection. |
| AC-05 | Requester sees all Action Taken fields on own Ticket read-only, and cannot see another user's Ticket/Actions. |
| AC-06 | Staff edits permitted Action fields, while immutable actor/creation fields remain unchanged. |
| AC-07 | Action assign/complete/cancel transitions follow the state matrix and audit events append. |
| AC-08 | Requester apparent-resolution indication does not change Ticket status. |
| AC-09 | Permitted Ticket transitions succeed; forbidden transitions/roles fail server-side. |
| AC-10 | Ticket cannot be Resolved if any non-cancelled Action is Planned/In Progress or has required follow-up outstanding; it can be Resolved when all non-cancelled Actions are Completed with no outstanding follow-up, including when no Actions exist. |
| AC-11 | Stale Action version returns 409 and preserves newer server data; concurrent legacy Ticket updates are serialized and revalidated without requiring a new request field. |
| AC-12 | Staff dashboard counts match database; `statusGroup=open`, `owner=unassigned/me`, and `myAction=true` drill-downs return the same scoped Ticket set. |
| AC-13 | Requester dashboard returns only own counts/recent items; `statusGroup=open` and enum-valued status drill-downs match counts; zero-data returns 0/[]. |
| AC-14 | Migration preserves all legacy entities and seed is repeatable without duplication. |
| AC-15 | Existing Labs 2–3 auth, Ticket, attachment, comment, note, queue and admin flows pass regression. |
| AC-16 | Desktop/tablet/mobile layouts, keyboard focus and safe error/empty/loading states work. |
| AC-17 | Rapid double click/network retry cannot create unintended duplicate Actions. |
| AC-18 | Recoverable failures preserve entered form values; no secrets or stack traces leak. |
| AC-19 | Action list has deterministic `actionAt ASC, id ASC` ordering, stable pagination, and bounded page size. |
| AC-20 | Action detail shows state, performer, assignment, timestamps and follow-up fields; server-controlled fields are not editable. |
| AC-21 | An inactive user cannot be selected as assignee, and the API rejects assignment even when called directly. |
| AC-22 | Successful Action or Ticket updates refresh the visible list, status badge and affected dashboard data. |
| AC-23 | Staff and Requester dashboards use documented date boundaries and stable tie-break sorting, including boundary-time fixtures. |
| AC-24 | Empty dashboards return zero counts and empty lists, with working and accessible no-data states. |
| AC-25 | Administrator retains staff dashboard access and existing user-management navigation. |
| AC-26 | Dashboard and Actions Taken API endpoints each achieve p95 <= 2 seconds with 1,000 seeded Tickets and 3,000 Actions, at least 30 warmed requests per endpoint; dashboard recent lists remain bounded to 5. |
| AC-27 | Action and Ticket history records preserve original actor, timestamp and previous values; terminal Actions cannot be edited and subsequent operations append instead of overwriting. |
| AC-28 | New screens pass keyboard-only navigation, visible focus, semantic labels, non-color cues, and WCAG 2.1 AA automated/manual checks. |
| AC-29 | New screens at 375, 768 and 1440 px have no clipped controls, overlapping UI, or horizontal page overflow. |
| AC-30 | Health/error handling and server-side logging do not expose credentials, SQL or stack traces to clients. |
| AC-31 | Final demo fixtures include zero/one/multiple Actions and zero/nonzero dashboard states without damaging legacy records. |
| AC-32 | A migration recovery drill on a disposable database restores pre-migration records, and seed re-runs remain idempotent. |
| AC-33 | Staff other than Ticket Owner creates and assigns an Action to an active staff member; performer remains authenticated creator; inactive assignee is rejected. |
| AC-34 | A Completed or Cancelled Action rejects edits/reopening with safe feedback, while retaining its previous values and audit history. |
| AC-35 | Cancelling a Ticket atomically cancels unfinished Actions but leaves Completed/Cancelled Actions and history intact; rollback on a simulated failure leaves all records unchanged. |
| AC-36 | A completed Action with `followUpRequired=true` blocks Ticket resolution until Staff/Admin records a nonblank outcome through an append-only follow-up satisfaction history event, preserving the completed Action; requester advisory never resolves the Ticket. |
| AC-37 | Dashboard recent results include records exactly 7 days old, exclude older records, use UTC `asOf` boundaries, display Asia/Bangkok times and sort deterministically. |
| AC-38 | Existing Lab 3 Ticket status requests without a version field remain accepted; optional `expectedStatus` rejects stale requests with 409 `STALE_UPDATE`; simultaneous updates are serialized and revalidated, while stale Action PATCH requests return 409. |

### Additional acceptance checks for the approved contract
| ID | Observable acceptance criterion |
|---|---|
| AC-39 | A PLANNED or IN_PROGRESS Action may omit `result`; completing it without a nonblank `result` returns field validation error. |
| AC-40 | Dashboard API returns existing `summary`, `ticketNumber`, and enum wire values; cards and validated list filters return matching sets. |
| AC-41 | Existing `{status}` status PATCH remains valid; optional `expectedStatus` mismatch returns 409 `STALE_UPDATE` without changing Ticket. |
| AC-42 | An owned Ticket's Requester sees every Action Taken field, while Internal Notes remain private; unauthorized Ticket ID returns 404. |
| AC-43 | History and idempotency entries survive server restart; retrying same key/body returns saved response, different body returns 409. |
| AC-44 | Login landing redirects to role dashboard while existing `/tickets`, `/staff/tickets`, and `/admin/users` remain available. |
| AC-45 | A zero-Action Ticket may resolve through an otherwise-valid Lab 3 status transition; a Ticket with one completed Action and no outstanding follow-up may also resolve. |

## 12. Product Definition of Done
- [ ] Specification approved before main implementation PRs complete; decisions resolved with team.
- [ ] API/UI/test docs agree with this specification and current codebase.
- [ ] Additive Prisma migration, recovery steps and idempotent seed verified.
- [ ] All FR/NFR/BR/AC implemented; backend authorization and conflict checks verified.
- [ ] Unit, API/integration, UI, responsive, accessibility, migration, regression, smoke and E2E tests pass on final main.
- [ ] Screenshots captured for staff dashboard, requester dashboard and Actions Taken at desktop/tablet/mobile.
- [ ] Peer-reviewed feature PRs merged through `lab4-staging` into `main`; GitHub Issues Done.
- [ ] README, reviewer and AI-use evidence current; no placeholders, broken links or console errors.
- [ ] Final submission PDF contains Answer Part 1–9 with working evidence links.

## 13. Approved compatibility and implementation decisions

The eight design choices below are **approved by the project owner for Issue 1**; they are team-defined rather than numeric or workflow details dictated by the Lab 4 handout. Use existing Lab 3 session auth, error payloads, routes and role checks. New routes and filters in this contract are additive. Confirm Prisma relation names when writing migrations. Do not change existing Lab 3 Ticket transitions or remove existing APIs.

**Dashboard mockup interpretation:** Include Quick Actions for existing role-allowed tasks, including a staff Create Ticket link only if existing permissions permit creation; include urgent/high-priority information as a count/list using the existing `HIGH` priority enum. Exclude trend deltas ("from yesterday") because the handout mockups are illustrative and no daily historical snapshot is required. The Dashboard route becomes the default landing page for Requesters and IT Staff; Admin retains `/admin/users` as its existing default, with a link to `/staff/dashboard`.

**Staff Ticket access:** Staff/Admin can see all Tickets as in Lab 3. A Requester can access only Tickets with `requesterId=session.user.id`; inaccessible requester Ticket resources return 404. A role-ineligible dashboard returns 403.

## 14. Approved Sprint 4 Decision Record

| ID | Approved decision | Verification |
|---|---|---|
| D-01 | Actions: `PLANNED → IN_PROGRESS → COMPLETED` or `CANCELLED`; direct `PLANNED → COMPLETED/CANCELLED` permitted; terminal states immutable. | AC-07, AC-34 |
| D-02 | Any authorized IT Staff/Admin can create an Action and assign it to active IT Staff/Admin, even when someone else owns the Ticket. | AC-02, AC-21, AC-33 |
| D-03 | Completed/Cancelled Actions cannot be edited, reactivated, or hard-deleted; append-only audit retained. | AC-27, AC-34 |
| D-04 | Resolve only if all non-cancelled Actions are Completed and no required follow-up remains. | AC-10, AC-36 |
| D-05 | Ticket cancellation atomically cancels unfinished Actions, preserving existing records and audit. | AC-35 |
| D-06 | New Action updates use integer version checking; existing Lab 3 Ticket status API remains compatible, with transactional revalidation. | AC-11, AC-38 |
| D-07 | Recent dashboard period is rolling seven days, with UTC comparisons and Asia/Bangkok display. | AC-23, AC-37 |
| D-08 | Dashboard and Actions Taken APIs: p95 <= 2 seconds on documented local 1,000-Ticket/3,000-Action fixture, >=30 warmed requests per endpoint. | AC-26 |

**Preserved Lab 3 Ticket transition matrix:** `NEW → OPEN/IN_PROGRESS/CANCELLED`; `OPEN → IN_PROGRESS/WAITING_FOR_REQUESTER/RESOLVED/CANCELLED`; `IN_PROGRESS → WAITING_FOR_REQUESTER/RESOLVED/CANCELLED`; `WAITING_FOR_REQUESTER → IN_PROGRESS/RESOLVED/CANCELLED`; `RESOLVED → CLOSED/REOPENED`; `CLOSED → REOPENED`; `REOPENED → IN_PROGRESS/WAITING_FOR_REQUESTER/RESOLVED/CANCELLED`; `CANCELLED → none`. Only the new Lab 4 resolution gate and cancellation side effects extend these transitions.

### Issue 5 — transactional workflow clarification

The existing Lab 3 Ticket transition matrix is unchanged. RESOLVED and CLOSED can transition to REOPENED; CANCELLED has no outgoing transition. New Action creation, PATCH and follow-up satisfaction are prohibited on RESOLVED, CLOSED and CANCELLED Tickets (`409 TICKET_ACTIONS_READ_ONLY`). Saved, matching, unexpired creation responses can still be replayed without writing. Reopening permits new Action mutations; Completed/Cancelled Actions remain immutable.

Ticket status changes lock the Ticket row exclusively before revalidating status, resolution eligibility, cancellation and history in one transaction. Action creation/editing takes a shared Ticket lock; follow-up satisfaction takes an exclusive Ticket lock, serializing duplicate outcomes and resolution checks. Optional `expectedStatus` rejects stale status requests; legacy requests remain accepted. Cancellation changes only PLANNED/IN_PROGRESS Actions, increments each version and appends before/after history together with Ticket status history. Any failure rolls back all writes.

The existing history JSON supports distinct events without a schema change: beforeJson is the unchanged completed Action snapshot; afterJson is that snapshot plus `event: {type: "FOLLOW_UP_SATISFIED", schemaVersion: 1, outcome: string}`. The actor and occurrence time use existing history columns. Only matching before/after snapshots for the same completed Action/version satisfy required follow-up. Simultaneous identical requests produce one event; an identical repeat returns the existing result and a different outcome conflicts.

### Issue 6 — approved dashboard scope and compatibility

Status and IT Priority breakdowns cover all authorized Tickets, including terminal statuses and records older than seven days. Only Recent Tickets uses the rolling seven-day interval. Headline ownership/unassigned/urgent counts use the five open-work statuses; Tickets with My Actions uses assigned PLANNED/IN_PROGRESS Action existence without an additional Ticket-status restriction. Staff/Admin operational visibility reuses the existing shared Queue scope.

Issue 6 adds only the staff dashboard and staff Queue filters. Requester dashboard, requester list filter extensions and requester landing changes remain Issue 7. Staff lands on /staff/dashboard; Administrator still lands on /admin/users and can navigate to the staff dashboard. Staff/Admin receive no Create Ticket control because the existing creation API is Requester-only. No schema or migration changes are required.
