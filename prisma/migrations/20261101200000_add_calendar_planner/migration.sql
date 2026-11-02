CREATE TABLE "public"."CalendarAvailability" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workdays" JSONB NOT NULL,
  "startMinutes" INTEGER NOT NULL DEFAULT 540,
  "endMinutes" INTEGER NOT NULL DEFAULT 1020,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CalendarProposal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT,
  "title" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "totalMinutes" INTEGER NOT NULL,
  "items" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarProposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."CalendarEvent" ADD COLUMN "proposalId" TEXT;

CREATE UNIQUE INDEX "CalendarAvailability_userId_key" ON "public"."CalendarAvailability"("userId");
CREATE INDEX "CalendarProposal_userId_status_createdAt_idx" ON "public"."CalendarProposal"("userId", "status", "createdAt");
CREATE INDEX "CalendarProposal_taskId_idx" ON "public"."CalendarProposal"("taskId");
CREATE INDEX "CalendarEvent_proposalId_idx" ON "public"."CalendarEvent"("proposalId");

ALTER TABLE "public"."CalendarAvailability"
ADD CONSTRAINT "CalendarAvailability_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarProposal"
ADD CONSTRAINT "CalendarProposal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarProposal"
ADD CONSTRAINT "CalendarProposal_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "public"."PlanTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "public"."CalendarProposal"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
