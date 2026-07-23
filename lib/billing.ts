import type Stripe from "stripe";
import { prisma } from "@/lib/db";

export type AppPlan = "free" | "premium";
export type StoredPlan = "FREE" | "PREMIUM";

const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);
const BLOCKED_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid"]);

export function toStoredPlan(plan: AppPlan): StoredPlan {
  return plan === "premium" ? "PREMIUM" : "FREE";
}

export function fromStoredPlan(plan: unknown): AppPlan {
  return String(plan || "").toUpperCase() === "PREMIUM" ? "premium" : "free";
}

export function stripeTimestampToDate(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000);
}

export function hasPremiumAccess(
  subscriptionStatus: string | null | undefined,
  currentPeriodEnd: Date | null | undefined
) {
  if (!subscriptionStatus) {
    return false;
  }

  if (PREMIUM_STATUSES.has(subscriptionStatus)) {
    return true;
  }

  if (BLOCKED_STATUSES.has(subscriptionStatus)) {
    return Boolean(currentPeriodEnd && currentPeriodEnd.getTime() > Date.now() && subscriptionStatus !== "unpaid");
  }

  return Boolean(currentPeriodEnd && currentPeriodEnd.getTime() > Date.now());
}

export function derivePlan(
  subscriptionStatus: string | null | undefined,
  currentPeriodEnd: Date | null | undefined
): AppPlan {
  return hasPremiumAccess(subscriptionStatus, currentPeriodEnd) ? "premium" : "free";
}

export function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

export function getStripeSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined
) {
  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

export function subscriptionToUserFields(subscription: Stripe.Subscription) {
  const currentPeriodEnd = stripeTimestampToDate(
    (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end
  );
  const stripeSubscriptionStatus = subscription.status;

  return {
    plan: toStoredPlan(derivePlan(stripeSubscriptionStatus, currentPeriodEnd)),
    stripeCustomerId: getStripeCustomerId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price?.id ?? null,
    stripeSubscriptionStatus,
    stripeCurrentPeriodEnd: currentPeriodEnd,
  };
}

export async function syncUserBillingState(args: {
  subscription?: Stripe.Subscription | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  userId?: string | null;
  clerkUserId?: string | null;
}) {
  const customerId = args.customerId ?? getStripeCustomerId(args.subscription?.customer);
  const metadataUserId = args.subscription?.metadata?.userId || args.userId || null;
  const metadataClerkUserId = args.subscription?.metadata?.clerkUserId || args.clerkUserId || null;
  const data = args.subscription
    ? subscriptionToUserFields(args.subscription)
    : {
        plan: "FREE" as const,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: args.subscriptionId ?? null,
        stripePriceId: null,
        stripeSubscriptionStatus: null,
        stripeCurrentPeriodEnd: null,
      };

  let updatedCount = 0;

  if (metadataUserId) {
    const result = await prisma.user.updateMany({
      where: { id: metadataUserId },
      data,
    });
    updatedCount = result.count;
  }

  if (!updatedCount && metadataClerkUserId) {
    const result = await prisma.user.updateMany({
      where: { clerkUserId: metadataClerkUserId },
      data,
    });
    updatedCount = result.count;
  }

  if (!updatedCount && customerId) {
    const result = await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data,
    });
    updatedCount = result.count;
  }

  if (!updatedCount && args.subscriptionId) {
    const result = await prisma.user.updateMany({
      where: { stripeSubscriptionId: args.subscriptionId },
      data,
    });
    updatedCount = result.count;
  }

  return updatedCount > 0;
}
