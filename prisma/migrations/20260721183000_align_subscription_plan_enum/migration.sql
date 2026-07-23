DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SubscriptionPlan'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM');
  END IF;
END $$;

ALTER TABLE "public"."User"
ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "public"."User"
ALTER COLUMN "plan" TYPE "public"."SubscriptionPlan"
USING (
  CASE UPPER(COALESCE("plan"::text, 'FREE'))
    WHEN 'PREMIUM' THEN 'PREMIUM'::"public"."SubscriptionPlan"
    ELSE 'FREE'::"public"."SubscriptionPlan"
  END
);

ALTER TABLE "public"."User"
ALTER COLUMN "plan" SET DEFAULT 'FREE';