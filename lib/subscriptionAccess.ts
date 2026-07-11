import { hasPremiumAccess } from "@/lib/billing";
import { getUserBillingState, prisma } from "@/lib/db";

export const FREE_TUTOR_CHAT_DAILY_LIMIT = 5;
export const FREE_PRESENTATION_PLAN_DAILY_LIMIT = 2;
export const FREE_WHITEBOARD_ASSIST_DAILY_LIMIT = 3;

export type UsageEntitlement = {
  plan: "free" | "premium";
  premiumActive: boolean;
  dailyCount: number;
  dailyLimit: number | null;
  remaining: number | null;
  locked: boolean;
  message: string;
};

export type TutorChatEntitlement = UsageEntitlement;

type UsageEntitlementOptions = {
  mode: string;
  freeDailyLimit: number;
  featureLabel: string;
};

export async function getTutorChatEntitlement(clerkUserId: string): Promise<TutorChatEntitlement> {
  return getUsageEntitlement(clerkUserId, {
    mode: "tutor_chat",
    freeDailyLimit: FREE_TUTOR_CHAT_DAILY_LIMIT,
    featureLabel: "guided AI requests",
  });
}

export async function getPresentationPlanEntitlement(clerkUserId: string): Promise<UsageEntitlement> {
  return getUsageEntitlement(clerkUserId, {
    mode: "presentation_plan",
    freeDailyLimit: FREE_PRESENTATION_PLAN_DAILY_LIMIT,
    featureLabel: "presentation plans",
  });
}

export async function getWhiteboardAssistEntitlement(clerkUserId: string): Promise<UsageEntitlement> {
  return getUsageEntitlement(clerkUserId, {
    mode: "whiteboard_assist",
    freeDailyLimit: FREE_WHITEBOARD_ASSIST_DAILY_LIMIT,
    featureLabel: "whiteboard assists",
  });
}

async function getUsageEntitlement(clerkUserId: string, options: UsageEntitlementOptions): Promise<UsageEntitlement> {
  const billingState = await getUserBillingState(clerkUserId);
  const premiumActive = billingState.plan === "premium"
    || hasPremiumAccess(billingState.stripeSubscriptionStatus, billingState.stripeCurrentPeriodEnd);

  if (!billingState.userId) {
    return {
      plan: "free",
      premiumActive: false,
      dailyCount: 0,
      dailyLimit: options.freeDailyLimit,
      remaining: options.freeDailyLimit,
      locked: false,
      message: `Free plan includes ${options.freeDailyLimit} ${options.featureLabel} per day.`,
    };
  }

  const { start, end } = getTodayRange();
  const dailyCount = await prisma.reasoningRun.count({
    where: {
      userId: billingState.userId,
      mode: options.mode,
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
      message: `Premium includes unlimited ${options.featureLabel}.`,
    };
  }

  const remaining = Math.max(0, options.freeDailyLimit - dailyCount);
  return {
    plan: "free",
    premiumActive: false,
    dailyCount,
    dailyLimit: options.freeDailyLimit,
    remaining,
    locked: remaining <= 0,
    message: remaining > 0
      ? `${remaining} of ${options.freeDailyLimit} ${options.featureLabel} left today.`
      : `Free plan limit reached. Upgrade to Premium for more ${options.featureLabel}.`,
  };
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
