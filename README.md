# TokTickIT

TokTickIT is a ticket management system developed for Lab 2. The system allows requesters to select a requester profile, create tickets, view their tickets, view ticket details, and manage attachments.

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

The E2E tests use Playwright to verify the complete requester ticket flow, including visual and responsive inspection.

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

The E2E flow verifies that a requester can:

1. Select a development requester.
2. Create a ticket.
3. View the created ticket.
4. Upload an attachment.
5. Remove an attachment.
6. Return to My Tickets and confirm that the ticket appears.

## E2E Screenshots

Screenshots generated during E2E testing are stored in:

```text
artifacts/lab-02/screenshots/
├── create-ticket/
├── ticket-detail/
└── my-tickets/
```

Each section contains screenshots for:

* `desktop.png`
* `tablet.png`
* `mobile.png`
