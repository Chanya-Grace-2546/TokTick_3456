# Lab 3 UI Specification — TokTickIT Zen Green

Lab 3 extends the existing Lab 2 Zen Green design; it does not introduce a second visual system. Existing colors, typography, spacing, forms, cards, badges, button hierarchy, inline validation, responsive breakpoints, and accessibility expectations remain the baseline.

## 1. Shared Application Shell

### Auth states
- **Signed out:** TokTickIT brand only; Login content; no Ticket/Admin navigation.
- **Password change required:** TokTickIT brand + minimal current-user identity + Logout; normal navigation hidden/blocked.
- **Authenticated:** current User name + role badge + role-specific navigation + profile/password action if implemented + Logout.

### Role navigation
- Requester: `My Tickets`, `Create Ticket`.
- IT Staff: `Ticket Queue`.
- Administrator: `Admin / Users` by default. Operational Ticket access may be reached only where intentionally linked/authorized; do not present Requester destinations.

Mobile navigation collapses into a menu while preserving the same role rules. Logging out returns to Login and protected direct URLs redirect to Login after the backend/session check.

## 2. Login Screen

### Structure
Centered Zen Green authentication card with TokTickIT heading, Email, Password, show/hide password control, Sign In button.

### Modes/feedback
- Initial.
- Client validation: required email/password; valid email format.
- Submitting: button disabled + `Signing in…`; inputs protected from duplicate submit.
- Safe auth failure: one general message for invalid/unknown/inactive credentials.
- API/network failure: safe retry message distinct from credential failure.
- Success: route to Change Password if required; otherwise route by role.

No “Forgot password?” workflow is implemented because password-reset email/account recovery is excluded.

## 3. Mandatory Change Password Screen

Fields: New Password, Confirm New Password, show/hide controls, concise password-rule checklist, Continue button, Logout.

Feedback: live/submit validation for required fields, rule failures, mismatch; busy state; safe API failure; success routes into role home. Normal app nav is not shown while change is required.

## 4. Requester Screens — Lab 2 Regression

### Removed UI
- Delete Development Requester Selection screen from normal routing.
- Delete `Change Requester` action.
- Delete localStorage Development Requester identity display.

### Create Ticket
Keep Lab 2 form structure/validation/attachment behavior. Requester is displayed as authenticated read-only identity if useful, but no requester selector or requesterId field is editable/submitted.

### My Tickets
Keep Lab 2 search/filter/sort/pagination and responsive table→card behavior. Data is automatically scoped to the authenticated Requester.

### Requester Ticket Detail additions
Preserve read-only Ticket fields and Attachment section. Add:
1. **Public Comments** section with chronological entries, author/role/time, plain-text content, composer, character guidance, validation, posting busy/failure states.
2. **Problem Appears Resolved** action. Use a secondary/success-style action with confirmation text explaining that this notifies IT but does not formally close the Ticket. After success, show a visible `Requester says problem appears resolved` indication with timestamp.

Requester never sees Internal Notes controls/content or staff operational edit controls.

## 5. IT Staff Ticket Queue

### Desktop layout
Header: `Ticket Queue`, optional simple result count, search input, Filters button/area.

Recommended readable columns (avoid mega-grid):
- Ticket Number
- Updated
- Summary
- Requested / IT Priority (compact paired badges)
- Status
- Owner
- Open action

Category is available as a filter and may appear as secondary text under Summary instead of a dedicated wide column. Requester name may appear as secondary text under Ticket Number/Summary. This keeps the table readable while still exposing the handout's operational information.

### Controls
- Search: Ticket Number, Summary, Requester name/email.
- Filters: Category, Requested Priority, IT Priority, Status, Owner.
- Sort: Updated (default), Created, Ticket Number, Requested Priority, IT Priority, Status.
- Page size: 10/20/50; pagination with Previous/Next + page indicator.

### States
Loading skeleton/spinner; populated; empty queue; no-results after search/filter; invalid query feedback; forbidden; safe API failure with Retry.

### Tablet/mobile
At smaller widths convert rows to cards. Each card shows Ticket Number + Status first, Summary, priorities, owner, updated time, then Open. Filters become a stacked/collapsible panel. No horizontal page overflow.

## 6. IT Staff Ticket Detail

### Information architecture
1. Breadcrumb/back to Queue + Ticket Number + Status badge.
2. **Request Details (read-only):** Requester, Category, Related System, Requested Priority, Summary, Description, Created/Updated.
3. **IT Operations (editable):** Owner, IT Priority, Status. Requested Priority remains visibly read-only.
4. **Communication tabs/sections:** Public Comments and Internal Notes are visually distinct.
5. **Attachments:** preserve Lab 2 metadata/download behavior; staff can view existing permitted attachments. Requester-only removal semantics are not expanded unless API contract explicitly adds staff attachment management.

### Ownership controls
- Unassigned: prominent `Claim Ticket` + owner selector for assign.
- Assigned: owner selector + `Reassign`/Save behavior.
- Reject/feedback for stale claim conflict and invalid/inactive owner.

### IT Priority/status
Editable select controls with Save/busy/success/error feedback. Status options presented by UI should be only currently permitted transitions. `Resolved`, `Closed`, and `Cancelled` require confirmation. Backend remains authoritative.

### Public Comments vs Internal Notes
Public Comments: green/neutral communication treatment and explicit label `Visible to Requester`.
Internal Notes: distinct muted/amber private panel and explicit label `Internal — not visible to Requester` near both list and composer. Never place the two Post buttons adjacent without labels that identify audience.

### Requester resolution indication
If present, show a clear non-status banner such as `Requester reports the problem appears resolved` with timestamp. Do not replace the formal Status badge.

## 7. Administrator User Management

One intentionally simple screen, consistent with handout page 12 example.

### List area
Heading `Users`, `+ Create User`, search by name/email, optional Role filter. Columns/cards: Name, Email, Role badge, Status badge, Edit.

No required pagination, multi-column sorting, bulk actions, import/export, delete, role history, departments, or multi-role UI.

### Create/Edit panel
Use a right-side panel on desktop or full-width modal/page on mobile.

Create fields:
- Name
- Email
- Role (exactly one)
- Active toggle
- Initial Password + confirmation/show-hide
- Save User

Edit fields:
- Name
- Email
- Role
- Active toggle
- Save Changes
- Separate `Set New Initial Password` action/section

### Safety feedback
- Duplicate email: field/conflict feedback.
- Self-deactivation: clear blocked message; do not optimistically hide the account.
- Last active Administrator: conflict message explaining at least one active Administrator is required.
- Requester-with-tickets role-change conflict: explain that the role cannot be changed in this sprint because the account owns Requester Tickets.
- No Delete User action.

## 8. Badges and Read-only/Edit Styling

Reuse Lab 2 badge patterns. Every badge includes text.
- Priority: Low / Medium / High.
- Status: New / Open / In Progress / Waiting for Requester / Resolved / Closed / Reopened / Cancelled.
- Role: Requester / IT Staff / Administrator.
- Account: Active / Inactive.

Read-only values use the Lab 2 muted/read-only field treatment; editable operational fields use standard form controls. Requested Priority and Requester-submitted fields must not look editable on staff detail.

## 9. Validation and Safe Feedback

- Field validation appears next to/below the relevant control.
- Form-level safe errors appear in an alert region above the submit action/content.
- Busy controls disable repeat submission but keep context visible.
- Success feedback is visible but does not erase important entered/read data.
- `401`: route to Login after clearing client auth state.
- `403`: show role-safe Forbidden state; do not show protected data behind it.
- `404`: safe Not Found.
- `409`: preserve current form/detail and explain the conflict (stale owner, duplicate email, invalid transition, Admin safety rule).
- `500/network`: safe retry feedback; never display raw stack/database messages.

## 10. Responsive Rules

Use the same Lab 2 desktop/tablet/mobile evidence widths. Major screens must be captured at all three sizes.
- Desktop: multi-column queue and side-panel admin edit allowed.
- Tablet: controls wrap; queue may remain reduced table or cards if needed.
- Mobile: single-column forms/cards, full-width primary actions where appropriate, stacked filters, no page-level horizontal scrolling.
- Long email/Ticket Number/filename/comment content wraps or truncates with accessible full text where needed; it must not force layout overflow.

## 11. Accessibility

Same Lab 2 requirements plus:
- Semantic labels for every input/select and password visibility control.
- Keyboard access for menus, filters, pagination, tabs, dialogs/panels, and confirmation actions.
- Visible focus indicators.
- `aria-live`/alert semantics for meaningful login, validation, save, conflict, and failure feedback.
- Dialogs trap/focus appropriately if modal implementation is used; focus returns to triggering control on close.
- Public/Internal audience distinction uses text and structure, not color alone.
- Status/priority/role meaning uses text labels, not color alone.

## 12. Required Visual Evidence Checklist
For Login, Change Password, Requester Ticket Detail additions, Staff Queue, Staff Ticket Detail, and User Management capture desktop/tablet/mobile as applicable and verify:
- [ ] Zen Green tokens/components are consistent with Lab 2.
- [ ] Role navigation is correct; unauthorized destinations are absent.
- [ ] Current User name + role are visible after normal authentication.
- [ ] Requested Priority/read-only Requester fields are visually distinct from editable staff controls.
- [ ] Public Comments and Internal Notes are unmistakably different and labelled by audience.
- [ ] Status/priority/role/account badges contain readable text.
- [ ] Validation appears beside the relevant field and does not shift/clip critical controls.
- [ ] Busy/success/empty/no-results/forbidden/conflict/failure states are readable.
- [ ] Keyboard focus is visible on interactive controls.
- [ ] No clipping, overlap, inaccessible off-screen actions, or unintended horizontal page overflow.
