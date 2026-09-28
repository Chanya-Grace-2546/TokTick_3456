-- Lab 3 Issue 2
-- Backfill migrated Lab 2 Requesters with the development initial
-- password hash before enforcing passwordHash as NOT NULL.

UPDATE "User"
SET
    "passwordHash" = '$2b$12$GkumUyou/5rP7tE4WBcJHOTomq92QDTDYOuc7bCxQ.bwHJeOs0Z4i',
    "mustChangePassword" = true
WHERE "passwordHash" IS NULL;

-- All users must now have a password hash.
ALTER TABLE "User"
ALTER COLUMN "passwordHash" SET NOT NULL;

-- Match the final Prisma schema.
ALTER TABLE "User"
ALTER COLUMN "updatedAt" DROP DEFAULT;