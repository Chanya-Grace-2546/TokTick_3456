# TokTickIT

An IT service desk ticketing app — React + TypeScript frontend, Express + TypeScript backend, PostgreSQL via Prisma.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (locally installed and running)

## Setup

### 1. Install dependencies

cd client && npm install
cd ../server && npm install

### 2. Configure environment variables

Copy the example env files and fill in your local values:

cp client/.env.example client/.env
cp server/.env.example server/.env

Edit server/.env so DATABASE_URL matches your local Postgres setup. Example:

DATABASE_URL="postgresql://<your-username>@localhost:5432/toktickit?schema=public"
PORT=3000

### 3. Create the database

createdb toktickit

### 4. Verify Prisma can connect

cd server
npx prisma db pull

## Running the app

In separate terminal tabs:

Backend (http://localhost:3000): cd server && npm run dev
Frontend (http://localhost:5173): cd client && npm run dev

## Running tests

cd server && npm test
cd client && npm test