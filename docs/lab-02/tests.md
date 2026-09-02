# Lab 2 Test Plan and Results — TokTickIT

## 1. Test Strategy
Tests are planned before implementation (Test DD) and written to fail first,
then made to pass (TDD), per Issue. Coverage spans unit, API/integration, UI
component, UI style/visual, responsive, and E2E levels. Every Acceptance
Criterion in `specification.md` maps to at least one test below, and every
planned test names its real file path once implemented.

## 2. Planned Tests

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-01 | Ticket Number generator produces unique, correctly formatted values | Matches `TKT-{year}-{seq}`, no collisions across 1000 calls | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| API-01 | API | AC-01 | `POST /api/tickets` with valid data | 201; Ticket persisted; response includes ticketNumber | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | API | AC-04 | `POST /api/tickets` missing Summary | 400 with field-level error; no Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | API | AC-03, BR-07 | `GET /api/tickets/:id` for a Ticket owned by a different Requester | 404; no Ticket data leaked | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-04 | API | AC-10 | `GET /api/tickets` scoped to active Requester | Only that Requester's tickets returned, default sort Created Date desc | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-05 | API | AC-11 | `GET /api/tickets?search=zzz-no-match` | 200 with empty array + `noResults: true` metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | API | AC-07 | `POST /api/tickets/:id/attachments` with 6 MB file | 400 with size-limit error; not stored | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-07 | API | AC-08 | Upload a 6th attachment to a Ticket with 5 active attachments | 400 with max-attachments error | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-08 | API | AC-09 | `PATCH /api/attachments/:id/remove` with reason | 200; `isRemoved=true`; subsequent download returns 404/410 | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-09 | API | BR-04 | `GET /api/requesters` | Only `isActive=true` Requesters returned | `server/tests/lab-02/requesters.api.test.ts` | Pending |
| UI-01 | UI | AC-02 | Open My Tickets with no Requester selected | Redirects to Requester Selection screen | `client/src/.../RequesterGuard.test.tsx` | Pending |
| UI-02 | UI | AC-04 | Submit Create Ticket with blank Summary | Inline error under field; API not called | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-03 | UI | AC-05 | Rapid double-click Submit | Button disabled/busy after first click; one request only | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-04 | UI | AC-06 | Create-ticket API call rejects | Safe error shown; field values still populated | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-05 | UI | AC-12 | My Tickets loads for Requester with zero tickets | Empty-history state with Create Ticket CTA shown | `client/src/.../MyTickets.test.tsx` | Pending |
| UI-06 | UI | AC-11 | My Tickets search matches nothing | No-results state shown (distinct from empty state) | `client/src/.../MyTickets.test.tsx` | Pending |
| UI-07 | UI | AC-13 | Change Requester while on My Tickets | List reloads to new Requester's tickets only | `client/src/.../RequesterContext.test.tsx` | Pending |
| UI-08 | UI | AC-09 | Remove an attachment without entering a reason | Confirm action disabled until reason entered | `client/src/.../AttachmentSection.test.tsx` | Pending |
| STYLE-01 | UI Style | §8.8 | Required-field asterisk + validation message placement | Asterisk present; message renders directly below field | `client/src/.../CreateTicket.style.test.tsx` | Pending |
| RESP-01 | Responsive | AC-15 | Create Ticket, My Tickets, Ticket Detail at 375px, 800px, 1280px | No horizontal scroll, no clipped labels/buttons | `e2e/lab-02/responsive.spec.ts` (Playwright screenshots) | Pending |
| E2E-01 | E2E | AC-01, AC-10 | Full flow: select Requester → create ticket → find it in My Tickets | Ticket appears with matching Ticket Number | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-02 | E2E | AC-03 | Requester A creates a ticket; switch to Requester B; attempt direct access | Access blocked / ticket not visible to Requester B | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-09 | Add attachment, then soft-remove it, then attempt download | Upload succeeds; removed attachment blocked from download | `e2e/lab-02/attachment-lifecycle.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC ID | Requirement / BR | Covered by Test(s) | Test File(s) | Status |
|---|---|---|---|---|
| AC-01 | FR-03, FR-04, BR-01 | UNIT-01, API-01, E2E-01 | `ticket-number.unit.test.ts`, `create-ticket.api.test.ts`, `requester-ticket-flow.spec.ts` | Pending |
| AC-02 | FR-01 | UI-01 | `RequesterGuard.test.tsx` | Pending |
| AC-03 | FR-11, BR-07 | API-03, E2E-02 | `ticket-detail.api.test.ts`, `requester-ticket-flow.spec.ts` | Pending |
| AC-04 | BR-08, BR-09, BR-10, BR-11 | API-02, UI-02 | `create-ticket.api.test.ts`, `CreateTicket.test.tsx` | Pending |
| AC-05 | BR-12 | UI-03 | `CreateTicket.test.tsx` | Pending |
| AC-06 | BR-14 | UI-04 | `CreateTicket.test.tsx` | Pending |
| AC-07 | BR-15, BR-16 | API-06 | `attachments.api.test.ts` | Pending |
| AC-08 | BR-17 | API-07 | `attachments.api.test.ts` | Pending |
| AC-09 | BR-18, BR-19, BR-20 | API-08, UI-08, E2E-03 | `attachments.api.test.ts`, `AttachmentSection.test.tsx`, `attachment-lifecycle.spec.ts` | Pending |
| AC-10 | FR-05, FR-06, BR-22 | API-04 | `my-tickets.api.test.ts` | Pending |
| AC-11 | BR-24 | API-05, UI-06 | `my-tickets.api.test.ts`, `MyTickets.test.tsx` | Pending |
| AC-12 | BR-24 | UI-05 | `MyTickets.test.tsx` | Pending |
| AC-13 | BR-05 | UI-07 | `RequesterContext.test.tsx` | Pending |
| AC-14 | FR-12 | (add) API-10 reference-data failure test | `requesters.api.test.ts` (extend) | Pending |
| AC-15 | §8.7 | RESP-01 | `responsive.spec.ts` | Pending |

## 4. Responsive and Visual Checklist
- [ ] Desktop (≥992px): multi-column layout, content centered with max-width
- [ ] Tablet (768–991px): two-column where practical, Summary/Description have adequate width
- [ ] Mobile (<768px): fields stack vertically, buttons touch-friendly, no horizontal scroll
- [ ] No clipped labels, overlapping messages, or hidden buttons at any size
- [ ] Priority/Status badges are consistent and don't rely on color alone
- [ ] Editable vs. read-only vs. error vs. disabled field states are visually distinct
- [ ] Screenshots captured for Create Ticket, My Tickets, Ticket Detail at all three breakpoints under `artifacts/lab-02/screenshots/`

## 5. Test Commands
```bash
# Backend unit + API tests
cd server && npm test -- lab-02

# Frontend component tests
cd client && npm test -- lab-02

# E2E (Playwright)
npx playwright test e2e/lab-02
```

## 6. Final Results
_To be filled in once implementation lands on `main`: paste final pass/fail
counts and a link to the CI run or terminal output._

## 7. Known Limitations or Deferred Tests
- Load/performance testing is out of scope for Lab 2.
- Concurrent-edit / race-condition testing on attachment soft-removal is deferred (single-user test scenarios only).
- Cross-browser testing is limited to the Playwright default (Chromium) unless time permits adding Firefox/WebKit projects.
