# Lab 3 Test Design, TDD Plan, and Traceability — TokTickIT

**Status:** IMPLEMENTED — final-review verification on `fix/lab3-final-review`; final `main` verification is pending. The original plan and traceability are retained below. A passing suite is evidence for its implemented assertions, not a claim that every planned manual check has passed.

Prior verified baseline supplied for `lab3-staging` (before these fixes): server 278/278, client 217/217, migration regression 6/6 (included in server), Lab 3 E2E 21/21, TypeScript checks passed, and 18 responsive screenshots. These are not results from final `main`. Current branch results are recorded in §7.

## 1. Test Strategy

Lab 3 uses Test DD + TDD around security-sensitive boundaries first: authentication/session behavior, mandatory password change, backend authorization/ownership, migration preservation, then feature APIs/UI. Existing Lab 1/Lab 2 tests remain regression gates and must be adapted only where the Development Requester mechanism is intentionally replaced by authenticated identity.

Coverage types: unit, API/integration, UI component, UI style/accessibility, responsive/manual visual, security/authorization, migration/regression, and E2E.

## 2. Planned Automated Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |

|---|---|---|---|---|---|---|

| API-01 | API | FR-01, AC-01 | Valid active-user login | Session cookie + safe User/role returned | `server/tests/lab-03/auth.api.test.ts` | Branch suite passed; final main pending |

| API-02 | API/Security | BR-03/06, AC-02 | Wrong password, unknown email, inactive account | Same safe login failure; no session | `server/tests/lab-03/auth.api.test.ts` | Branch suite passed; final main pending |

| API-03 | API | FR-03, AC-01 | Current user with valid session | Safe identity only; no hash/token | `server/tests/lab-03/auth.api.test.ts` | Branch suite passed; final main pending |

| API-04 | API/Security | BR-11/13, AC-05 | Logout and invalid/expired session | Session invalidated; protected request -> 401 | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts` | Branch suite passed; final main pending |

| API-05 | API | FR-04/05, AC-03/04 | Initial-password session restriction + valid change | Normal APIs blocked until valid change; then allowed | `server/tests/lab-03/auth.api.test.ts` | Branch suite passed; final main pending |

| API-06 | API | BR-05, AC-04 | Password boundaries/mismatch | Invalid password rejected; no hash/state change | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/auth-contract.api.test.ts`, `server/tests/lab-03/password-policy.test.ts` | Branch suite passed; final main pending |

| API-07 | API/Security | FR-08, AC-06 | Role authorization matrix | Direct forbidden API calls return 403 | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-08 | API/Security | BR-15/16, AC-07/08 | Requester identity cannot be overridden; cross-owner Ticket safe 404 | Auth identity controls ownership; no leak | `server/tests/lab-03/requester-regression.api.test.ts` | Branch suite passed; final main pending |

| API-09 | API/Security | FR-15, AC-12 | Requester requests Internal Notes | 403; no note data | `server/tests/lab-03/comments-notes.api.test.ts` | Branch suite passed; final main pending |

| API-10 | API | FR-09/10, AC-07/10 | Authenticated Requester create/list | Own identity saved; own list behavior preserved | `server/tests/lab-03/requester-regression.api.test.ts` | Branch suite passed; final main pending |

| API-11 | API | FR-11, AC-08/09 | Authenticated Attachment lifecycle | Lab 2 rules preserved; cross-owner safe 404 | `server/tests/lab-03/requester-regression.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts`, `server/tests/lab-03/not-found-contract.api.test.ts` | Branch suite passed; final main pending |

| API-12 | API | FR-16/17, AC-14 | Staff Queue defaults + pagination | Shared results; updated-desc; metadata correct | `server/tests/lab-03/staff-queue.api.test.ts` | Branch suite passed; final main pending |

| API-13 | API | BR-49/50, AC-15 | Queue search and AND filters | Correct matching/filter combination | `server/tests/lab-03/staff-queue.api.test.ts` | Branch suite passed; final main pending |

| API-14 | API | BR-51/52, AC-15 | Queue sorting and invalid query values | Valid sort works; invalid query -> 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Branch suite passed; final main pending |

| API-15 | API | FR-19, AC-16 | Claim unassigned Ticket | Current staff becomes owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-16 | API/Conflict | BR-23, AC-16 | Claim assigned Ticket | 409; owner unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-17 | API | BR-22/24, AC-17 | Assign/reassign valid and invalid owner | Active staff/admin accepted; inactive/requester rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-18 | API | FR-20, AC-18 | IT Priority update | IT Priority changes; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-19 | API | BR-30, AC-19 | Every permitted status transition | Each matrix edge succeeds | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-20 | API/Conflict | BR-30/31, AC-19/20 | Invalid/same status + Requester direct status attempt | 409 for invalid staff transition; 403 Requester | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-21 | API | FR-13/22, AC-11/21 | Public Comment create/retrieve by permitted roles | Append-only; backend author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Branch suite passed; final main pending |

| API-22 | API | FR-23, AC-21 | Internal Note create/retrieve by staff/admin | Append-only; backend author/time; private | `server/tests/lab-03/comments-notes.api.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-23 | API/Validation | BR-40/41, AC-22 | Empty/whitespace/over-limit comment/note | 400; nothing created; plain-text content | `server/tests/lab-03/comments-notes.api.test.ts`, `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Branch suite passed; final main pending |

| API-24 | API | FR-14, AC-13 | Requester Problem Appears Resolved | Indication stored; formal status unchanged; idempotent | `server/tests/lab-03/comments-notes.api.test.ts` | Branch suite passed; final main pending |

| API-25 | API | BR-35, AC-11/13 | Requester comments after indication | Apparent-resolution indication clears | `server/tests/lab-03/comments-notes.api.test.ts` | Branch suite passed; final main pending |

| API-26 | API | FR-24/25, AC-23 | Admin User list/search/role filter | Safe User data; correct results | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-27 | API | FR-26, AC-24 | Admin creates valid one-role User | Hash stored; mustChangePassword true | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-28 | API/Conflict | FR-29, AC-25 | Duplicate email/invalid role/input | 409/400; no bad account | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-29 | API | FR-27, AC-23/25 | Edit name/email/role/activation | Valid update persisted | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-30 | API/Security | BR-44, AC-26 | Admin self-deactivation | 409; remains active | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-31 | API/Security | BR-45, AC-27 | Deactivate/change role of last active Admin | 409; active Admin remains | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-32 | API | FR-28, AC-28 | Set new initial password | New hash + mustChange; old sessions invalid | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| API-33 | API/Security | FR-24-31, AC-29 | Non-Admin calls Admin APIs | 403; no User-management data | `server/tests/lab-03/authorization.api.test.ts` | Branch suite passed; final main pending |

| API-34 | API/Conflict | BR-48 | Role-change Requester with existing Tickets | 409; ownership/access not orphaned | `server/tests/lab-03/users-admin.api.test.ts` | Branch suite passed; final main pending |

| UNIT-01 | Unit | BR-05 | Password-policy validator boundaries | Exact valid/invalid cases | `server/tests/lab-03/password-policy.test.ts` | Branch suite passed; final main pending |

| UNIT-02 | Unit | BR-30 | Status transition function/matrix | Only documented edges allowed | `server/tests/lab-03/status-transition.test.ts` | Branch suite passed; final main pending |

| UNIT-03 | Unit | BR-11 | Session token hashing/expiry helper | Raw token != stored hash; expiry correct | `server/tests/lab-03/session.test.ts` | Branch suite passed; final main pending |

| UI-01 | UI | AC-01/02 | Login validation, busy, safe credential/API failure | Correct feedback; duplicate submit blocked | `client/tests/lab-03/Login.test.tsx` | Branch suite passed; final main pending |

| UI-02 | UI | AC-03/04 | Change Password rules/busy/success | Normal app unavailable until success | `client/tests/lab-03/ChangePassword.test.tsx` | Branch suite passed; final main pending |

| UI-03 | UI/Auth | AC-06/29 | Role-specific AppShell navigation | Only permitted destinations/actions render | `client/tests/lab-03/AppShellAuthorization.test.tsx` | Branch suite passed; final main pending |

| UI-04 | UI/Regression | AC-07/10 | Auth Requester Create/My Tickets | No selector/requesterId control; Lab 2 behavior remains | `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/MyTickets.test.tsx`, `client/tests/lab-03/AppShellAuthorization.test.tsx` | Branch suite passed; final main pending |

| UI-05 | UI | AC-11/12/13 | Requester detail comments/resolution/private-note absence | Public composer works; no Internal Notes; indication UI | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Branch suite passed; final main pending |

| UI-06 | UI | AC-14/15 | Staff Queue populated/search/filter/sort/page | Query controls + states render correctly | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Branch suite passed; final main pending |

| UI-07 | UI | AC-16-22 | Staff Detail ownership/priority/status/comments/notes | Correct editable/read-only controls and errors | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Branch suite passed; final main pending |

| UI-08 | UI | AC-23-29 | User Management list/create/edit/reset/safety feedback | Minimal Admin workflow works | `client/tests/lab-03/UserManagement.test.tsx` | Branch suite passed; final main pending |

| UI-09 | UI/A11y | AC-30 | Labels, focusable controls, audience text, status text | Accessible names/labels; no color-only meaning | `client/tests/lab-03/Login.test.tsx`, `client/tests/lab-03/StaffTicketDetail.test.tsx`, `client/tests/lab-03/StaffTicketQueue.test.tsx`, `client/tests/lab-03/UserManagement.test.tsx` | Branch suite passed; final main pending |

| E2E-01 | E2E | AC-01/02/05/06 | Valid/invalid login + logout/direct-route block | Full auth lifecycle works | `e2e/lab-03/authentication.spec.ts` | Branch suite passed; final main pending |

| E2E-02 | E2E | AC-03/04/28 | Initial password login and mandatory change | App opens only after valid change | `e2e/lab-03/authentication.spec.ts` | Branch suite passed; final main pending |

| E2E-03 | E2E/Regression | AC-07-13 | Requester migrated ticket flow | Existing/new Tickets, attachments, comments, indication | `e2e/lab-03/requester-regression.spec.ts` | Branch suite passed; final main pending |

| E2E-04 | E2E | AC-14-22 | IT Staff queue -> claim/reassign -> priority/status -> comment/note | Operational flow persists and role rules hold | `e2e/lab-03/staff-ticket-flow.spec.ts` | Branch suite passed; final main pending |

| E2E-05 | E2E | AC-23-29 | Admin create/edit/deactivate/reset + first-login change | Admin workflow and safety rules demonstrated | `e2e/lab-03/user-administration.spec.ts` | Branch suite passed; final main pending |

## 3. Migration and Regression Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Evidence / File | Final |

|---|---|---|---|---|---|---|

| MIG-01 | Migration | AC-09 | DevelopmentRequester -> User preserving IDs | All old requester IDs map to Requester Users | `server/tests/lab-03/migration-regression.test.ts` + migration output | Branch suite passed; final main pending |

| MIG-02 | Migration | AC-09 | Ticket/Attachment counts and FK integrity | Counts preserved; no orphan rows | `server/tests/lab-03/migration-regression.test.ts` | Branch suite passed; final main pending |

| MIG-03 | Migration | BR-26, AC-09 | Existing Ticket IT Priority backfill | `itPriority == requestedPriority` after migration/backfill | `server/tests/lab-03/migration-regression.test.ts` | Branch suite passed; final main pending |

| MIG-04 | Seed | §8 Seed | Idempotent Lab 3 seed | Re-run does not duplicate required Users/reference data | `server/tests/lab-03/migration-regression.test.ts` | Branch suite passed; final main pending |

| REG-01 | Regression | AC-32 | Existing Lab 1 server/client tests | Still pass or documented auth-aware equivalent | existing `server/tests/lab-01/*`, `client/tests/lab-01/*` | Branch suite passed; final main pending |

| REG-02 | Regression | AC-32 | Lab 2 ticket number/create/list/detail/attachment behavior | Functional behavior preserved under authenticated identity | existing/adapted `server/tests/lab-02/*`, `client/tests/lab-02/*` | Branch suite passed; final main pending |

Migration test setup should snapshot/count the pre-migration fixture dataset before applying the Lab 3 migration in an isolated test database, then verify post-migration ownership and relationships. Do not test migration only against an empty database.

## 4. Manual Responsive / Visual / Accessibility Evidence

| Test ID | Type | AC | Evidence | Expected Result | Final |

|---|---|---|---|---|---|

| VIS-01 | Visual | AC-30 | Login + Change Password desktop/tablet/mobile screenshots | Zen Green, readable validation/busy/failure, no overflow | Screenshots exist; final-main visual review pending |

| VIS-02 | Visual | AC-30 | Requester Detail desktop/tablet/mobile | Public Comments + apparent-resolution action; no Internal Notes | Screenshots exist; final-main visual review pending |

| VIS-03 | Visual | AC-30 | Staff Queue desktop/tablet/mobile | Readable table/cards, filters, badges, pagination, no mega-grid overflow | Screenshots exist; final-main visual review pending |

| VIS-04 | Visual | AC-30 | Staff Detail desktop/tablet/mobile | Read-only vs editable clear; Public vs Internal unmistakable | Screenshots exist; final-main visual review pending |

| VIS-05 | Visual | AC-30 | User Management desktop/tablet/mobile | Simple responsive list/panel; no clipped actions | Screenshots exist; final-main visual review pending |

| VIS-06 | Accessibility | AC-30 | Keyboard/focus/labels/manual inspection | Visible focus; labels; audience/status not color-only | Partial — keyboard navigation/activation established; Sign in visible focus unconfirmed |

Screenshot destinations:

- `artifacts/lab-03/screenshots/login/` and `artifacts/lab-03/screenshots/change-password/`

- `artifacts/lab-03/screenshots/requester-ticket-detail/`

- `artifacts/lab-03/screenshots/staff-queue/`

- `artifacts/lab-03/screenshots/staff-ticket-detail/`

- `artifacts/lab-03/screenshots/user-management/`

## 5. AC Traceability

Every Acceptance Criterion must have at least one test before implementation PRs are considered complete.

| AC | Planned Coverage |

|---|---|

| AC-01 | API-01, API-03, E2E-01 |

| AC-02 | API-02, UI-01, E2E-01 |

| AC-03 | API-05, UI-02, E2E-02 |

| AC-04 | API-05/06, UI-02, E2E-02 |

| AC-05 | API-04, E2E-01 |

| AC-06 | API-07, UI-03, E2E-01 |

| AC-07 | API-08/10, UI-04, E2E-03 |

| AC-08 | API-08/11, E2E-03 |

| AC-09 | API-11, MIG-01/02/03, E2E-03 |

| AC-10 | API-10, UI-04, E2E-03 |

| AC-11 | API-21, UI-05, E2E-03 |

| AC-12 | API-09, UI-05 |

| AC-13 | API-24/25, UI-05, E2E-03 |

| AC-14 | API-12, UI-06, E2E-04 |

| AC-15 | API-13/14, UI-06, E2E-04 |

| AC-16 | API-15/16, UI-07, E2E-04 |

| AC-17 | API-17, UI-07 |

| AC-18 | API-18, UI-07, E2E-04 |

| AC-19 | API-19/20, UNIT-02, UI-07, E2E-04 |

| AC-20 | API-20, API-07 |

| AC-21 | API-21/22, UI-07, E2E-04 |

| AC-22 | API-23, UI-05/07 |

| AC-23 | API-26/29, UI-08, E2E-05 |

| AC-24 | API-27, UI-08, E2E-05 |

| AC-25 | API-28/29, UI-08 |

| AC-26 | API-30, UI-08, E2E-05 |

| AC-27 | API-31, UI-08, E2E-05 |

| AC-28 | API-32, E2E-02/05 |

| AC-29 | API-33, UI-03, E2E-05 |

| AC-30 | UI-09, VIS-01..06 |

| AC-31 | UI-01/02/05/06/07/08 + targeted API 500 mocks |

| AC-32 | REG-01/02 + final full-suite commands |

## 6. TDD Implementation Order

1. Migration fixture + migration regression tests.

2. Password policy/session helpers unit tests.

3. Auth API tests: login/me/change/logout/inactive/safe failures.

4. Authorization middleware tests for all roles and password-change gate.

5. Adapt Requester API regression tests to authenticated identity before removing selector scaffolding.

6. Staff Queue API tests, then implementation/UI tests.

7. Staff Ticket operations/status/comments/notes API tests, then implementation/UI tests.

8. Administrator API safety tests, then implementation/UI tests.

9. E2E flows and visual/responsive inspection.

10. Final regression from `main`; update only the `Final` column and actual paths/results, never rewrite the plan to match implementation after the fact.

## 7. Final Verification Commands (to run after implementation)

Run these commands again from final `main` after release integration:

```bash

cd server && npx tsc --noEmit && npm test

cd ../client && npx tsc --noEmit && npm test

cd ../e2e && npx playwright test

```

Also run build/type checks used by the repository and migration/seed verification against the Lab 3 test database. Final evidence must come from integrated `main` for submission.

### Coverage notes and final-review changes

- UI-04 uses the actual auth-aware Lab 2 Create Ticket/My Tickets suites and Lab 3 shell authorization tests. There is no `RequesterRegression.test.tsx` client file.
- UI-09 reuses existing assertions: Login labels/names; Staff Queue status/priority text and labelled filters; Staff Detail labelled operational controls and explicit Public/Internal audience text; User Management readable role/account states plus keyboard activation, password visibility controls, and focus return. No duplicate accessibility file or new library was needed. These do not establish visible CSS focus; VIS-06 remains Partial.
- API-07/08/09/11/22/23 mappings now identify the actual role, ownership, attachment, and Internal Note suites. API-01..06 also have exact response-contract assertions in `server/tests/lab-03/auth-contract.api.test.ts`.
- `server/tests/lab-03/ticket-id-validation.api.test.ts`: 130 malformed-ID cases (10 inputs across all 13 Ticket-ID routes), plus 3 in-range decimal lookup cases, including the PostgreSQL Int maximum. Invalid values return `400 INVALID_TICKET_ID`.
- `server/tests/lab-03/reference-data-contract.api.test.ts`: adds inactive Related System exclusion and safe Category unexpected-error response checks. Related System active filtering already existed.
- MIG-04 additionally checks that the idempotent seed exceeds the default 10-ticket queue page. The normal clean seed now has 11 realistic tickets, using preserved upserts and consecutive ticket numbers.
- E2E-04 creates a fresh NEW/unassigned ticket using an already prepared Requester, then uses Staff UI controls to paginate, open that ticket, claim it, change IT Priority and status, post a Public Comment, and add an Internal Note. Reload and API assertions verify persisted values/content and unchanged Requested Priority. Reassignment remains covered by API-17/UI-07; the E2E takes the claim path in the planned claim/reassign workflow.
- E2E-03 exercises newly created authenticated tickets and attachments. Historical migration preservation is established separately by MIG-01..04; the E2E alone does not prove access to a migrated fixture.
- AC-32 regression evidence comes from the existing auth-adapted Lab 1/Lab 2 server/client suites and Lab 3 Requester E2E. `e2e/lab-02/requester-ticket-flow.spec.ts` still requires the intentionally removed Development Requester selector; it is historical, not a runnable Lab 3 gate. Playwright `testMatch` and global setup remain unchanged. No separate handout was available in the repository; this interpretation follows the checked-in approved specification and the supplied final-review request.

### Current branch verification (2026-09-19)

Results below belong to `fix/lab3-final-review`, not final `main`:

- Server `npx tsc --noEmit`: passed.
- Server `npm test`: 413/413 passed, 22/22 files; includes migration regression 6/6.
- Client `npx tsc --noEmit`: passed.
- Client `npm test`: 217/217 passed, 18/18 files.
- Lab 3 `npx playwright test`: 21/21 passed across desktop/tablet/mobile (44.9s), including the strengthened E2E-04 and full-page queue pagination screenshots.
- E2E TypeScript via `../server/node_modules/.bin/tsc --noEmit`: passed (E2E has no local TypeScript dependency).
- Local `npm run prisma:seed`: passed.
- Root `git diff --check`: passed. Generated untracked `e2e/playwright-report/` removed.
- 18 responsive screenshots exist across six screens and three viewports. Screenshot existence does not substitute for manual review of every planned visual state.
- Initial sandbox attempts could not access PostgreSQL or bind the frontend port; authorized runs resolved those environment restrictions. An initial E2E run began before the backend was started; the complete rerun is recorded above.

Contract note from final review: specification §9 summarizes operational mutation paths as `/api/tickets/:id/owner`, `/it-priority`, and `/status`, while API specification §§6–7 and the implementation use `/api/staff/tickets/:id/...`. Reported without modifying either approved contract.

**Release gate still pending:** after merging the approved release to `main`, rerun all required suites/type checks and record final-main evidence, review the responsive screenshots, and resolve the unconfirmed visible Sign in focus in VIS-06. No final-main pass is claimed here.
