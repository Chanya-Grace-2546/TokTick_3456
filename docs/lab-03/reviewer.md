# Lab 3 Reviewer Evidence

## Reviewer Identity

* **Name:** Chanya Tinnaphopworachot
* **Student ID:** 67070503456
* **GitHub:** [Chanya-Grace-2546](https://github.com/Chanya-Grace-2546)

## Peer Review Partners

* **I reviewed:** Phoo Phoo Thit (67070503455) — [GitHub](https://github.com/thit3455)
* **Reviewed my work:** Thin Myat Yati Htun (67070503485) — [GitHub](https://github.com/tm-georgia)

---

## Reviews Given

### Database Migration

* **PR:** [PR #42](https://github.com/thit3455/toktickit/pull/42)

* **Comment:** The migration currently creates the new `User` table, but the existing `RequesterUser` records are not migrated and the Ticket foreign key still points to `RequesterUser`. Should the migration also move the existing Requester records into `User` and update the Ticket relationship?

* **Response:** The first version only created the User foundation. The migration was updated to move Ticket ownership from `RequesterUser` to `User`, preserve the existing Ticket records, and remove the old `RequesterUser` dependency.

* **Changes:** The migration was updated in commits `cc31128` and `3b2531e`.

* **My Response:** The requester records are now migrated into `User`. The old-to-new ID mapping updates Ticket ownership, and the foreign key is changed before `RequesterUser` is removed. This addresses my concern.Thanks for fixing it!

* **Result:** Changes resolved and approved

### Authentication Flow

* **PR:** [PR #43](https://github.com/thit3455/toktickit/pull/43)

* **Comment:** Reviewed the authentication flow and the implemented changes. Login, logout, session handling, current-user verification, password hashing and first-login password change are covered and the reported authentication tests are passing. The changes look good to me. Approved.

* **Result:** Approved

### Authorization System

* **PR:** [PR #45](https://github.com/thit3455/toktickit/pull/45)

* **Comment:** looks fine. Approve

* **Result:** Approved

### Requester regression

* **PR:** [PR #46](https://github.com/thit3455/toktickit/pull/46)

* **Comment:** Seem fine. Approve!

* **Result:** Approved

---

## Reviews Received

### Lab 3 Specification and Test Design

* **PR:** [PR #38](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/38)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "Your work looks great, go ahead."

* **Result:** Approved

### User Model Migration

* **PR:** [PR #39](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/39)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "I reviewed the User model migration and seed changes. The migration preserves the existing requester/ticket relationships while introducing the Lab 3 roles and user fields. I also checked that the existing Lab 2 tests were updated to use the new User model and that requester queries are restricted to the REQUESTER role. The server regression tests are passing 32/32. Looks good from my review."

* **Result:** Approved

### Authentication and Authorization

* **PR:** [PR #40](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/40)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "I reviewed the implementation and tests. Authentication, session handling, password change, and role authorization work as expected. Looks good to merge."

* **Result:** Approved

### Requester Regression and Public Comments

* **PR:** [PR #41](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/41)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "Your codes look correct. All files and tests are passed. Continue the next step."

* **Result:** Approved

### IT Staff Ticket Queue

* **PR:** [PR #42](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/42)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "Your IT staff ticket queue looks fine and correct. I merge it."

* **Result:** Approved

### IT Staff Ticket Operations

* **PR:** [PR #43](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/43)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "Your IT ticket details operations seems clear and work well. All tests are passed. I approve it"

* **Result:** Approved

### Administrator User Management

* **PR:** [PR #44](https://github.com/Chanya-Grace-2546/TokTick_3456/pull/44)

* **Reviewer:** Thin Myat Yati Htun

* **Comment:** "The code works well, go to the next issue."

* **Result:** Approved