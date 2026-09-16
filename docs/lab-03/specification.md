# Lab 3 Sprint Engineering Specification — TokTickIT

## 1. Sprint Goal
Deliver authenticated, role-aware TokTickIT operations without breaking the completed Lab 2 Requester increment. Lab 3 replaces the Development Requester selector with real accounts, adds mandatory first-login password change, introduces an IT Staff queue and operational Ticket workflow, adds Public Comments and private Internal Notes, and provides minimalist Administrator user management while preserving existing Tickets and Attachments.

## 2. Stakeholder Request Interpretation
TokTickIT must move from a development-only Requester identity to real authenticated users. Requesters must keep their Lab 2 ticket capabilities, but ownership must come only from the authenticated account. IT Staff need a shared queue and Ticket Detail workflow for ownership, IT Priority, status, Public Comments, and Internal Notes. Administrators need a deliberately small User Management area for account creation/editing, one-role assignment, activation/deactivation, and issuing a new initial password. Authorization must be enforced by the backend; hidden navigation or buttons are only UI feedback, not security.

## 3. Scope

### Included
- Email/password login, logout, current-user retrieval, and mandatory first-login password change.
- One role per user: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- Server-side authentication, role authorization, and Requester ownership checks.
- Migration of Lab 2 `DevelopmentRequester` records to real `User` records while preserving Ticket ownership and Attachment continuity.
- Authenticated Requester regression: Create Ticket, My Tickets, Ticket Detail, attachment upload/download/soft-remove.
- Requester Public Comments and a `Problem Appears Resolved` indication.
- IT Staff Ticket Queue with search, filters, sorting, pagination, ownership/status/priority visibility, and responsive presentation.
- IT Staff Ticket Detail with claim/reassign, IT Priority, permitted status changes, Public Comments, Internal Notes, and existing Attachments.
- Minimal Administrator User Management: list, search, optional role filter, create, edit name/email/role/activation, and set a new initial password.
- Zen Green role-aware application shell, feedback states, responsive behavior, and accessibility continuity.
- Unit/API/integration/UI/security/regression/migration/E2E test coverage and traceable completion evidence.

### Explicitly Excluded
- Self-registration, Requester-created accounts, email invitations, password-reset email, MFA, social login, and SSO.
- Actions Taken by IT Staff.
- SLA calculations, escalations, notifications, dashboards/KPIs beyond simple queue counts.
- Multiple roles per user, departments/organizations, profile photos, role history, account audit history, multi-tenancy.
- User deletion, bulk user operations, import/export, account unlocking, approval workflows, advanced recovery.
- Mandatory Administrator-list pagination, multi-column sorting, or multiple simultaneous filters.
- Production deployment/cloud-infrastructure changes.

## 4. Functional Requirements

### Authentication and Application Shell
- **FR-01** The system shall authenticate an active User by email address and password.
- **FR-02** The system shall reject invalid credentials and inactive accounts using safe failure responses that do not reveal unnecessary account information.
- **FR-03** The system shall establish an authenticated server-side session after successful login and expose only safe current-user data to the client.
- **FR-04** A User marked `mustChangePassword` shall be restricted to the password-change flow until a valid new password is saved.
- **FR-05** The system shall allow an authenticated User to change an initial password using the current authenticated session and password confirmation rules.
- **FR-06** The system shall allow logout and shall invalidate the current session so protected screens/APIs are no longer accessible with that session.
- **FR-07** The application shell shall show the authenticated User name and role and only navigation permitted for that role.
- **FR-08** Every protected backend operation shall enforce authentication, role authorization, and ownership where applicable independently of the frontend.

### Requester Regression and Communication
- **FR-09** An authenticated Requester shall create Tickets using their authenticated User identity; the client shall not choose Ticket ownership.
- **FR-10** An authenticated Requester shall list, search, filter, sort, paginate, and open only their own Tickets using the Lab 2 behavior.
- **FR-11** An authenticated Requester shall upload, list, download, and soft-remove permitted Attachments only on their own Tickets, preserving Lab 2 rules.
- **FR-12** The Development Requester Selection screen, Requester local-storage context, and Change Requester action shall be removed.
- **FR-13** An authenticated Requester shall retrieve and post Public Comments on their own Ticket.
- **FR-14** An authenticated Requester shall be able to indicate that the reported problem appears resolved without directly setting the Ticket status to `RESOLVED` or `CLOSED`.
- **FR-15** A Requester shall never retrieve or create Internal Notes.

### IT Staff Queue and Ticket Operations
- **FR-16** An authenticated IT Staff User shall access a shared Ticket Queue containing Tickets across Requesters.
- **FR-17** The Ticket Queue shall support search, documented filters, sorting, pagination, ownership/status/priority information, and open-detail navigation.
- **FR-18** IT Staff shall open operational Ticket Detail for any Ticket permitted by role.
- **FR-19** IT Staff shall claim an unassigned Ticket, assign it, or reassign it to an active permitted Ticket Owner.
- **FR-20** IT Staff shall update IT Priority independently from the Requester's immutable Requested Priority.
- **FR-21** IT Staff shall update Ticket status only through the approved transition matrix.
- **FR-22** IT Staff shall retrieve and post Public Comments.
- **FR-23** IT Staff shall retrieve and create Internal Notes that are not exposed to Requesters.

### Administrator User Management
- **FR-24** An authenticated Administrator shall view a User list showing Name, Email, Role, Status, and Edit action.
- **FR-25** Administrator User Management shall support search by name or email and an optional single role filter.
- **FR-26** An Administrator shall create a User with name, unique email, one permitted role, activation state, and an initial password.
- **FR-27** An Administrator shall edit a User's name, email, one role, and activation state subject to Administrator safety rules.
- **FR-28** An Administrator shall set a new initial password for a User; the target User must change it at next login.
- **FR-29** The system shall prevent duplicate email addresses and invalid role values.
- **FR-30** The system shall prevent an Administrator from deactivating their own account and shall prevent deactivation/role change that would leave no active Administrator.
- **FR-31** Users shall be deactivated rather than deleted.

## 5. Business Rules

### Authentication and Passwords
- **BR-01** Only an active User with valid credentials may authenticate.
- **BR-02** Email comparison is case-insensitive after trimming; stored email values are normalized to lowercase and remain unique.
- **BR-03** Invalid credentials and inactive-account login attempts return the same public error code/message (`INVALID_CREDENTIALS`) to avoid account enumeration; tests may verify the inactive account remains unable to authenticate.
- **BR-04** Passwords are never stored or logged in plaintext. Passwords are hashed with bcrypt using a work factor appropriate for the course environment (target cost 12).
- **BR-05** Initial and replacement passwords must be 10–72 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one non-alphanumeric character. Leading/trailing spaces are treated as password characters, not silently trimmed.
- **BR-06** Login failures do not reveal whether the email exists, whether the password is wrong, or whether the account is inactive.
- **BR-07** A User with `mustChangePassword = true` may authenticate but may access only current-user, password-change, and logout operations until the password is changed.
- **BR-08** A successful mandatory password change stores a new hash, sets `mustChangePassword = false`, and keeps the current session authenticated.
- **BR-09** A new initial password set by an Administrator stores only its hash, sets `mustChangePassword = true`, and invalidates all existing sessions for the target User.
- **BR-10** Logout invalidates the current session server-side and clears the authentication cookie.
- **BR-11** Authentication uses an opaque random session token in an `HttpOnly` cookie. Only a SHA-256 hash of the token is stored server-side. The cookie uses `SameSite=Lax`, `Path=/`, and `Secure` in production; session lifetime is 8 hours from creation.
- **BR-12** State-changing authenticated requests using the cookie must pass same-origin checks in addition to `SameSite=Lax`; CORS is restricted to the configured client origin with credentials enabled.
- **BR-13** Expired, invalidated, or unknown sessions are treated as unauthenticated and return `401 UNAUTHENTICATED`.

### Identity, Roles, and Ownership
- **BR-14** Each User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **BR-15** The authenticated User identity, never a client-supplied `requesterId`, determines Requester Ticket and Attachment ownership.
- **BR-16** Requester-scoped APIs must not expose another Requester's protected Ticket/Attachment existence; an inaccessible or missing owned resource returns the same `404 NOT_FOUND` response.
- **BR-17** Frontend navigation/actions reflect permissions, but backend authorization is authoritative.
- **BR-18** Requesters may create/list/view/manage only their own Tickets and permitted Attachments, post Public Comments on their own Tickets, and indicate apparent resolution.
- **BR-19** IT Staff may access the shared queue and Ticket operations, including ownership, IT Priority, permitted status transitions, Public Comments, and Internal Notes.
- **BR-20** Administrators primarily manage Users. Because the handout explicitly permits Administrator visibility of comments/notes and permits Administrator Ticket ownership/IT Priority, the Lab 3 authorization matrix also permits Administrators to read operational Ticket Detail and perform the same ownership, IT Priority, status, Public Comment, and Internal Note operations as IT Staff; the default Administrator navigation remains focused on User Management.

### Ticket Ownership and Priority
- **BR-21** A Ticket has zero or one primary owner (`ownerId`). An unassigned Ticket has `ownerId = null`.
- **BR-22** A Ticket Owner must be an active `IT_STAFF` or `ADMINISTRATOR` User.
- **BR-23** Claim assigns the current authenticated IT Staff/Administrator as owner only when the Ticket is currently unassigned; otherwise it returns `409 TICKET_ALREADY_ASSIGNED`.
- **BR-24** Assign/reassign rejects inactive Users and Requester-role Users as owners.
- **BR-25** Requested Priority is set by the Requester at creation and is not editable in Lab 3.
- **BR-26** IT Priority initially copies Requested Priority for newly created and migrated Tickets and may later be changed only by IT Staff or Administrator.
- **BR-27** IT Priority is one of `LOW`, `MEDIUM`, or `HIGH`.

### Ticket Status Workflow
- **BR-28** Required statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-29** Only IT Staff or Administrator may directly update Ticket status in Lab 3.
- **BR-30** Permitted transitions are:

| From | Permitted To |
|---|---|
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `CLOSED` | `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `CANCELLED` | no transition in Lab 3 |

- **BR-31** Status update to the same current value is rejected as `409 INVALID_STATUS_TRANSITION` rather than creating a fake workflow event.
- **BR-32** Changing to `RESOLVED`, `CLOSED`, or `CANCELLED` requires an explicit UI confirmation; the backend still validates the transition if called directly.
- **BR-33** Lab 3 has no Actions Taken completion gate; that later resolution rule is deferred to Lab 4.
- **BR-34** `Problem Appears Resolved` is a separate Requester indication stored as `requesterResolvedAt`/`requesterResolvedById`; it does not change `status`. Repeating the action while already indicated is idempotent.
- **BR-35** A new Public Comment by the Requester after an apparent-resolution indication clears that indication because the Requester has resumed the conversation.

### Public Comments and Internal Notes
- **BR-36** Public Comments are visible to the owning Requester, IT Staff, and Administrator.
- **BR-37** Internal Notes are visible only to IT Staff and Administrator and must never be serialized by Requester endpoints.
- **BR-38** Public Comments and Internal Notes are append-only in Lab 3; edit and delete are excluded.
- **BR-39** Comment/Note author identity and `createdAt` are assigned by the backend from the authenticated User and server time.
- **BR-40** Public Comment and Internal Note content is trimmed, must contain 1–2000 characters after trimming, and whitespace-only content is rejected.
- **BR-41** Comment/Note content is rendered as plain text; the client does not render user-supplied HTML.

### Administrator Safety
- **BR-42** User email must be unique case-insensitively; duplicate creation/update returns `409 EMAIL_ALREADY_EXISTS`.
- **BR-43** Only the three Lab 3 roles are accepted; multiple roles are rejected.
- **BR-44** An Administrator cannot deactivate their own currently authenticated account.
- **BR-45** A change that deactivates or changes the role of the last active Administrator is rejected with `409 LAST_ACTIVE_ADMIN_REQUIRED`.
- **BR-46** User deletion is not implemented; historical ownership/authorship remains intact through deactivation.
- **BR-47** Deactivated Users cannot create new sessions. Existing sessions are invalidated when an Administrator deactivates that User.
- **BR-48** Changing a User's role does not rewrite historical Ticket requester, owner, comment, or note authorship. A Requester with existing submitted Tickets cannot be changed to another role in Lab 3 unless doing so would not orphan Requester access; for this sprint the API rejects such a role change with `409 USER_HAS_REQUESTER_TICKETS`.

### Queue, Validation, and Regression
- **BR-49** IT Staff Queue search matches Ticket Number, Summary, and Requester name/email case-insensitively.
- **BR-50** Queue filters support Category, Requested Priority, IT Priority, Status, and Owner (`unassigned`, `me`, or a specific permitted owner ID); filters combine with AND.
- **BR-51** Queue sortable fields are Ticket Number, Created Date, Last Updated, Requested Priority, IT Priority, and Status. Default order is Last Updated descending.
- **BR-52** Queue page defaults to 1 and page size 10; allowed page sizes are 10, 20, and 50. Invalid query parameters return `400 INVALID_QUERY` rather than silently changing staff work views.
- **BR-53** Lab 2 attachment type, size, active-count, soft-removal, download, and safe-ownership rules remain unchanged unless explicitly superseded here.
- **BR-54** Existing Lab 2 Ticket Numbers, Categories, Related Systems, Ticket content, and Attachment metadata/files remain valid after migration.
- **BR-55** Meaningful processing, validation, success, empty/no-results, forbidden, not-found, conflict, and safe unexpected-failure states must be represented consistently in API/UI behavior.

## 6. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|
| Login/logout/current user/change required password | ✓ | ✓ | ✓ |
| Create Ticket | own identity | — | — |
| My Tickets / Requester Ticket Detail | own only | — | — |
| Requester Attachment operations | own only | — | — |
| Public Comments | own Tickets | any Ticket | any Ticket |
| Problem Appears Resolved | own Tickets | — | — |
| Shared Ticket Queue | — | ✓ | optional direct API; no default nav |
| Operational Ticket Detail | — | ✓ | ✓ |
| Claim/assign/reassign owner | — | ✓ | ✓ |
| Change IT Priority/status | — | ✓ | ✓ |
| Internal Notes | — | ✓ | ✓ |
| User Management | — | — | ✓ |

Unauthenticated access to protected APIs returns `401`. Authenticated but disallowed role operations return `403`. Requester ownership failures use safe `404` where resource existence would otherwise leak.

## 7. UI Specification Summary
See `docs/lab-03/ui-spec.md` for the complete screen contract.

- Reuse the Lab 2 Zen Green tokens/components and responsive/accessibility rules.
- Login and Change Password are unauthenticated/limited-auth screens with field validation, busy state, safe failure, and password visibility controls.
- Authenticated shell replaces Development Requester UI with current User name + role, Logout, and role-specific navigation.
- Requester screens retain Lab 2 behavior but use authenticated identity and add Public Comments + Problem Appears Resolved on Ticket Detail.
- IT Staff Queue uses a readable desktop table and compact mobile cards rather than a mega-grid.
- IT Staff Ticket Detail clearly separates read-only request data, operational controls, Public Comments, Internal Notes, and Attachments. Public and private composer styling must be visibly different.
- Administrator User Management remains one intentionally simple list + create/edit panel/modal flow.
- Status, Requested Priority, IT Priority, role, and account state use consistent text-labelled badges and never rely on color alone.

## 8. Data Changes and Migration

### New/Changed Models
- Replace `DevelopmentRequester` with **User**: `id`, `name`, normalized unique `email`, `passwordHash`, `role`, `isActive`, `mustChangePassword`, `createdAt`, `updatedAt`.
- Add **Session**: `id`, `userId`, unique `tokenHash`, `expiresAt`, `createdAt`, `invalidatedAt`; index `userId`, `expiresAt`.
- Change **Ticket.requesterId** FK from `DevelopmentRequester` to `User` while preserving existing numeric requester IDs during migration.
- Add `Ticket.ownerId User?`, indexed.
- Preserve `Ticket.requestedPriority`; migrate/set `itPriority = requestedPriority` for existing Tickets where needed.
- Expand `TicketStatus` with `WAITING_FOR_REQUESTER` and `REOPENED` while preserving existing values.
- Add `Ticket.requesterResolvedAt DateTime?` and `requesterResolvedById Int?`.
- Add **PublicComment**: `id`, `ticketId`, `authorId`, `content`, `createdAt`; indexes on `ticketId`, `createdAt`.
- Add **InternalNote**: `id`, `ticketId`, `authorId`, `content`, `createdAt`; indexes on `ticketId`, `createdAt`.
- Existing `Category`, `RelatedSystem`, `Attachment`, Ticket Numbers, and uploaded files remain unchanged.

### Migration Strategy
1. Create the new role/session/comment/note structures and Ticket workflow columns without deleting existing data.
2. Rename/evolve the `DevelopmentRequester` table/model into `User` (or copy rows preserving IDs if Prisma migration requires it). Every existing Development Requester becomes role `REQUESTER` with its original `id`, `name`, `email`, and `isActive` value.
3. Assign each migrated Requester a documented local-development initial password hash and `mustChangePassword = true`; no plaintext real passwords are committed.
4. Preserve every existing `Ticket.requesterId`, so ownership remains attached to the same numeric User ID.
5. Backfill existing Ticket `itPriority` from `requestedPriority` to satisfy the Lab 3 rule.
6. Add/seed IT Staff and Administrator Users, realistic owner assignments/statuses, Public Comments, and Internal Notes.
7. Remove Development Requester API/UI/localStorage state only after authenticated Requester regression tests pass against migrated data.
8. Migration verification records before/after counts for Requester Users, Tickets, Attachments, and ownership joins and confirms no orphaned Ticket/Attachment rows.

### Seed Requirements
Idempotent seed data shall provide at least four active Requesters + one inactive Requester, three active IT Staff + one inactive IT Staff, at least one active Administrator, realistic Tickets across statuses/priorities/owners, and safe example Comments/Notes. Local seed credentials are documented in development-only documentation or environment-safe seed constants and must not be real personal passwords/secrets.

## 9. API Contract
See `docs/lab-03/api-spec.md` for exact paths and shapes. Major groups:
- `/api/auth/*` — login, logout, current user, required password change.
- `/api/tickets*` — authenticated Requester continuation and IT Staff queue/detail operations.
- `/api/tickets/:id/owner`, `/it-priority`, `/status` — operational updates.
- `/api/tickets/:id/comments` — Public Comments.
- `/api/tickets/:id/internal-notes` — restricted Internal Notes.
- `/api/admin/users*` — minimalist Administrator user management and initial-password reset.

## 10. Acceptance Criteria
- **AC-01** Given an active User with valid credentials, when login succeeds, then the backend creates authenticated access and returns only safe User identity/role data.
- **AC-02** Given invalid credentials or an inactive account, when login is attempted, then authentication fails with safe non-enumerating feedback and no session is created.
- **AC-03** Given a User with `mustChangePassword = true`, when login succeeds, then normal application routes/APIs remain unavailable until a valid new password is saved.
- **AC-04** Given a required-password-change User, when a valid new password and confirmation are submitted, then the password hash changes, `mustChangePassword` clears, and normal role navigation becomes available.
- **AC-05** Given an authenticated User, when logout succeeds, then the current session is invalidated and subsequent protected access returns unauthenticated.
- **AC-06** Given any authenticated role, when the application shell loads, then only navigation permitted to that role is presented and direct forbidden API access is still rejected by the backend.
- **AC-07** Given an authenticated Requester, when Create Ticket is submitted with any client-supplied requester identity, then the saved Ticket uses the authenticated User ID.
- **AC-08** Given an authenticated Requester, when another Requester's Ticket/Attachment ID is requested, then the backend returns the same safe not-found behavior as a missing resource and leaks no protected data.
- **AC-09** Given migrated Lab 2 data, when the corresponding Requester logs in, then their existing Tickets and Attachments remain accessible with unchanged Ticket Numbers and ownership.
- **AC-10** Given an authenticated Requester, when My Tickets is used, then Lab 2 search/filter/sort/pagination behavior continues for only that Requester's Tickets.
- **AC-11** Given an owned Ticket, when a Requester posts valid Public Comment text, then it is appended with backend author/time and is visible to permitted roles.
- **AC-12** Given a Requester, when Internal Notes APIs are requested, then the operation is forbidden and no note content is returned.
- **AC-13** Given an owned Ticket, when the Requester chooses Problem Appears Resolved, then an indication is recorded without changing Ticket status to Resolved or Closed.
- **AC-14** Given authenticated IT Staff, when the Ticket Queue loads, then shared realistic Tickets are returned with documented pagination, default ordering, owner/status/priority information, and no Requester ownership restriction.
- **AC-15** Given queue search/filter/sort parameters, when they are valid, then results follow the documented query rules; invalid parameters return a safe validation response.
- **AC-16** Given an unassigned Ticket, when IT Staff claims it, then the current User becomes owner; claiming an already assigned Ticket returns conflict.
- **AC-17** Given assignment/reassignment, when the target User is inactive or not IT Staff/Administrator, then the backend rejects the update.
- **AC-18** Given a Ticket, when IT Staff changes IT Priority, then Requested Priority remains unchanged and the new IT Priority is persisted.
- **AC-19** Given a Ticket status, when IT Staff/Administrator requests a permitted transition, then it succeeds; a transition outside the matrix is rejected without changing the Ticket.
- **AC-20** Given a Requester, when a direct status-update request attempts `RESOLVED` or `CLOSED`, then the backend rejects it.
- **AC-21** Given IT Staff/Administrator, when Public Comments and Internal Notes are posted, then each is append-only with backend author/time and appears only to its permitted audience.
- **AC-22** Given Public Comment/Internal Note whitespace-only or over-limit content, when submitted, then validation rejects it and no entry is created.
- **AC-23** Given an Administrator, when User Management loads/searches/filters, then permitted User data is returned without password hashes or session secrets.
- **AC-24** Given valid new User data with one role and an initial password, when Administrator creates the User, then the account is stored with a password hash and must change password at first login.
- **AC-25** Given a duplicate email or invalid role/input, when Administrator creates/updates a User, then the operation is rejected with safe validation/conflict feedback.
- **AC-26** Given an Administrator editing their own active account, when they attempt self-deactivation, then the operation is rejected.
- **AC-27** Given only one active Administrator remains, when an operation would deactivate it or change its role, then the operation is rejected and at least one active Administrator remains.
- **AC-28** Given an Administrator sets a new initial password for a User, when that User next authenticates, then all old sessions are invalid and mandatory password change is required.
- **AC-29** Given a non-Administrator, when an Administrator API/screen is accessed directly, then the operation is forbidden and no management data is exposed.
- **AC-30** Given major Lab 3 screens at desktop, tablet, and mobile widths, when rendered, then required controls/content remain usable without clipping, overlap, or unintended horizontal page overflow and focus/labels remain accessible.
- **AC-31** Given server/API/network failures on major screens, when they occur, then safe failure feedback is shown without exposing stack traces, password hashes, session tokens, or protected cross-user data.
- **AC-32** Given the completed Lab 3 increment, when all Lab 1/Lab 2 regression tests and Lab 3 planned tests run from final `main`, then required automated suites pass and the evidence is recorded in `tests.md`.

## 11. Product Definition of Done
The coding agent may report Lab 3 product completion only when all items below are true:
- [ ] `docs/lab-03/specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` were approved before main implementation work and remain internally consistent.
- [ ] Every FR/BR/AC in approved scope is implemented or explicitly documented as excluded; every AC maps to at least one planned test.
- [ ] Database migration preserves existing Lab 2 Tickets, Ticket Numbers, requester ownership, Categories, Related Systems, Attachments, and uploaded-file continuity.
- [ ] Development Requester selector/context/API scaffolding is removed from normal application behavior.
- [ ] Passwords are hashed; opaque server-side sessions, expiry, logout invalidation, cookie flags, same-origin protection, and safe auth errors match the contract.
- [ ] Backend authorization is tested directly for all three roles; hidden UI controls are not treated as authorization.
- [ ] Mandatory first-login password change blocks normal application access until completion.
- [ ] Authenticated Requester Lab 2 flows and attachment ownership regression pass.
- [ ] Public Comments, Requester apparent-resolution indication, IT Staff Queue, ownership, IT Priority, status workflow, and Internal Notes satisfy the approved rules.
- [ ] Administrator User Management satisfies one-role assignment, duplicate-email validation, activation/deactivation, initial-password reset, self-deactivation protection, last-active-admin protection, and non-Admin forbidden behavior.
- [ ] Required loading/saving/success/validation/empty/no-results/forbidden/not-found/conflict/safe-failure states are implemented where meaningful.
- [ ] Desktop/tablet/mobile visual inspection confirms Zen Green consistency, readable badges, editable/read-only distinction, focus visibility, no clipping/overlap, and no unintended horizontal overflow.
- [ ] Unit, API/integration, UI component, authorization/security, migration/regression, and E2E suites pass from final `main`; final paths/statuses are recorded in `tests.md`.
- [ ] Required Lab 3 screenshot artifacts exist under `artifacts/lab-03/screenshots/` and are readable.
- [ ] GitHub Issues/branches/PRs follow the Lab 3 staging flow, peer review evidence is complete in `reviewer.md`, and all Sprint Issues are Done before `lab3-staging -> main` release integration.
- [ ] `ai-use.md`, README, `.gitignore`, repository structure, and final submission evidence are complete and contain no real credentials/secrets.

## 12. Assumptions and Decisions
- **AD-01 Session choice:** use opaque server-side sessions rather than browser-stored JWTs so logout/reset/deactivation can invalidate access immediately and no auth secret is readable by client JavaScript.
- **AD-02 Password hashing:** bcrypt is selected for this Node/Express course stack; implementation must add the required dependency and never expose hashes.
- **AD-03 Administrator ticket permissions:** the handout says Administrator and IT Staff should remain conceptually separate, but also explicitly makes Administrators eligible Ticket Owners and permits them to change IT Priority and view Internal Notes. This contract therefore grants Administrator operational Ticket API permission while keeping default Admin navigation centered on User Management.
- **AD-04 Apparent resolution:** Requester indication is stored separately from formal Ticket status because the handout explicitly reserves formal Resolved/Closed transitions for staff.
- **AD-05 Existing Requester IDs:** migration preserves existing IDs so Lab 2 Ticket foreign keys can remain correct without rewriting ownership.
- **AD-06 Role change safety:** changing a Requester who already owns submitted Tickets to another role is rejected in Lab 3 to preserve the simple one-role model and avoid silently removing access to historical Requester Tickets.
- **AD-07 Queue invalid query behavior:** staff queue rejects invalid query values instead of silently falling back, because operational filtering should not unexpectedly show a broader/different work set.
