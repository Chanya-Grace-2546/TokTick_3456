# Lab 2 UI Specification — Zen Green Theme (TokTickIT)

## 1. Color Tokens
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tabs, focus rings, links, hover states |
| `--color-pale-green` | `#EAF6EF` | Selected/success/subtle section emphasis |
| `--color-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels (subtle border + restrained shadow) |
| `--color-text` | dark charcoal-green (e.g. `#1C2B24`) | Body text — never pure black |
| `--color-field-editable-bg` | `#FFFFFF` | Editable field background, neutral border |
| `--color-field-readonly-bg` | soft gray-green / warm ivory | Read-only field, clearly distinct but readable |
| `--color-error` | dark red | Error text/border, message below field |
| `--color-warning` | amber | Warning callouts/badges only, never decorative |
| `--color-success` | green | Success confirmation, paired with text/icon, not color alone |

## 2. Typography & Spacing
- Base font: system sans-serif stack, 16px body, 1.5 line-height.
- Headings step down from the app title; section headers use `--color-primary`.
- Spacing scale: 4/8/12/16/24/32px; form fields use 16px vertical rhythm.

## 3. Field States
| State | Treatment |
|---|---|
| Editable | White bg, neutral border, `--color-secondary` focus ring |
| Read-only | `--color-field-readonly-bg`, no focus ring, cursor default |
| Invalid | `--color-error` border + text, message directly below field |
| Disabled | Reduced opacity, no pointer events, no focus ring |
| Focused | Visible outline at all times for keyboard users |

## 4. Required-Field Marker & Validation
- Required fields show a red asterisk next to the label.
- The asterisk never substitutes for a validation message — every invalid field also shows inline text below it.
- Validation appears per-field, not only as a single banner at the top of the form.

## 5. Button Hierarchy
| Type | Style |
|---|---|
| Primary | Solid `--color-primary`, white text (e.g. Submit, Continue, Create Ticket) |
| Secondary | Outlined `--color-secondary`, e.g. Cancel, Clear Filters |
| Tertiary | Text-only link style, e.g. Change Requester |
| Destructive | Dark red outline/solid, e.g. Remove Attachment |
| Disabled | Reduced opacity, no hover/focus effect |
| Busy | Spinner + disabled state while a request is in flight |

## 6. Attachment Selection & Errors
- File picker shows allowed types (JPG/JPEG/PNG/WEBP/PDF) and 5 MB limit as helper text.
- Per-file validation errors (wrong type, too large, over 5-file cap) appear next to that file, not just globally.
- Successful uploads show file name + size; failed uploads show a retry action.

## 7. Screen States
Each screen implements: Initial, Loading, Validation (where applicable), Submitting/Busy, Success, and Failure states, with distinct treatment for Empty (no data ever) vs. No-Results (filters matched nothing).

## 8. Responsive Layout Rules
| Viewport | Behavior |
|---|---|
| Desktop ≥992px | Multi-column layout, content centered, sensible max-width |
| Tablet 768–991px | Two-column where practical; Summary/Description get adequate width |
| Mobile <768px | Fields stack vertically; buttons touch-friendly; no horizontal scroll |
| All sizes | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

## 9. Accessibility
- All form controls keyboard-navigable in logical order.
- Every icon-only control has an accessible label + tooltip.
- Focus indicators always visible.
- No information conveyed by color alone (badges pair color with text/icon).

## 10. Application Shell & Navigation
- Header: TokTickIT title/logo, My Tickets nav, Create Ticket nav, active-Requester display, Profile/Change-Requester menu.
- Active page is visually indicated (underline/background on nav item).
- Mobile: nav collapses into a responsive menu; header remains sticky.

## 11. Development Requester Selection Screen
- Elements: title, short "testing only" explanation, Requester dropdown (active only), Continue button, loading state, empty state (no active Requesters), API-failure state, keyboard-accessible controls.
- After selection: shell shows Requester name, "Change Requester" action available, requester-scoped data reloads.

## 12. Create Ticket Screen
- Layout: system-generated/read-only fields (Ticket Number, Ticket Date) grouped near the top and visually distinct; classification fields (Category, Related System, Requested Priority) grouped together; Summary and Description given full width; Attachments below; primary (Submit) and secondary (Cancel) actions at the bottom.
- Submit shows busy state while processing; success state displays the generated Ticket Number and a "View Ticket" / "Back to My Tickets" action.

## 13. My Tickets Screen
- Elements: search box (ticket number/summary), filters (Category, Requested Priority, IT Priority, Current Status), sortable columns (Ticket No., Created Date, Last Updated), pagination, Create Ticket action, Clear Filters action.
- Desktop: table layout. Mobile: card layout, same fields, stacked.
- States: loading, empty (zero tickets ever), no-results (filters matched nothing), failure.

## 14. Requester Ticket Detail Screen
- Read-only ticket information grouped separately from the Attachments panel.
- Attachment list shows file name, size, upload date, and status (active/removed); active attachments offer download and remove actions; removed attachments show a "Removed" badge and no download/preview action.
- No Public Comments, Internal Notes, Actions Taken, or status-change controls (out of scope for Lab 2).

## 15. Badge Rules
- Requested Priority / IT Priority: consistent color-coded badge (e.g. Low=pale green, Medium=amber, High=dark red-toned) with visible text label.
- Current Status: consistent badge style (e.g. New=secondary green) with visible text label.
- Badges never rely on color alone — text label is always present.

## 16. Visual Inspection Checklist & Screenshot Paths
- [ ] Desktop/tablet/mobile screenshots for Create Ticket → `artifacts/lab-02/screenshots/create-ticket/`
- [ ] Desktop/tablet/mobile screenshots for My Tickets → `artifacts/lab-02/screenshots/my-tickets/`
- [ ] Desktop/tablet/mobile screenshots for Ticket Detail → `artifacts/lab-02/screenshots/ticket-detail/`
- [ ] Compared against this spec and the handout's reference illustrations (not memory)
- [ ] No clipping, overlap, unintended horizontal scroll, or inconsistent field styling at any breakpoint
