# TokTickIT — Lab 4 UI Specification

**Status:** Sprint 4 engineering contract — approved behavior. Extend the existing React app and Zen Green design system; reuse Lab 2–3 components/routes rather than duplicating them. The handout's illustrative dashboard and Ticket Detail images (pp. 5–7) establish structure, not exact pixel measurements.

## 1. Global Shell and Navigation
- Keep existing authenticated header/sidebar, user identity, logout, route guards and role-aware navigation.
- Requester landing route: `/dashboard` (replaces prior default redirect to `/tickets`, which remains accessible). Navigation: Dashboard, My Tickets, Create Ticket and existing account actions.
- IT Staff landing route: `/staff/dashboard` (replaces prior default redirect to `/staff/tickets`, which remains accessible). Navigation: Dashboard, Ticket Queue, assigned Tickets and existing account actions.
- Administrator: keep existing `/admin/users` landing route and add staff dashboard navigation.
- Highlight active route; preserve Zen Green tokens, status badges, typography, spacing, forms, tables and button styles.
- Never show forbidden edit controls to Requesters; enforce permissions again in API.

## 2. IT Staff Dashboard
**Route:** `/staff/dashboard`.

### Desktop layout
- Page heading `IT Staff Dashboard`, refresh state and last-updated timestamp.
- Top grid of metric cards: Unassigned Tickets, My Owned Tickets, Tickets with My Actions, and urgent HIGH-priority open Ticket count.
- Below: Tickets by Status, Tickets by IT Priority, and Recent Tickets (up to 5).
- Each actionable metric has descriptive label, numeric value and accessible link to matching Staff Queue filter; each recent row links to Ticket Detail.
- Admin can open this dashboard; user management remains a separate existing screen. Quick Actions link to existing permitted actions; staff Create Ticket is shown only if current Lab 3 permissions permit it. No mockup trend deltas (e.g., "from yesterday") are required.

### Behavior
- Loading: skeletons or accessible loading indicator, not fake zeros.
- Empty: `0` count, `No recent tickets` message, accessible links still available where meaningful.
- Forbidden: safe access-denied view; 401 routes to login per existing app behavior.
- API failure: concise retry message; no raw server detail.
- Accurate data: labels and counts match documented API calculations; refresh after navigation or explicit refresh.

## 3. Requester Dashboard
**Route:** `/dashboard`.
- Heading `My Dashboard`.
- Metric cards: Open Tickets and Waiting for Me; lists: Recently Updated and Recently Resolved.
- Cards link to My Tickets with filters; list items link to owned Ticket Detail.
- Show only data returned for authenticated Requester; do not accept requester ID in client URL/API.
- Avoid reproducing the full My Tickets table; show concise lists (max 5 each).
- Same loading, empty, retry, and forbidden patterns as staff dashboard.

## 4. Actions Taken on Ticket Detail
**Location:** existing IT Staff Ticket Detail screen; read-only section on Requester Ticket Detail. Maintain Ticket header, status/priority, attachments, Public Comments and Internal Notes as already implemented.

### 4.1 Actions list
Columns or stacked cards: Action Date/Time, Description, Result, Performed By, Assigned To (if approved), State, Follow-Up, Attachment Notes and Edit (staff only). Sort oldest action first, then ID; display timestamps in local time and preserve full datetime via accessible text/title. Use semantic table desktop and labeled cards mobile.

### 4.2 Create mode (Staff/Admin)
- `Add Action` button opens inline panel or accessible modal consistent with existing UI.
- Inputs: Action Date/Time (default current local time, converted to UTC), Description (required), Result (required when completing), Assigned To (active staff only), Follow-Up Required (checkbox), Follow-Up Note (conditionally required), Attachment Notes (optional), State (approved enum).
- Performed By is displayed as `You`/authenticated name and is read-only; never sent as authoritative user ID.
- Inline field errors, submit disabled during pending request, Cancel retains safe navigation, success updates Action list and Ticket summary.
- If follow-up toggles false, warn before clearing entered note or preserve draft until submit; submitted note should follow agreed rule.

### 4.3 View/edit mode
- View displays immutable actor, creation time, Ticket association, current version and status.
- Staff/Admin may edit approved fields; original performer, creation time and Ticket association remain read-only.
- State controls expose only allowed next states (Planned → In Progress/Completed/Cancelled; In Progress → Completed/Cancelled). Completed/Cancelled are permanently read-only; no edit, reactivation or delete control.
- Conflict 409: keep draft values, explain record changed, offer Reload; never silently overwrite newer server data.
- Forbidden/not found: no stale action data shown after failed authorization.

### 4.4 Requester mode
- Render all Actions Taken on their owned Ticket, including result, performer, follow-up and attachment notes, but no create/edit/assign/status buttons.
- Show every Action Taken field, including assignee, performer, result, follow-up and attachment notes. Internal Notes remain separate and staff-private.
- No Action section access for another Requester's Ticket.

## 5. Ticket Workflow and Resolution
- Display current Ticket status prominently using text plus badge (not color alone).
- Staff/Admin transition control shows only permitted next statuses from the matrix in `specification.md`.
- If `Resolved` blocked by incomplete Actions or outstanding follow-up, show actionable message and link to pending Actions; server still validates.
- On success, refresh Ticket status, timestamp, available transitions and dashboard data on next load.
- Requester `Problem Appears Resolved` stays advisory; show confirmation without changing Ticket status.
- State history is append-only and ordered consistently; show audit history where already supported/approved.

## 6. Feedback and Error-State Matrix
| Situation | UI behavior |
|---|---|
| Initial loading | Skeleton/progress with accessible status |
| No Actions | `No actions recorded yet`; staff Add Action button |
| No dashboard results | Zero cards, `No recent tickets` text |
| Validation 422 | Field-level messages next to invalid inputs; retain values |
| Success | Short confirmation; refresh authoritative data |
| Unauthenticated 401 | Existing login redirect/session-expired behavior |
| Forbidden 403 | Access denied, no unauthorized data |
| Not found 404 | Not-found view, link back to permitted list |
| Conflict 409 | Preserve draft; refresh-and-review instruction |
| Network/server failure | Generic message, retry, preserve recoverable draft |
| Duplicate submit | Disable pending action; prevent duplicate creation |

## 7. Responsive Design
| Viewport | Layout |
|---|---|
| Desktop ≥1024px | 3–4 metric cards/row; 2-column dashboard sections; Actions table |
| Tablet 768–1023px | 2 cards/row; stacked dashboard panels; scroll-contained table only if needed |
| Mobile <768px | 1 card/row; stacked Action cards; full-width form controls; no page-level horizontal overflow |

Breakpoints are proposed and should be aligned to existing project CSS. No clipped controls, overlapping modals, inaccessible off-screen buttons, or horizontal page scrolling. Test representative widths 1440, 768 and 375 px.

## 8. Accessibility and Visual Checklist
- [ ] All inputs have visible labels; required fields and errors announced semantically.
- [ ] Keyboard tab order is logical; buttons, links, dialogs and forms work without mouse.
- [ ] Focus indicator is visible; modal focus is trapped and restored on close.
- [ ] Status/priority uses readable text/icon, not color alone.
- [ ] Color contrast and typography follow existing WCAG 2.1 AA target.
- [ ] Responsive navigation and forms remain usable at 375 px.
- [ ] Dashboard count links have descriptive accessible names.
- [ ] Date/time and status changes have meaningful announcements.
- [ ] No console errors, dead buttons, placeholders or broken routes.
- [ ] Shared/private information is visually distinguished without relying on color alone.
- [ ] Screenshots captured for staff dashboard, requester dashboard and Actions Taken at desktop/tablet/mobile.

## 9. UI Components and Suggested Test Paths
| Component | Main responsibility | Planned test |
|---|---|---|
| `StaffDashboard` | Cards, charts/count groups, recent links, states | `client/tests/lab-04/StaffDashboard.test.tsx` |
| `RequesterDashboard` | Owned metrics, attention/recent links, states | `client/tests/lab-04/RequesterDashboard.test.tsx` |
| `ActionsTaken` | List, create/edit, role restrictions, form validation | `client/tests/lab-04/ActionsTaken.test.tsx` |
| `TicketWorkflow` | Allowed transitions, resolution feedback, stale conflict | `client/tests/lab-04/TicketWorkflow.test.tsx` |

Reuse existing component locations where appropriate; keep new Lab 4 tests under `client/tests/lab-04/`.

## 10. Acceptance Mapping
- Staff dashboard: AC-12, AC-16, AC-18.
- Requester dashboard: AC-13, AC-16.
- Actions Taken: AC-01–AC-07, AC-11, AC-16–AC-18.
- Ticket workflow: AC-08–AC-11, AC-16.
- Existing UI regression: AC-15.


## 11. Navigation, wire values and conflict handling
- API returns enum wire values such as `IN_PROGRESS` and `HIGH`; UI renders human labels such as “In Progress” and “High”. Ticket items use `summary` and `ticketNumber`, not a new `title` field.
- Requester dashboard open card links to `/tickets?statusGroup=open`; waiting card links to `/tickets?status=WAITING_FOR_REQUESTER`. Staff unassigned and owned cards use `owner=unassigned/me&statusGroup=open`; Tickets with My Actions uses `/staff/tickets?myAction=true` (count distinct Tickets); urgent uses `/staff/tickets?itPriority=HIGH&statusGroup=open`. New filters must be implemented on existing list routes before activating cards.
- Staff status PATCH may include optional `expectedStatus` from the loaded Ticket. A 409 `STALE_UPDATE` preserves form state and prompts refresh; old clients sending `{status}` still work.
- Requesters see all Action Taken fields for their owned Tickets. Internal Notes remain private.
- Existing Lab 3 pages and deep links remain accessible; dashboard navigation is additive except for Requester/Staff default landing redirects.

### Issue 5 — workflow and follow-up feedback

Staff Ticket Detail sends optional expectedStatus with status changes. A stale status update retains Action drafts and requires explicit reload/review before another status submission; no automatic retry occurs. Resolution-blocked feedback explains that all non-cancelled Actions must be completed and required follow-up satisfied. Successful status transitions refresh Actions without remounting their drafts.

Completed Actions with outstanding required follow-up offer Staff/Admin a compact Record Follow-Up Outcome form. A required nonblank outcome creates an audited history event; it does not edit the completed Action. Show the recorded outcome, actor and time to authorized readers, including the Ticket requester. No new text limit applies. Ambiguous failures retain the original outcome/version for retry. Requesters never receive this write control.

RESOLVED, CLOSED and CANCELLED Tickets show Actions as read-only; retain existing drafts disabled rather than discarding them. Saved ambiguous creation retries retain their original key/body for safe replay. Reopening restores write controls for nonterminal Actions. Completed and Cancelled Actions always remain immutable. Existing comments, Internal Notes, assignment, priority and attachment behavior is preserved.

### Issue 6 — approved navigation and drill-down alignment

IT Staff lands on /staff/dashboard. Staff/Admin have Dashboard navigation on desktop and mobile; Administrator retains /admin/users as its landing page. No Staff/Admin Create Ticket control is introduced. Requester navigation is unchanged until Issue 7.

Dashboard breakdowns cover all authorized Tickets; the recent list alone covers seven days. Dashboard dates explicitly display Asia/Bangkok. Metric/breakdown links initialize the existing Queue from URL filters; paging, sorting, filter changes and browser back/forward retain the URL state. Active dashboard filters are identified and can be cleared. Queue table/card presentation and legacy sort ties remain unchanged.

### Issue 7 — Requester Dashboard integration

/dashboard displays My Dashboard, Open Tickets and Waiting for Me cards, and separate Recently Updated/Recently Resolved sections. It reuses Issue 6's polished Zen Green card/row/focus styles with requester-only layout overrides, without redesigning Staff Dashboard. Timestamps explicitly display Asia/Bangkok; each list has its own empty message. There are no requester breakdown charts or privileged Action/Ticket mutation controls. Existing My Tickets and Create Ticket remain available.

Requester Dashboard navigation is available on desktop/mobile and is the requester landing route. Staff/Admin landings remain /staff/dashboard and /admin/users. My Tickets synchronizes dashboard filters, search, sort and pagination with URL/browser history and supports clearing filters, retry and existing auth redirects. Current Ticket table/mobile-card styling and creation/detail navigation are retained. Obsolete requests must not replace the currently displayed page; forbidden responses clear previously loaded records.
