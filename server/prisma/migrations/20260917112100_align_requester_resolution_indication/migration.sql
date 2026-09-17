/*
  Lab 3 Issue 4 — Requester apparent-resolution migration.

  Preserve the existing apparent-resolution timestamp while aligning the
  Ticket schema with the approved Lab 3 contract.

  The old boolean column is no longer required because requesterResolvedAt
  represents whether an apparent-resolution indication currently exists.

  Existing rows that were previously marked as resolved but do not have a
  timestamp are backfilled with the Ticket updatedAt value so the indication
  is not silently lost during migration.

  requesterResolvedById cannot be reconstructed reliably for historical
  indications because the previous schema did not store the acting User.
  Historical rows therefore keep requesterResolvedById as NULL.
*/

-- Rename the existing timestamp column so existing indication times are kept.
ALTER TABLE "Ticket"
RENAME COLUMN "problemAppearsResolvedAt" TO "requesterResolvedAt";

-- Preserve historical true indications that do not have a stored timestamp.
UPDATE "Ticket"
SET "requesterResolvedAt" = "updatedAt"
WHERE "problemAppearsResolved" = true
  AND "requesterResolvedAt" IS NULL;

-- The old boolean is now represented by requesterResolvedAt being non-null.
ALTER TABLE "Ticket"
DROP COLUMN "problemAppearsResolved";

-- Add the User who makes future Requester apparent-resolution indications.
ALTER TABLE "Ticket"
ADD COLUMN "requesterResolvedById" INTEGER;

-- Index the apparent-resolution User relationship.
CREATE INDEX "Ticket_requesterResolvedById_idx"
ON "Ticket"("requesterResolvedById");

-- Historical indications have NULL requesterResolvedById because the old
-- schema did not record which User performed the action.
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_requesterResolvedById_fkey"
FOREIGN KEY ("requesterResolvedById")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;