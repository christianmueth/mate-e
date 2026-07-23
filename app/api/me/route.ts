import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasPremiumAccess } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { fromStoredPlan } from "@/lib/billing";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: true, signedIn: false, xp: 0, streak: 0, xpToday: 0, dailyGoal: 50, plan: "free", premiumActive: false, billingStatus: null });
    }

    // Don't "select" fields you haven't migrated yet.
    // Fetch whole row (whatever columns exist), then read optional values safely.
    const user: any = await prisma.user.findFirst({ where: { clerkUserId: userId } });

    const goal = user?.dailyGoal ?? 50;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let xpToday = 0;
    if (user?.xpTodayDate) {
      const d = new Date(user.xpTodayDate); d.setHours(0, 0, 0, 0);
      if (Number(d) === Number(today)) xpToday = user?.xpToday ?? 0;
    }

    const stripeCurrentPeriodEnd = user?.stripeCurrentPeriodEnd ? new Date(user.stripeCurrentPeriodEnd) : null;
    const normalizedPlan = fromStoredPlan(user?.plan);
    const premiumActive = normalizedPlan === "premium" || hasPremiumAccess(user?.stripeSubscriptionStatus, stripeCurrentPeriodEnd);

    return NextResponse.json({
      ok: true,
      signedIn: true,
      xp: user?.xp ?? 0,
      streak: user?.studyStreak ?? 0,
      xpToday,
      dailyGoal: goal,
      plan: normalizedPlan,
      premiumActive,
      billingStatus: user?.stripeSubscriptionStatus ?? null,
    });
  } catch {
    // Always return JSON
    return NextResponse.json({ ok: false, signedIn: false, xp: 0, streak: 0, xpToday: 0, dailyGoal: 50, plan: "free", premiumActive: false, billingStatus: null });
  }
}
