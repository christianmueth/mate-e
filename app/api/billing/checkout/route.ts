import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, safeUpsertUser } from "@/lib/db";
import { getAppUrl, getStripe, getStripePremiumPriceId, isStripeCheckoutConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isStripeCheckoutConfigured()) {
      return NextResponse.json({ ok: false, error: "Stripe checkout is not configured." }, { status: 503 });
    }

    const user = await safeUpsertUser(clerkUserId, {
      id: true,
      stripeCustomerId: true,
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Billing is unavailable until the database is ready." }, { status: 503 });
    }

    const stripe = getStripe();
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: {
          clerkUserId,
          userId: user.id,
        },
      });

      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      line_items: [
        {
          price: getStripePremiumPriceId(),
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId,
        userId: user.id,
        plan: "premium",
      },
      subscription_data: {
        metadata: {
          clerkUserId,
          userId: user.id,
          plan: "premium",
        },
      },
      success_url: `${getAppUrl()}/app/billing?checkout=success`,
      cancel_url: `${getAppUrl()}/app/billing?checkout=canceled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("[BillingCheckout] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to start checkout.",
      },
      { status: 500 }
    );
  }
}
