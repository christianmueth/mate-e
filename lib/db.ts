import { Prisma, PrismaClient } from "@prisma/client";

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
