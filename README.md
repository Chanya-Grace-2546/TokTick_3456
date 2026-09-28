# TokTickIT

TokTickIT is a ticket management system developed through Lab 3. Users sign in with email and password. Requesters create and track their own tickets and attachments; IT Staff manage the shared queue, ownership, priority, status, comments, and internal notes; Administrators manage users. New accounts must change their initial password before using the application.

## Project Structure

```text
toktickit/
├── client/                 # React + Vite frontend
├── server/                 # Express + Prisma backend
├── docs/                   # Lab documentation
├── e2e/                    # Playwright E2E tests
├── artifacts/              # E2E screenshots
└── README.md
```

## Requirements

* Node.js
* npm
* PostgreSQL

## Installation

Install the frontend dependencies:

```bash
cd client
npm install
```

Install the backend dependencies:

```bash
cd ../server
npm install
```

Install the E2E test dependencies:

```bash
cd ../e2e
npm install
```

## Database Setup

Make sure PostgreSQL is running and the database environment configuration is set correctly.

Run Prisma migrations:

```bash
cd server
npm run prisma:migrate
npm run prisma:seed
```

Seed the database:

```bash
npm run prisma:seed
```

## Local development accounts

These are **local development/test credentials only**, created by `server/prisma/seed.ts`.
Newly seeded accounts use initial password `ChangeMe1!` and require a password change on first login. Inactive accounts cannot sign in. Re-running the seed preserves existing passwords and password-change state.

| Name | Email | Role | Active |
|---|---|---|---|
| Jennifer Anderson | jennifer.anderson@example.com | Requester | Yes |
| Michael Brown | michael.brown@example.com | Requester | Yes |
| Sarah Johnson | sarah.johnson@example.com | Requester | Yes |
| David Lee | david.lee@example.com | Requester | Yes |
| Retired Requester | retired.requester@example.com | Requester | No |
| Alex Morgan | alex.morgan@toktickit.local | IT Staff | Yes |
| Priya Shah | priya.shah@toktickit.local | IT Staff | Yes |
| Daniel Kim | daniel.kim@toktickit.local | IT Staff | Yes |
| Inactive IT Staff | inactive.staff@toktickit.local | IT Staff | No |
| System Administrator | admin@toktickit.local | Administrator | Yes |

## Running the Application

### Backend

Open Terminal 1:

```bash
cd server
npm run dev
```

### Frontend

Open Terminal 2:

```bash
cd client
npm run dev
```

## Running Tests

### Backend Tests

From the `server` directory:

```bash
npm test
```

### Frontend Tests

From the `client` directory:

```bash
npm test
```

## End-to-End (E2E) Testing

The E2E tests use Playwright to verify authentication, requester regression, staff operations, and user administration across responsive viewports. Global setup prepares dedicated E2E accounts. Use a local migrated, seeded database.

### Install E2E Dependencies

From the repository root:

```bash
cd e2e
npm install
```

Install the Playwright Chromium browser (one-time setup):

```bash
npx playwright install chromium
```

### Run the E2E Tests

Make sure the backend and frontend are running first.

**Terminal 1 — Backend:**

```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd client
npm run dev
```

**Terminal 3 — E2E Tests:**

```bash
cd e2e
npx playwright test
```

> **Note:** Do not use `npx vitest run` for E2E testing. E2E tests use Playwright.

The E2E tests run across multiple viewport sizes:

* Desktop
* Tablet
* Mobile

The E2E suite verifies:

1. Authentication, logout, and mandatory first-login password change.
2. Requester ticket creation, detail, attachments, comments, and ownership protection.
3. IT Staff queue pagination, ticket claim, priority and status changes, Public Comments, and Internal Notes.
4. Administrator user management, password reset, and account safety rules.
5. Responsive behavior across desktop, tablet, and mobile viewports.

## E2E Screenshots

Screenshots generated during E2E testing are stored in:

```text
artifacts/lab-03/screenshots/
├── login/
├── change-password/
├── requester-ticket-detail/
├── staff-queue/
├── staff-ticket-detail/
└── user-management/
```

Each section contains screenshots for:

* `desktop.png`
* `tablet.png`
* `mobile.png`
