/*
  Warnings:

  - Made the column `itPriority` on table `Ticket` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL,
ALTER COLUMN "itPriority" SET DEFAULT 'MEDIUM';
