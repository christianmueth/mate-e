import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret, isStripeBillingConfigured } from "@/lib/stripe";
import { getStripeCustomerId, getStripeSubscriptionId, syncUserBillingState } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ ok: false, error: "Stripe webhooks are not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("[StripeWebhook] Signature verification failed:", error);
    return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = getStripeSubscriptionId(session.subscription);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncUserBillingState({
            subscription,
            customerId: getStripeCustomerId(session.customer),
            subscriptionId,
            userId: session.metadata?.userId ?? null,
            clerkUserId: session.metadata?.clerkUserId ?? null,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncUserBillingState({
          subscription,
          customerId: getStripeCustomerId(subscription.customer),
          subscriptionId: subscription.id,
        });
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getStripeSubscriptionId(
          (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
        );
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncUserBillingState({
            subscription,
            customerId: getStripeCustomerId(invoice.customer),
            subscriptionId,
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[StripeWebhook] Failed to handle ${event.type}:`, error);
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
