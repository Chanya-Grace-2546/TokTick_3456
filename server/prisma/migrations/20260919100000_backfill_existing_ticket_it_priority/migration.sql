-- ---------------------------------------------------------------------------
-- Lab 3 — Historical Ticket IT Priority Backfill
--
-- BR-26 requires IT Priority to initially copy Requested Priority for
-- migrated Tickets.
--
-- This migration performs the copy once for Tickets that existed before
-- this migration. Prisma records the migration as applied, so later IT Staff
-- changes to IT Priority are not overwritten on subsequent deployments.
-- ---------------------------------------------------------------------------

UPDATE "Ticket"
SET "itPriority" = "requestedPriority"
WHERE "itPriority" IS DISTINCT FROM "requestedPriority";