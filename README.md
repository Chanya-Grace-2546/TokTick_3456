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

> **Warning:** Playwright must use a dedicated test database because its setup modifies test accounts. Do not run it against your development or shared database.

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

Run each terminal block from the repository root. The backend and E2E blocks
use subshells with `set -eu`, so a failed check or command stops that block.

Before starting the backend, configure `TOKTICKIT_E2E_DATABASE_URL` securely in
both Terminal 1 and Terminal 3 with the **same connection URL** for
`toktickit_e2e_test`, including the same dedicated non-`public` schema. Do not use
the development database `toktickit`, put credentials in shell history, or edit
the existing `.env` files. Each terminal must explicitly export `DATABASE_URL`;
exports in one terminal do not propagate to another.

**Terminal 1 — Verify, migrate, seed, then start the backend:**

```bash
(
set -eu
cd server
export DATABASE_URL="${TOKTICKIT_E2E_DATABASE_URL:?Configure the dedicated E2E database URL first}"
node --input-type=module <<'JS'
import { PrismaClient } from '@prisma/client';
const url = new URL(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema');
if (url.pathname !== '/toktickit_e2e_test' || !schema || schema === 'public') {
  throw new Error('Refusing a database/schema other than the dedicated E2E target.');
}
const prisma = new PrismaClient();
try {
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, current_schema() AS schema`;
  if (target.name !== 'toktickit_e2e_test' || target.schema !== schema) {
    throw new Error('Unexpected database/schema; provision the dedicated E2E schema first.');
  }
  console.log('Verified dedicated E2E database and schema.');
} finally {
  await prisma.$disconnect();
}
JS
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
npm run dev
)
```

**Terminal 2 — Frontend:**

```bash
cd client
npm run dev
```

**Terminal 3 — E2E Tests:**

```bash
(
set -eu
cd server
export DATABASE_URL="${TOKTICKIT_E2E_DATABASE_URL:?Use the same E2E database URL as Terminal 1}"
node --input-type=module <<'JS'
import { PrismaClient } from '@prisma/client';
const url = new URL(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema');
if (url.pathname !== '/toktickit_e2e_test' || !schema || schema === 'public') {
  throw new Error('Refusing a database/schema other than the dedicated E2E target.');
}
const prisma = new PrismaClient();
try {
  const [target] = await prisma.$queryRaw`SELECT current_database() AS name, current_schema() AS schema`;
  if (target.name !== 'toktickit_e2e_test' || target.schema !== schema) {
    throw new Error('Unexpected database/schema; migrate and seed the E2E target first.');
  }
  console.log('Verified E2E setup database and schema.');
} finally {
  await prisma.$disconnect();
}
JS
cd ../e2e
npx playwright test
)
```

Playwright global setup passes its environment to `prepare-e2e-users.ts`, so
this explicit `DATABASE_URL` makes account preparation use the same database
and schema as the backend. Start the backend only after verification, migration,
and seeding succeed; stop any previously running backend on port 3000 first.

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

## Lab 4 Feature 2 — database foundation

The additive migration `20261023000000_lab4_actions_taken_database` introduces
`ActionState`, `ActionTaken`, `ActionTakenHistory`, `TicketStatusHistory`, and
`ActionIdempotencyKey`. It does not update legacy rows, change Ticket statuses,
add a Ticket version, or modify previous migrations. New foreign keys restrict
deletion of referenced Tickets/Users; optional assignees are retained rather
than silently cleared. Indexes support ordered Actions/history and assignments.
The idempotency key is unique by actor, Ticket and key, with payload hash and
saved response stored separately.

Action version defaults to 1; state defaults to PLANNED. SQL CHECK constraints
require a positive version, nonblank description, nonblank completion result,
and nonblank required follow-up note. These checks live in migration SQL because
Prisma 5 cannot express them in the datamodel. Nullable old state/before snapshot
allow creation history. Dates use the existing Prisma UTC convention.

Before applying to a development/shared database, take a PostgreSQL backup and
record the migration baseline and legacy row counts. From `server/`, with
`DATABASE_URL` targeting the intended database:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
# Optional local demo fixtures, never required for migration:
npm run prisma:seed
```

Verify the original Users, Tickets, Attachments, Comments, Notes and Sessions,
including IDs, content and relationships. Migration alone leaves legacy Tickets
with zero Actions. Do not use `migrate reset` or `db push` for this upgrade.
If application fails, stop writes and inspect `prisma migrate status`; restore
from a verified backup to a separate recovery database, compare legacy records,
and switch over deliberately, or use a reviewed corrective migration. Do not
mark a partially applied migration resolved without inspecting its actual DDL.

Seed runs are transactional and serialized by a transaction advisory lock.
Existing users, reference data and Tickets use create-only upserts. Five Action
fixtures cover all states, follow-up, independent performer/owner, optional
assignment, and zero/one/multiple Actions per Ticket. Creation-history JSON
markers identify fixtures even after edits, avoiding a seed-only schema column.
Existing Ticket identity/summary and staff eligibility are checked before adding
Action fixtures; incompatible demo prerequisites are skipped. Existing records
are never restored to fixture values. No past Ticket transitions are invented.

Feature 2 provides storage only. Authenticated actors, eligible assignment,
terminal immutability, append-only application access, version checking,
transactional workflow/audit writes and HTTP replay handling belong to Feature 3.
The caller must supply the contract's 24-hour idempotency expiry; expired rows
remain stored and no cleanup policy is introduced. The specification's completed
Action/follow-up editing ambiguity remains a Feature 3 decision.

From `server/`, run:

```bash
npx prisma validate
npm test -- tests/lab-04
npm test
npm run build
```

Tests use generated disposable schemas, never the development schema. Migration
tests additionally require `pg_dump` and `pg_restore` on PATH, test a populated
Lab 3 baseline, compare complete legacy rows, seed repeatedly (including edited
records), and restore a pre-migration backup within their disposable schema.
The existing Lab 3 historical helper is unchanged; the new Lab 4 helper freezes
its baseline at the last Lab 3 migration.

From `client/`, run `npm test` and `npx tsc --noEmit` (the existing `npm run build`
also emits JavaScript beside TypeScript sources). Existing Playwright regression
requires a separately isolated migrated/seeded database and local API on port
3000 plus Vite on 5173; its user-preparation script updates test accounts, so do
not run it against a development/shared database.

Feature 2 verification (2026-10-23, working tree based on `ff8143d`): Prisma
validation/client generation passed; server 24 files / 442 tests passed
(including 19 Lab 4 database/migration tests); client 18 files / 217 tests passed;
server/client builds and final `tsc --noEmit` checks passed. Backup/restore and
migration tests used disposable schemas. Playwright regression subsequently
passed all 21 tests across desktop/tablet/mobile (final run: 41.4 seconds) using
`toktickit_e2e_test`, a fresh random non-public schema, an identified backend on
an OS-assigned port, and a dedicated available frontend port. Temporary test
copies replaced hardcoded URLs; tracked Playwright files were unchanged. The
runner stopped all owned test processes before verifying ownership and deleting
its disposable schema. Credentials were supplied in memory; existing `.env`
files were unchanged. The dedicated test database remains available. These are
local feature-branch results, not final merged-main acceptance evidence.
