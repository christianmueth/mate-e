import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { safeUpsertUser } from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!String(process.env.STRIPE_SECRET_KEY || "").trim()) {
      return NextResponse.json({ ok: false, error: "Stripe is not configured." }, { status: 503 });
    }

    const user = await safeUpsertUser(clerkUserId, {
      stripeCustomerId: true,
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Billing is unavailable until the database is ready." }, { status: 503 });
    }

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "No Stripe customer is linked to this account yet." }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getAppUrl()}/app/billing`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("[BillingPortal] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to open the billing portal.",
      },
      { status: 500 }
    );
  }
}
