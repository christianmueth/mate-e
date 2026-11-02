-- One canonical, durable workspace project is maintained for each user.
CREATE TABLE "WorkspaceProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceProject_userId_key" ON "WorkspaceProject"("userId");

-- A deterministic legacy ID lets existing tasks and calendar records be preserved.
INSERT INTO "WorkspaceProject" ("id", "userId", "title", "updatedAt")
SELECT 'workspace_' || "id", "id", 'Workspace project', CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "PlanTask" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CalendarProposal" ADD COLUMN "projectId" TEXT;

UPDATE "PlanTask" AS task
SET "projectId" = project."id"
FROM "WorkspaceProject" AS project
WHERE project."userId" = task."userId";

UPDATE "CalendarEvent" AS event
SET "projectId" = project."id"
FROM "WorkspaceProject" AS project
WHERE project."userId" = event."userId";

UPDATE "CalendarProposal" AS proposal
SET "projectId" = project."id"
FROM "WorkspaceProject" AS project
WHERE project."userId" = proposal."userId";

ALTER TABLE "PlanTask" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "CalendarEvent" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "CalendarProposal" ALTER COLUMN "projectId" SET NOT NULL;

CREATE INDEX "PlanTask_projectId_dueAt_idx" ON "PlanTask"("projectId", "dueAt");
CREATE INDEX "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");
CREATE INDEX "CalendarProposal_projectId_idx" ON "CalendarProposal"("projectId");

ALTER TABLE "WorkspaceProject" ADD CONSTRAINT "WorkspaceProject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarProposal" ADD CONSTRAINT "CalendarProposal_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
