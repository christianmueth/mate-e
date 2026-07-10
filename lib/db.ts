import { Prisma, PrismaClient } from "@prisma/client";

type BillingColumnName = "plan" | "stripeCustomerId" | "stripeSubscriptionStatus" | "stripeCurrentPeriodEnd";

type UserBillingState = {
  userId: string | null;
  plan: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: Date | null;
  billingColumnsReady: boolean;
  detail: string;
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export function isMissingUserTableError(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code?: string }).code)
    : "";
  const table = String((error as { meta?: { table?: unknown } } | null)?.meta?.table || "");
  const message = String((error as { message?: unknown } | null)?.message || "");

  return (
    code === "P2021" &&
    (
      table.includes("User") ||
      /public\.User/i.test(message) ||
      /table\s+.*User\s+does not exist/i.test(message) ||
      /prisma\.user\.upsert\(\)/i.test(message)
    )
  );
}

export function isMissingUserColumnError(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code?: string }).code)
    : "";
  const column = String((error as { meta?: { column?: unknown } } | null)?.meta?.column || "");
  const message = String((error as { message?: unknown } | null)?.message || "");

  return (
    code === "P2022" &&
    (
      column.includes("User") ||
      /column.+User/i.test(message) ||
      /stripe(CustomerId|SubscriptionId|SubscriptionStatus|CurrentPeriodEnd)|\bplan\b/i.test(message)
    )
  );
}

export function isRecoverableUserPersistenceError(error: unknown) {
  return isMissingUserTableError(error) || isMissingUserColumnError(error);
}

export async function safeUpsertUser<T extends Prisma.UserSelect>(clerkUserId: string, select: T) {
  try {
    return await prisma.user.upsert({
      where: { clerkUserId },
      update: {},
      create: { clerkUserId },
      select,
    });
  } catch (error) {
    if (isRecoverableUserPersistenceError(error)) {
      console.warn("[db] User persistence unavailable; skipping user persistence");
      return null;
    }
    throw error;
  }
}

const REQUIRED_BILLING_COLUMNS: BillingColumnName[] = [
  "plan",
  "stripeCustomerId",
  "stripeSubscriptionStatus",
  "stripeCurrentPeriodEnd",
];

export async function getUserBillingState(clerkUserId: string): Promise<UserBillingState> {
  const user = await safeUpsertUser(clerkUserId, { id: true });

  if (!user) {
    return {
      userId: null,
      plan: null,
      stripeCustomerId: null,
      stripeSubscriptionStatus: null,
      stripeCurrentPeriodEnd: null,
      billingColumnsReady: false,
      detail: "Base user record is unavailable.",
    };
  }

  try {
    const existingColumns = await prisma.$queryRaw<Array<{ column_name: BillingColumnName }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'User'
        AND column_name IN ('plan', 'stripeCustomerId', 'stripeSubscriptionStatus', 'stripeCurrentPeriodEnd')
    `;

    const columnSet = new Set(existingColumns.map((row) => row.column_name));
    const missingColumns = REQUIRED_BILLING_COLUMNS.filter((column) => !columnSet.has(column));

    if (missingColumns.length > 0) {
      return {
        userId: user.id,
        plan: null,
        stripeCustomerId: null,
        stripeSubscriptionStatus: null,
        stripeCurrentPeriodEnd: null,
        billingColumnsReady: false,
        detail: `Missing billing columns: ${missingColumns.join(", ")}`,
      };
    }

    const rows = await prisma.$queryRaw<Array<{
      plan: unknown;
      stripeCustomerId: unknown;
      stripeSubscriptionStatus: unknown;
      stripeCurrentPeriodEnd: unknown;
    }>>`
      SELECT "plan", "stripeCustomerId", "stripeSubscriptionStatus", "stripeCurrentPeriodEnd"
      FROM "public"."User"
      WHERE "clerkUserId" = ${clerkUserId}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return {
        userId: user.id,
        plan: "free",
        stripeCustomerId: null,
        stripeSubscriptionStatus: null,
        stripeCurrentPeriodEnd: null,
        billingColumnsReady: true,
        detail: "Billing row not found after user upsert.",
      };
    }

    return {
      userId: user.id,
      plan: row.plan == null ? "free" : String(row.plan).toLowerCase(),
      stripeCustomerId: row.stripeCustomerId == null ? null : String(row.stripeCustomerId),
      stripeSubscriptionStatus: row.stripeSubscriptionStatus == null ? null : String(row.stripeSubscriptionStatus),
      stripeCurrentPeriodEnd: row.stripeCurrentPeriodEnd instanceof Date
        ? row.stripeCurrentPeriodEnd
        : row.stripeCurrentPeriodEnd
          ? new Date(String(row.stripeCurrentPeriodEnd))
          : null,
      billingColumnsReady: true,
      detail: "Billing state loaded.",
    };
  } catch (error) {
    return {
      userId: user.id,
      plan: null,
      stripeCustomerId: null,
      stripeSubscriptionStatus: null,
      stripeCurrentPeriodEnd: null,
      billingColumnsReady: false,
      detail: error instanceof Error ? error.message : "Failed to load billing state.",
    };
  }
}
