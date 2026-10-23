# TokTickIT — Lab 4 Test Plan and Traceability

**Status:** Planned, not executed. Test IDs, requirements, and acceptance criteria below form the approved Issue 1 test contract. Final results must be recorded from merged `main`.

## 1. Test strategy
Spec DD → Test DD → TDD. Test unit, API/integration, authorization, UI component, accessibility, responsive, concurrency, migration/recovery, regression, performance smoke and E2E. Use isolated database, deterministic fixtures and no real secrets. Existing Lab 2/3 tests remain mandatory.

## 2. Master test matrix
| Test ID | Type | AC | Scenario | Expected result | Target automated file | Final status |
|---|---|---|---|---|---|---|
| ACTION-ASSIGN-01 | API | AC-21, AC-33 | Active/inactive assignee, independent owner and performer | Active allowed, inactive 422, performer session actor | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| ACTION-AUDIT-01 | API | AC-27, AC-34, AC-43 | Durable append-only audit after restart | Immutable audit preserved | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| ACTION-STATE-01 | API | AC-07, AC-34 | State transitions, terminal lock | Only permitted transitions; immutable terminal states | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-01 | API | AC-01, AC-02 | Staff creates Action on another staff-owned Ticket | 201, correct Ticket/performer, owner unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-02 | API | AC-05 | List Actions on owned vs unowned Ticket | Own 200; other 404/deny | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-03 | API | AC-03, AC-04 | Invalid follow-up, inactive assignee, bad date/state | 422 safe field errors | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-04 | API | AC-06 | Edit Action, attempt protected field changes | Allowed fields saved; performer immutable | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-05 | API | AC-07 | Assign, complete, cancel; terminal edit attempts | Approved transitions only; audit appended | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-06 | API | AC-08, AC-09 | Requester advisory and allowed/forbidden Ticket changes | Advisory unchanged; invalid transition denied | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| API-07 | API | AC-10 | Resolve with zero Actions, unfinished Actions, then completed Action | Zero-action allowed for valid Lab 3 transition; unfinished blocked; completed and no follow-up succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| API-08 | API | AC-13 | Requester dashboard with multiple owners and empty user | Own-only counts, arrays; empty 0/[] | `server/tests/lab-04/requester-dashboard.api.test.ts` | Not run |
| API-09 | API | AC-12 | Staff dashboard against seeded statuses/priorities | Counts match DB and filter destinations | `server/tests/lab-04/staff-dashboard.api.test.ts` | Not run |
| API-10 | API | AC-17, AC-18 | Repeat same create request/idempotency key; simulated server error | No duplicate; safe error | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-11 | API | AC-01, AC-12 | Multiple Actions/Tickets share timestamps; paginate and sort | Stable order and bounded results | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-12 | API | AC-19, AC-20 | Action detail, pagination, equal-time ties | Immutable fields protected, stable ordered pages | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-13 | API | AC-21, AC-27 | Inactive assignment and audit mutation attempt | 422; audit entries append and remain immutable | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-14 | API | AC-30 | Health and safe server failure | No secret/SQL/stack in response | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| API-15 | API | AC-39 | PLANNED without result and COMPLETED without result | 201 planned, 422 completed missing result | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| API-16 | API | AC-40, AC-12, AC-13 | Dashboard wire values and count/list parity | Enums, summary, ticketNumber, matching filtered lists | `server/tests/lab-04/staff-dashboard.api.test.ts` | Not run |
| API-17 | API | AC-43 | Persist idempotency key across restart | Replay same response; mismatched body 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| AUTH-01 | Auth | AC-05 | Requester POST/PATCH Action; staff inaccessible Ticket | Denied backend-side | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| AUTH-02 | Auth | AC-12, AC-13 | Requester tries staff dashboard; staff tries requester dashboard | 403; no cross-user leak | `server/tests/lab-04/requester-dashboard.api.test.ts` | Not run |
| AUTH-03 | Auth | AC-42 | Requester Action fields and separate Internal Notes | All Action fields; private notes denied; other Ticket 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Not run |
| CON-01 | Concurrency | AC-11 | Two clients PATCH same Action version | One succeeds, stale Action PATCH returns 409 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| CON-02 | Concurrency | AC-11, AC-38, AC-41 | Legacy status PATCH and optional expectedStatus conflict | Legacy accepted, mismatch 409 STALE_UPDATE | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| DASH-DATE-01 | Unit/UI | AC-23, AC-37 | UTC seven-day boundary and Bangkok display | Correct inclusion, order and display | `server/tests/lab-04/dashboard.unit.test.ts` | Not run |
| E2E-01 | E2E | AC-01–AC-07 | Staff creates/assigns/edits/completes Action; requester views | End-to-end role-safe flow | `e2e/lab-04/actions-taken-flow.spec.ts` | Not run |
| E2E-02 | E2E | AC-08–AC-11 | Requester advisory, staff resolve, reopen, conflict | Transition/gate/feedback correct | `e2e/lab-04/ticket-resolution.spec.ts` | Not run |
| E2E-03 | E2E | AC-12, AC-13 | Staff/requester dashboards and drill-down | Accurate metrics, matching detail | `e2e/lab-04/dashboards.spec.ts` | Not run |
| E2E-04 | Responsive | AC-29 | 375/768/1440 screenshot and overflow checks | No overlap/clipping/overflow | `e2e/lab-04/responsive.spec.ts` | Not run |
| E2E-05 | E2E | AC-44 | Role-based landing redirects and old deep links | New dashboard defaults, old links work | `e2e/lab-04/dashboards.spec.ts` | Not run |
| MIG-01 | Migration | AC-14 | Migrate legacy seeded DB; run seed twice | Counts/data preserved; no duplicates | `server/tests/lab-04/migration.integration.test.ts` | Not run |
| MIG-02 | Integration | AC-31, AC-32 | Legacy data, seed repeat, recovery drill | All old rows preserved/restored | `server/tests/lab-04/migration.integration.test.ts` | Not run |
| PERF-01 | Smoke | AC-12, AC-13 | Seed representative Ticket volume, request dashboards | Queries bounded, no full collection returned; p95 <= 2 seconds measured | `server/tests/lab-04/dashboard.performance.test.ts` | Not run |
| PERF-02 | Smoke | AC-26 | 1,000 Tickets; >=30 warmed requests | p95 <= 2 s; max 5 rows per recent list | `server/tests/lab-04/dashboard.performance.test.ts` | Not run |
| PERF-03 | Smoke | AC-26 | Actions and dashboards p95 >=30 warmed requests | p95 <= 2 s for 1000 Tickets and 3000 Actions | `server/tests/lab-04/actions-taken.performance.test.ts` | Not run |
| REG-01 | Regression | AC-15 | Labs 2–3 login, roles, Tickets, attachments, comments, notes, admin | All existing suites pass | Existing `server`, `client`, `e2e` suites | Not run |
| REG-02 | API regression | AC-09, AC-15 | Existing `PATCH /api/staff/tickets/:id/status` accepts Lab 3 status enum values and approved transitions | Existing clients remain functional; unauthorized and invalid transitions rejected safely | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| REG-03 | Workflow regression | AC-09, AC-15 | `NEW → IN_PROGRESS`, `CLOSED → REOPENED`, and `REOPENED → RESOLVED` against existing Lab 3 policy | Preserve transitions unless changed by explicit approved requirement | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| RESP-01 | Responsive | AC-16 | Screens at 1440, 768, 375 px | No page overflow/clipping; forms usable | `e2e/lab-04/responsive.spec.ts` | Not run |
| UI-01 | Component | AC-12, AC-16 | Staff dashboard loading, metrics, zero, forbidden, failure | Correct accessible states and links | `client/tests/lab-04/StaffDashboard.test.tsx` | Not run |
| UI-02 | Component | AC-13, AC-16 | Requester dashboard data, empty, drill-down | Owned data only, working links | `client/tests/lab-04/RequesterDashboard.test.tsx` | Not run |
| UI-03 | Component | AC-01, AC-03, AC-05 | Action list, create, follow-up validation, requester read-only | Proper fields and role controls | `client/tests/lab-04/ActionsTaken.test.tsx` | Not run |
| UI-04 | Component | AC-06, AC-07, AC-11 | Action edit, complete/cancel, stale conflict | Draft retained; state buttons correct | `client/tests/lab-04/ActionsTaken.test.tsx` | Not run |
| UI-05 | Component | AC-08–AC-10 | Status control and advisory indication | Only valid controls; advisory does not resolve | `client/tests/lab-04/TicketWorkflow.test.tsx` | Not run |
| UI-06 | Style/A11y | AC-16 | Keyboard/focus/labels/contrast/non-color cues | Meets checklist | `client/tests/lab-04/lab-04.accessibility.test.tsx` | Not run |
| UI-07 | Component | AC-17, AC-18 | Double-click submit and network error | One request; values preserved | `client/tests/lab-04/ActionsTaken.test.tsx` | Not run |
| UI-08 | Component | AC-22, AC-24, AC-25 | Refresh, empty, administrator navigation | Correct refresh, zero state and preserved navigation | `client/tests/lab-04/StaffDashboard.test.tsx` | Not run |
| UI-09 | Accessibility | AC-28 | Keyboard/labels/contrast/non-color | WCAG 2.1 AA review passes | `client/tests/lab-04/lab-04.accessibility.test.tsx` | Not run |
| UNIT-01 | Unit | AC-03 | Follow-up required without note | Invalid with field error | `server/tests/lab-04/actions-taken.unit.test.ts` | Not run |
| UNIT-02 | Unit | AC-09, AC-10 | Transition matrix and resolution gate | Approved moves allowed, including legacy zero-Action resolution | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Not run |
| UNIT-03 | Unit | AC-12, AC-13 | Count statuses and recent window boundaries | Correct 0/nonzero counts | `server/tests/lab-04/dashboard.unit.test.ts` | Not run |
| UNIT-04 | Unit | AC-12, AC-13 | UTC and dashboard local-day boundary fixture | Counts include exactly intended dates | `server/tests/lab-04/dashboard.unit.test.ts` | Not run |
| UNIT-05 | Unit | AC-23 | Rolling seven-day and Bangkok date boundaries | Exact boundary counts and deterministic tie-break | `server/tests/lab-04/dashboard.unit.test.ts` | Not run |
| WORKFLOW-CANCEL-01 | API | AC-35 | Cancellation with rollback injection | Atomic cancellation, rollback preserves all | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |
| WORKFLOW-GATE-01 | API | AC-10, AC-36, AC-45 | Zero actions, unfinished actions, follow-up and completed actions | Zero-action valid Lab 3 resolution succeeds; unfinished/follow-up blocked; completed/no follow-up succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | Not run |

## 3. Acceptance criteria → test traceability
| AC | Planned tests |
|---|---|
| AC-01 | API-01, API-11, E2E-01, UI-03 |
| AC-02 | API-01, E2E-01 |
| AC-03 | API-03, UI-03, UNIT-01 |
| AC-04 | API-03 |
| AC-05 | API-02, AUTH-01, E2E-01, UI-03 |
| AC-06 | API-04, UI-04 |
| AC-07 | ACTION-STATE-01, API-05, E2E-01, UI-04 |
| AC-08 | API-06, E2E-02, UI-05 |
| AC-09 | API-06, REG-02, REG-03, UI-05, UNIT-02 |
| AC-10 | API-07, E2E-02, UI-05, UNIT-02, WORKFLOW-GATE-01 |
| AC-11 | CON-01, CON-02, E2E-02, UI-04 |
| AC-12 | API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UNIT-03, UNIT-04 |
| AC-13 | API-08, API-16, AUTH-02, E2E-03, PERF-01, UI-02, UNIT-03, UNIT-04 |
| AC-14 | MIG-01 |
| AC-15 | REG-01, REG-02, REG-03 |
| AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| AC-17 | API-10, UI-07 |
| AC-18 | API-10, UI-07 |
| AC-19 | API-11, API-12 |
| AC-20 | API-04, API-12, UI-04 |
| AC-21 | ACTION-ASSIGN-01, API-03, API-13 |
| AC-22 | E2E-02, UI-04, UI-05, UI-08 |
| AC-23 | API-11, DASH-DATE-01, UNIT-04, UNIT-05 |
| AC-24 | API-08, API-09, UI-08 |
| AC-25 | AUTH-02, REG-01, UI-08 |
| AC-26 | PERF-01, PERF-02, PERF-03 |
| AC-27 | ACTION-AUDIT-01, API-05, API-13 |
| AC-28 | UI-06, UI-09 |
| AC-29 | E2E-04, RESP-01 |
| AC-30 | API-10, API-14 |
| AC-31 | E2E-01, E2E-03, MIG-01, MIG-02 |
| AC-32 | MIG-01, MIG-02 |
| AC-33 | ACTION-ASSIGN-01 |
| AC-34 | ACTION-AUDIT-01, ACTION-STATE-01 |
| AC-35 | WORKFLOW-CANCEL-01 |
| AC-36 | WORKFLOW-GATE-01 |
| AC-37 | DASH-DATE-01 |
| AC-38 | CON-02 |
| AC-39 | API-15 |
| AC-40 | API-16 |
| AC-41 | CON-02 |
| AC-42 | AUTH-03 |
| AC-43 | ACTION-AUDIT-01, API-17 |
| AC-44 | E2E-05 |
| AC-45 | WORKFLOW-GATE-01 |

## 4. Requirements → acceptance criteria → tests
| Requirement | AC | Tests |
|---|---|---|
| FR-01 | AC-01, AC-05, AC-19 | API-01, API-02, API-11, API-12, AUTH-01, E2E-01, UI-03 |
| FR-02 | AC-01, AC-02, AC-03 | API-01, API-03, API-11, E2E-01, UI-03, UNIT-01 |
| FR-03 | AC-06 | API-04, UI-04 |
| FR-04 | AC-05, AC-42 | API-02, AUTH-01, AUTH-03, E2E-01, UI-03 |
| FR-05 | AC-07 | ACTION-STATE-01, API-05, E2E-01, UI-04 |
| FR-06 | AC-03, AC-04, AC-21, AC-39 | ACTION-ASSIGN-01, API-03, API-13, API-15, UI-03, UNIT-01 |
| FR-07 | AC-09, AC-10, AC-45 | API-06, API-07, E2E-02, REG-02, REG-03, UI-05, UNIT-02, WORKFLOW-GATE-01 |
| FR-08 | AC-08 | API-06, E2E-02, UI-05 |
| FR-09 | AC-12, AC-40 | API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UNIT-03, UNIT-04 |
| FR-10 | AC-13, AC-40 | API-08, API-16, AUTH-02, E2E-03, PERF-01, UI-02, UNIT-03, UNIT-04 |
| FR-11 | AC-12, AC-13, AC-40 | API-08, API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UI-02, UNIT-03, UNIT-04 |
| FR-12 | AC-11, AC-41 | CON-01, CON-02, E2E-02, UI-04 |
| FR-13 | AC-15 | REG-01, REG-02, REG-03 |
| FR-14 | AC-16, AC-18, AC-44 | API-10, E2E-05, RESP-01, UI-01, UI-02, UI-06, UI-07 |
| FR-15 | AC-16, AC-28, AC-29 | E2E-04, RESP-01, UI-01, UI-02, UI-06, UI-09 |
| FR-16 | AC-20 | API-04, API-12, UI-04 |
| FR-17 | AC-19 | API-11, API-12 |
| FR-18 | AC-01, AC-06, AC-20 | API-01, API-04, API-11, API-12, E2E-01, UI-03, UI-04 |
| FR-19 | AC-21 | ACTION-ASSIGN-01, API-03, API-13 |
| FR-20 | AC-27, AC-43 | ACTION-AUDIT-01, API-05, API-13, API-17 |
| FR-21 | AC-07 | ACTION-STATE-01, API-05, E2E-01, UI-04 |
| FR-22 | AC-22 | E2E-02, UI-04, UI-05, UI-08 |
| FR-23 | AC-05 | API-02, AUTH-01, E2E-01, UI-03 |
| FR-24 | AC-09 | API-06, REG-02, REG-03, UI-05, UNIT-02 |
| FR-25 | AC-09 | API-06, REG-02, REG-03, UI-05, UNIT-02 |
| FR-26 | AC-10 | API-07, E2E-02, UI-05, UNIT-02, WORKFLOW-GATE-01 |
| FR-27 | AC-22 | E2E-02, UI-04, UI-05, UI-08 |
| FR-28 | AC-12 | API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UNIT-03, UNIT-04 |
| FR-29 | AC-12 | API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UNIT-03, UNIT-04 |
| FR-30 | AC-13 | API-08, API-16, AUTH-02, E2E-03, PERF-01, UI-02, UNIT-03, UNIT-04 |
| FR-31 | AC-23 | API-11, DASH-DATE-01, UNIT-04, UNIT-05 |
| FR-32 | AC-24 | API-08, API-09, UI-08 |
| FR-33 | AC-12, AC-13 | API-08, API-09, API-11, API-16, AUTH-02, E2E-03, PERF-01, UI-01, UI-02, UNIT-03, UNIT-04 |
| FR-34 | AC-25 | AUTH-02, REG-01, UI-08 |
| FR-35 | AC-14, AC-15, AC-31 | E2E-01, E2E-03, MIG-01, MIG-02, REG-01, REG-02, REG-03 |
| FR-36 | AC-11, AC-18 | API-10, CON-01, CON-02, E2E-02, UI-04, UI-07 |
| FR-37 | AC-18 | API-10, UI-07 |
| FR-38 | AC-31 | E2E-01, E2E-03, MIG-01, MIG-02 |
| FR-39 | AC-15, AC-25 | AUTH-02, REG-01, REG-02, REG-03, UI-08 |
| FR-40 | AC-30 | API-10, API-14 |
| NFR-01 | AC-05, AC-09, AC-13 | API-02, API-06, API-08, API-16, AUTH-01, AUTH-02, E2E-01, E2E-03, PERF-01, REG-02, REG-03, UI-02, UI-03, UI-05, UNIT-02, UNIT-03, UNIT-04 |
| NFR-02 | AC-11 | CON-01, CON-02, E2E-02, UI-04 |
| NFR-03 | AC-17, AC-18 | API-10, UI-07 |
| NFR-04 | AC-26 | PERF-01, PERF-02, PERF-03 |
| NFR-05 | AC-16, AC-28 | RESP-01, UI-01, UI-02, UI-06, UI-09 |
| NFR-06 | AC-16, AC-29 | E2E-04, RESP-01, UI-01, UI-02, UI-06 |
| NFR-07 | AC-15, AC-31 | E2E-01, E2E-03, MIG-01, MIG-02, REG-01, REG-02, REG-03 |
| NFR-08 | AC-03, AC-04, AC-18, AC-30 | API-03, API-10, API-14, UI-03, UI-07, UNIT-01 |
| NFR-09 | AC-14, AC-32 | MIG-01, MIG-02 |
| NFR-10 | AC-16, AC-28, AC-44 | E2E-05, RESP-01, UI-01, UI-02, UI-06, UI-09 |
| NFR-11 | AC-27, AC-43 | ACTION-AUDIT-01, API-05, API-13, API-17 |
| NFR-12 | AC-19, AC-23 | API-11, API-12, DASH-DATE-01, UNIT-04, UNIT-05 |
| NFR-13 | AC-23 | API-11, DASH-DATE-01, UNIT-04, UNIT-05 |
| NFR-14 | AC-03, AC-04 | API-03, UI-03, UNIT-01 |
| NFR-15 | AC-05 | API-02, AUTH-01, E2E-01, UI-03 |
| NFR-16 | AC-17, AC-18 | API-10, UI-07 |
| NFR-17 | AC-30 | API-10, API-14 |
| NFR-18 | AC-15 | REG-01, REG-02, REG-03 |
| NFR-19 | AC-32 | MIG-01, MIG-02 |
| NFR-20 | AC-26 | PERF-01, PERF-02, PERF-03 |
| BR-01 | AC-01 | API-01, API-11, E2E-01, UI-03 |
| BR-02 | AC-02 | API-01, E2E-01 |
| BR-03 | AC-01 | API-01, API-11, E2E-01, UI-03 |
| BR-04 | AC-03, AC-39 | API-03, API-15, UI-03, UNIT-01 |
| BR-05 | AC-04, AC-23 | API-03, API-11, DASH-DATE-01, UNIT-04, UNIT-05 |
| BR-06 | AC-04, AC-21 | ACTION-ASSIGN-01, API-03, API-13 |
| BR-07 | AC-07 | ACTION-STATE-01, API-05, E2E-01, UI-04 |
| BR-08 | AC-06, AC-20 | API-04, API-12, UI-04 |
| BR-09 | AC-07, AC-27 | ACTION-AUDIT-01, ACTION-STATE-01, API-05, API-13, E2E-01, UI-04 |
| BR-10 | AC-14 | MIG-01 |
| BR-11 | AC-08 | API-06, E2E-02, UI-05 |
| BR-12 | AC-10, AC-45 | API-07, E2E-02, UI-05, UNIT-02, WORKFLOW-GATE-01 |
| BR-13 | AC-09 | API-06, REG-02, REG-03, UI-05, UNIT-02 |
| BR-14 | AC-11 | CON-01, CON-02, E2E-02, UI-04 |
| BR-15 | AC-05, AC-12, AC-13, AC-40 | API-02, API-08, API-09, API-11, API-16, AUTH-01, AUTH-02, E2E-01, E2E-03, PERF-01, UI-01, UI-02, UI-03, UNIT-03, UNIT-04 |
| BR-16 | AC-13, AC-24 | API-08, API-09, API-16, AUTH-02, E2E-03, PERF-01, UI-02, UI-08, UNIT-03, UNIT-04 |
| BR-17 | AC-12, AC-19, AC-23 | API-09, API-11, API-12, API-16, AUTH-02, DASH-DATE-01, E2E-03, PERF-01, UI-01, UNIT-03, UNIT-04, UNIT-05 |
| BR-18 | AC-17, AC-43 | ACTION-AUDIT-01, API-10, API-17, UI-07 |
| BR-19 | AC-05, AC-42 | API-02, AUTH-01, AUTH-03, E2E-01, UI-03 |
| BR-20 | AC-14, AC-15, AC-32 | MIG-01, MIG-02, REG-01, REG-02, REG-03 |
| BR-21 | AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| BR-22 | AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| BR-23 | AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| BR-24 | AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| BR-25 | AC-16 | RESP-01, UI-01, UI-02, UI-06 |
| BR-26 | AC-41 | CON-02 |

## 5. Approved decisions and required evidence
| Decision | AC | Required test |
|---|---|---|
| D-01 Action lifecycle | AC-07, AC-34 | ACTION-STATE-01 |
| D-02 Staff assignment | AC-21, AC-33 | ACTION-ASSIGN-01 |
| D-03 Terminal lock and history | AC-27, AC-34, AC-43 | ACTION-AUDIT-01 |
| D-04 Resolution gate | AC-10, AC-36, AC-45 | WORKFLOW-GATE-01 |
| D-05 Atomic Ticket cancellation | AC-35 | WORKFLOW-CANCEL-01 |
| D-06 Stale writes, legacy compatibility | AC-11, AC-38, AC-41 | CON-01, CON-02 |
| D-07 Rolling seven days | AC-23, AC-37 | DASH-DATE-01 |
| D-08 p95 performance | AC-26 | PERF-01, PERF-02, PERF-03 |

## 6. Seed and regression fixtures
Preserve and rerun existing Lab 3 `status-transition.test.ts` and `staff-ticket-detail.api.test.ts` unchanged for zero-Action Ticket resolution. The new Lab 4 gate must not break their seeded zero-Action resolution scenarios. Add an explicit Lab 4 API regression asserting the same behavior and verify non-cancelled unfinished Actions and outstanding follow-up still block resolution.

Include all eight Ticket statuses, zero/one/multiple Actions, all Action states, active/inactive staff, assigned/unassigned Tickets, two Requesters with different Tickets, Requester with none, zero-action legacy Ticket, exactly seven-day boundary and older timestamps, tied timestamps, and HIGH priority urgent Tickets. Idempotent seed rerun must preserve counts and IDs.

Run existing Lab 2 and Lab 3 authentication, requester ownership, Ticket detail, attachment, Public Comment, Internal Note, staff queue/status transitions and Administrator management tests unchanged. Check `NEW → IN_PROGRESS`, `CLOSED → REOPENED`, and legacy `PATCH /api/staff/tickets/:id/status` with `{status}` only. Do not claim passes without execution.

## 7. Manual visual and accessibility checklist
- [ ] Staff and Requester dashboards and Actions Taken at 375px, 768px, 1440px.
- [ ] Keyboard navigation, visible focus, form labels, semantic errors, non-color status cues and WCAG 2.1 AA checks.
- [ ] Loading, empty, success, 401, 403, 404, 409, 422 and safe 500 states; recoverable drafts retained.
- [ ] Cards link to correctly filtered Ticket lists; screenshots show card counts equal list results for unchanged fixture.
- [ ] Screenshots in `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/`.

## 8. Migration and performance evidence
1. Back up isolated legacy database; record row counts; apply additive migration; compare counts and relationships.
2. Seed twice and verify no duplicate records. Simulate transaction failure and recovery on disposable database.
3. Execute each API endpoint >=30 warmed times on documented local 1,000-Ticket/3,000-Action fixture; record p50/p95, request count and machine details. Require p95 <=2 seconds for Actions and dashboard endpoints.
4. Run all new and existing test suites on merged `main`, capture command, commit SHA and complete output. Update Final status from Not run only with evidence.

## 9. Product completion evidence
- [ ] Every AC and FR/NFR/BR trace is verified against the implemented test files.
- [ ] Unit/API/UI/auth/migration/performance/E2E and Labs 2–3 regression evidence captured.
- [ ] Reviewer PR comments and approvals, AI-use reflection, README and final PDF Answer Part 1–9 completed separately.
