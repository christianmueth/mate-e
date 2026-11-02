CREATE TABLE "public"."CalendarShare" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarShare_token_key" ON "public"."CalendarShare"("token");
CREATE INDEX "CalendarShare_userId_updatedAt_idx" ON "public"."CalendarShare"("userId", "updatedAt");

ALTER TABLE "public"."CalendarShare"
ADD CONSTRAINT "CalendarShare_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
