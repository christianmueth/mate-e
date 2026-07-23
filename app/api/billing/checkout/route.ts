import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, getUserBillingState } from "@/lib/db";
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

    const billingState = await getUserBillingState(clerkUserId);

    if (!billingState.userId) {
      return NextResponse.json({ ok: false, error: "Billing is unavailable until the database is ready." }, { status: 503 });
    }

    if (!billingState.billingColumnsReady) {
      return NextResponse.json({ ok: false, error: billingState.detail || "Billing is unavailable until the database is ready." }, { status: 503 });
    }

    const stripe = getStripe();
    let stripeCustomerId = billingState.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: {
          clerkUserId,
          userId: billingState.userId,
        },
      });

      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: billingState.userId },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: billingState.userId,
      allow_promotion_codes: true,
      line_items: [
        {
          price: getStripePremiumPriceId(),
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId,
        userId: billingState.userId,
        plan: "premium",
      },
      subscription_data: {
        metadata: {
          clerkUserId,
          userId: billingState.userId,
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
        error: getBillingCheckoutErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

function getBillingCheckoutErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const param = typeof (error as { param?: unknown } | null)?.param === "string"
    ? String((error as { param?: string }).param)
    : "";

  if (
    param === "line_items[0][price]"
    || /price specified is inactive/i.test(message)
    || /only accepts active prices/i.test(message)
  ) {
    return "Stripe checkout is configured with an inactive price. Update STRIPE_PREMIUM_PRICE_ID in production to an active recurring Stripe price.";
  }

  return message || "Unable to start checkout.";
}
