CREATE TABLE "public"."PlanTask" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CalendarEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  "recurrenceUntil" TIMESTAMP(3),
  "reminderMinutes" INTEGER,
  "reminderEmail" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanTask_userId_dueAt_idx" ON "public"."PlanTask"("userId", "dueAt");
CREATE INDEX "CalendarEvent_userId_startsAt_idx" ON "public"."CalendarEvent"("userId", "startsAt");
CREATE INDEX "CalendarEvent_reminderSentAt_startsAt_idx" ON "public"."CalendarEvent"("reminderSentAt", "startsAt");
CREATE INDEX "CalendarEvent_taskId_idx" ON "public"."CalendarEvent"("taskId");

ALTER TABLE "public"."PlanTask"
ADD CONSTRAINT "PlanTask_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "public"."PlanTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
