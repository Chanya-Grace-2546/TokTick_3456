-- ---------------------------------------------------------------------------
-- Lab 3 Issue 2 — User Model Migration
--
-- Preserve the existing Lab 2 DevelopmentRequester rows and their IDs.
-- The existing table is renamed to User rather than dropped/recreated so
-- Ticket.requesterId continues to reference the same requester identities.
-- ---------------------------------------------------------------------------

-- Create Lab 3 role enum.
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Extend the existing TicketStatus enum.
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';

-- ---------------------------------------------------------------------------
-- DevelopmentRequester -> User
-- ---------------------------------------------------------------------------

-- Temporarily remove the existing Ticket requester FK before renaming.
ALTER TABLE "Ticket"
DROP CONSTRAINT "Ticket_requesterId_fkey";

-- Preserve the table and all existing rows/IDs.
ALTER TABLE "DevelopmentRequester"
RENAME TO "User";

-- Rename the existing primary-key constraint for consistency.
ALTER TABLE "User"
RENAME CONSTRAINT "DevelopmentRequester_pkey" TO "User_pkey";

-- Rename the existing unique email index created by Prisma.
ALTER INDEX "DevelopmentRequester_email_key"
RENAME TO "User_email_key";

-- Add Lab 3 authentication/authorization fields.
--
-- passwordHash starts nullable so existing Lab 2 users can survive the
-- structural migration. The seed will assign password hashes to all
-- migrated Requesters before authentication is used.
ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER',
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing DevelopmentRequester rows are Requesters.
UPDATE "User"
SET "role" = 'REQUESTER';

-- ---------------------------------------------------------------------------
-- Ticket Lab 3 fields
-- ---------------------------------------------------------------------------

ALTER TABLE "Ticket"
ADD COLUMN "ownerId" INTEGER,
ADD COLUMN "problemAppearsResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "problemAppearsResolvedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Public Comments
-- ---------------------------------------------------------------------------

CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Internal Notes
-- ---------------------------------------------------------------------------

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX "User_role_idx"
ON "User"("role");

CREATE INDEX "User_isActive_idx"
ON "User"("isActive");

CREATE INDEX "PublicComment_ticketId_idx"
ON "PublicComment"("ticketId");

CREATE INDEX "PublicComment_authorId_idx"
ON "PublicComment"("authorId");

CREATE INDEX "InternalNote_ticketId_idx"
ON "InternalNote"("ticketId");

CREATE INDEX "InternalNote_authorId_idx"
ON "InternalNote"("authorId");

CREATE INDEX "Ticket_ownerId_idx"
ON "Ticket"("ownerId");

CREATE INDEX "Ticket_requestedPriority_idx"
ON "Ticket"("requestedPriority");

CREATE INDEX "Ticket_itPriority_idx"
ON "Ticket"("itPriority");

-- ---------------------------------------------------------------------------
-- Foreign Keys
-- ---------------------------------------------------------------------------

-- Reconnect existing Ticket requester IDs to the renamed User table.
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_requesterId_fkey"
FOREIGN KEY ("requesterId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_ownerId_fkey"
FOREIGN KEY ("ownerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
ADD CONSTRAINT "PublicComment_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "Ticket"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
ADD CONSTRAINT "PublicComment_authorId_fkey"
FOREIGN KEY ("authorId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
ADD CONSTRAINT "InternalNote_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "Ticket"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
ADD CONSTRAINT "InternalNote_authorId_fkey"
FOREIGN KEY ("authorId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;