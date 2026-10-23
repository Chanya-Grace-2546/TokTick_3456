-- Atomic additive migration: a failed statement leaves no partial Lab 4 DDL.
BEGIN;

-- CreateEnum
CREATE TYPE "ActionState" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "performedByUserId" INTEGER NOT NULL,
    "assignedToUserId" INTEGER,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "state" "ActionState" NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTakenHistory" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "oldState" "ActionState",
    "newState" "ActionState" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionTakenHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "oldStatus" "TicketStatus" NOT NULL,
    "newStatus" "TicketStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionIdempotencyKey" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assignedToUserId_state_idx" ON "ActionTaken"("assignedToUserId", "state");

-- CreateIndex
CREATE INDEX "ActionTaken_performedByUserId_idx" ON "ActionTaken"("performedByUserId");

-- CreateIndex
CREATE INDEX "ActionTakenHistory_actionId_occurredAt_id_idx" ON "ActionTakenHistory"("actionId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ActionTakenHistory_actorUserId_idx" ON "ActionTakenHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_occurredAt_id_idx" ON "TicketStatusHistory"("ticketId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_actorUserId_idx" ON "TicketStatusHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "ActionIdempotencyKey_ticketId_idx" ON "ActionIdempotencyKey"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionIdempotencyKey_actorUserId_ticketId_key_key" ON "ActionIdempotencyKey"("actorUserId", "ticketId", "key");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenHistory" ADD CONSTRAINT "ActionTakenHistory_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenHistory" ADD CONSTRAINT "ActionTakenHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionIdempotencyKey" ADD CONSTRAINT "ActionIdempotencyKey_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionIdempotencyKey" ADD CONSTRAINT "ActionIdempotencyKey_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-local invariants; workflow/authentication are enforced by later services.
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_version_positive" CHECK (version >= 1),
  ADD CONSTRAINT "ActionTaken_description_nonblank" CHECK (description ~ '[^[:space:]]'),
  ADD CONSTRAINT "ActionTaken_completed_result" CHECK (state <> 'COMPLETED' OR (result IS NOT NULL AND result ~ '[^[:space:]]')),
  ADD CONSTRAINT "ActionTaken_followup_note" CHECK (NOT "followUpRequired" OR ("followUpNote" IS NOT NULL AND "followUpNote" ~ '[^[:space:]]'));

COMMIT;
