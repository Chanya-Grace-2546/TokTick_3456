
# Lab 2 Test Plan and Results — TokTickIT

## 1. Test Strategy
Tests are planned before implementation (Test DD) and written to fail first,
then made to pass (TDD), per Issue. Coverage spans unit, API/integration, UI
component, and E2E levels. Every Acceptance Criterion in `specification.md`
maps to at least one test below. File paths below are the REAL paths in the
repo as of the release PR — reconciled against the original plan, since a
few tests ended up combined into shared files rather than split exactly as
first planned.

## 2. Planned Tests

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-01 | Ticket Number generator produces correctly formatted, padded values | Matches `TKT-{year}-{6-digit seq}` | `server/tests/lab-02/ticketNumber.test.ts` | Pass |
| API-01 | API | AC-01 | `POST /api/tickets` with valid data | 201; Ticket persisted; response includes ticketNumber | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | AC-04 | `POST /api/tickets` missing/short Summary | 400 with field-level error; no Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | AC-03, BR-07 | `GET /api/tickets/:id` for a Ticket owned by a different Requester | 404; no Ticket data leaked | `server/tests/lab-02/attachments.api.test.ts` (combined with Issue 6, not a separate `ticket-detail.api.test.ts`) | Pass |
| API-04 | API | AC-10 | `GET /api/tickets` scoped to active Requester | Only that Requester's tickets returned, default sort Created Date desc | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-05 | API | AC-11 | `GET /api/tickets?search=zzz-no-match` | 200 with empty array + `noResults: true` metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-06 | API | AC-07 | `POST /api/tickets/:id/attachments` with an oversized file | 400 with size-limit error; not stored | — | **Deferred, see §7** |
| API-07 | API | AC-08 | Upload a 6th attachment to a Ticket with 5 active attachments | 400 with max-attachments error | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-08 | API | AC-09 | `PATCH /api/attachments/:id/remove` with reason | 200; `isRemoved=true`; subsequent download returns 410 | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-09 | API | BR-04 | `GET /api/requesters` | Only `isActive=true` Requesters returned | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| UI-01 | UI | AC-02 | Open My Tickets with no Requester selected | Redirects to Requester Selection screen | `client/tests/lab-02/RequesterGuard.test.tsx` | Pass |
| UI-02 | UI | AC-04 | Submit Create Ticket with blank Summary | Inline error under field; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-05 | Submit disabled while request is in flight | Button disabled/busy after first click; one request only | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-04 | UI | AC-06 | Create-ticket API call rejects | Safe error shown; field values still populated | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-05 | UI | AC-12 | My Tickets loads for Requester with zero tickets | Empty-history state with Create Ticket CTA shown | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-06 | UI | AC-11 | My Tickets search matches nothing | No-results state shown (distinct from empty state) | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-07 | UI | AC-13 | Requester context clears on Change Requester, forcing re-selection | Context resets; dependent screens must re-fetch | `client/tests/lab-02/RequesterContext.test.tsx` | Pass — see §7 note on integration-level gap |
| UI-08 | UI | AC-09 | Cancel/empty reason when removing an attachment | No removal request sent | — | **Deferred, see §7** |
| STYLE-01 | UI Style | §8.8 | Required-field asterisk + validation message placement | Asterisk present; message renders directly below field | — | **Deferred, see §7** (covered informally by UI-02/UI-04, not a dedicated style test) |
| RESP-01 | Responsive | AC-15 | Create Ticket, My Tickets, Ticket Detail at 375px, 850px, 1280px | No horizontal scroll, no clipped labels/buttons; screenshots saved | `e2e/lab-02/requester-ticket-flow.spec.ts` (screenshots embedded in the flow, not a separate `responsive.spec.ts`) | Pass |
| RESP-02 | Responsive | AC-16 | Tablet layout at 768–991px | Two-column layout where practical and sufficient width | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| RESP-03 | Responsive | AC-17 | Desktop layout at ≥992px | Multi-column layout and centered content | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-01 | E2E | AC-01, AC-10 | Full flow: select Requester → create ticket → find it in My Tickets | Ticket appears with matching Ticket Number | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-03 | Requester A creates a ticket; switch to Requester B; attempt direct access | Access blocked / ticket not visible to Requester B | — | **Deferred, see §7** (equivalent coverage exists at API-03) |
| E2E-03 | E2E | AC-09 | Add attachment, soft-remove it, then attempt download | Upload succeeds; removed attachment blocked from download | — | **Deferred, see §7** (equivalent coverage exists at API-08; E2E spec removes but doesn't re-attempt download) |

## 3. Acceptance-Criterion Traceability

| AC ID | Requirement / BR | Covered by Test(s) | Test File(s) | Status |
|---|---|---|---|---|
| AC-01 | FR-03, FR-04, BR-01 | UNIT-01, API-01, E2E-01 | `ticketNumber.test.ts`, `create-ticket.api.test.ts`, `requester-ticket-flow.spec.ts` | Pass |
| AC-02 | FR-01 | UI-01 | `RequesterGuard.test.tsx` | Pass |
| AC-03 | FR-11, BR-07 | API-03 | `attachments.api.test.ts` | Pass (API-level only — see E2E-02 deferral) |
| AC-04 | BR-08, BR-09, BR-10, BR-11 | API-02, UI-02 | `create-ticket.api.test.ts`, `CreateTicket.test.tsx` | Pass |
| AC-05 | BR-12 | UI-03 | `CreateTicket.test.tsx` | Pass |
| AC-06 | BR-14 | UI-04 | `CreateTicket.test.tsx` | Pass |
| AC-07 | BR-15, BR-16 | — | — | **Deferred (API-06)** |
| AC-08 | BR-17 | API-07 | `attachments.api.test.ts` | Pass |
| AC-09 | BR-18, BR-19, BR-20 | API-08 | `attachments.api.test.ts` | Pass (API-level only — see UI-08/E2E-03 deferrals) |
| AC-10 | FR-05, FR-06, BR-22 | API-04 | `my-tickets.api.test.ts` | Pass |
| AC-11 | BR-24 | API-05, UI-06 | `my-tickets.api.test.ts`, `MyTickets.test.tsx` | Pass |
| AC-12 | BR-24 | UI-05 | `MyTickets.test.tsx` | Pass |
| AC-13 | BR-05 | UI-07 | `RequesterContext.test.tsx` | Pass |
| AC-14 | FR-12 | RequesterSelection + CreateTicket reference-data failure tests | `RequesterSelection.test.tsx`, `CreateTicket.test.tsx` | Pass |
| RESP-01 | Responsive | AC-15 | Mobile layout at <768px | Fields stack vertically, buttons remain touch-friendly, and no horizontal scrolling occurs | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| RESP-02 | Responsive | AC-16 | Tablet layout at 768–991px | Two-column layout where practical and sufficient width | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| RESP-03 | Responsive | AC-17 | Desktop layout at ≥992px | Multi-column layout and centered content | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
## 4. Responsive and Visual Checklist
- [x] Desktop (≥992px): multi-column layout, content centered with max-width
- [x] Tablet (768–991px): two-column where practical (Create Ticket's field row confirmed; My Tickets' filter bar stays single-row at this width)
- [x] Mobile (<768px): fields stack vertically, buttons touch-friendly, no horizontal scroll
- [x] No clipped labels, overlapping messages, or hidden buttons at any size (manually verified at 645px and 957px during development)
- [x] Priority/Status badges are consistent and don't rely on color alone (text label always present alongside color)
- [x] Editable vs. read-only field states are visually distinct (pale-green shading on read-only fields)
- [x] Screenshots captured for Create Ticket, My Tickets, Ticket Detail at all three breakpoints under `artifacts/lab-02/screenshots/`

## 5. Test Commands
```bash
# Backend unit + API tests
cd server && npx vitest run tests/lab-02/

# Frontend component tests
cd client && npx vitest run

# E2E (Playwright) — requires server AND client already running with a
# migrated, seeded database
cd e2e && npx playwright test
```

## 6. Current Integration Results

These results were recorded on `lab2-staging` before the release merge to
`main`. Final results will be rerun and recorded after the release PR is
merged to `main`.

- Backend (`server/tests/lab-02/`): 5 test files, all passing.
- Frontend (`client/`): 34/34 tests passing across all Lab 2 test files.
- E2E (`e2e/lab-02/requester-ticket-flow.spec.ts`): 3/3 passing.

Final test output from `main` will be added after the release merge.

## 7. Known Limitations or Deferred Tests
- **API-06** (oversized-file rejection): multer's `limits.fileSize` enforces
  the 5MB cap in the running application, but no automated test proves this
  specific case. Deferred due to time; the underlying enforcement is
  standard, well-tested multer behavior, not custom code.
- **UI-08** (empty/cancelled removal reason): the app uses `window.prompt()`
  to collect the removal reason, and the code already checks for an
  empty/cancelled value before sending the request — but this specific path
  has no dedicated test. Deferred.
- **STYLE-01** (dedicated asterisk/validation-placement test): required-field
  asterisks and validation-message placement are visually implemented and
  incidentally exercised by UI-02/UI-04, but no standalone style-assertion
  test exists.
- **E2E-02** (cross-Requester access blocked, at the E2E/browser level): the
  underlying behavior is proven at the API level (API-03: `GET
  /api/tickets/:id` returns 404 for a non-owning Requester), but the E2E
  spec doesn't script switching Requesters mid-flow to demonstrate it end
  to end in a real browser session.
- **E2E-03** (download blocked after removal, at the E2E level): same
  situation — proven at the API level (API-08), but the E2E spec removes an
  attachment without then re-attempting a download to show the block
  end to end.
- Load/performance testing is out of scope for Lab 2.
- Concurrent-edit / race-condition testing on attachment soft-removal is
  deferred (single-user test scenarios only).
- Cross-browser testing is limited to the Playwright default (Chromium)
  unless time permits adding Firefox/WebKit projects.
