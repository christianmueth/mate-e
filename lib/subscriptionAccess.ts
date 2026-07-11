import { hasPremiumAccess } from "@/lib/billing";
import { getUserBillingState, prisma } from "@/lib/db";

export const FREE_TUTOR_CHAT_DAILY_LIMIT = 5;

export type TutorChatEntitlement = {
  plan: "free" | "premium";
  premiumActive: boolean;
  dailyCount: number;
  dailyLimit: number | null;
  remaining: number | null;
  locked: boolean;
  message: string;
};

export async function getTutorChatEntitlement(clerkUserId: string): Promise<TutorChatEntitlement> {
  const billingState = await getUserBillingState(clerkUserId);
  const premiumActive = billingState.plan === "premium"
    || hasPremiumAccess(billingState.stripeSubscriptionStatus, billingState.stripeCurrentPeriodEnd);

  if (!billingState.userId) {
    return {
      plan: "free",
      premiumActive: false,
      dailyCount: 0,
      dailyLimit: FREE_TUTOR_CHAT_DAILY_LIMIT,
      remaining: FREE_TUTOR_CHAT_DAILY_LIMIT,
      locked: false,
      message: `Free plan includes ${FREE_TUTOR_CHAT_DAILY_LIMIT} guided AI requests per day.`,
    };
  }

  const { start, end } = getTodayRange();
  const dailyCount = await prisma.reasoningRun.count({
    where: {
      userId: billingState.userId,
      mode: "tutor_chat",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  }).catch(() => 0);

  if (premiumActive) {
    return {
      plan: "premium",
      premiumActive: true,
      dailyCount,
      dailyLimit: null,
      remaining: null,
      locked: false,
      message: "Premium includes unlimited guided AI requests.",
    };
  }

  const remaining = Math.max(0, FREE_TUTOR_CHAT_DAILY_LIMIT - dailyCount);
  return {
    plan: "free",
    premiumActive: false,
    dailyCount,
    dailyLimit: FREE_TUTOR_CHAT_DAILY_LIMIT,
    remaining,
    locked: remaining <= 0,
    message: remaining > 0
      ? `${remaining} of ${FREE_TUTOR_CHAT_DAILY_LIMIT} guided AI requests left today.`
      : `Free plan limit reached. Upgrade to Premium for more guided AI requests.`,
  };
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
