import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BillingActions from "@/components/BillingActions";
import { hasPremiumAccess } from "@/lib/billing";
import { getUserBillingState } from "@/lib/db";
import { isStripeBillingConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type BillingPageSearchParams = Promise<{
  checkout?: string | string[];
}>;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: BillingPageSearchParams;
}) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    redirect(`/?next=${encodeURIComponent("/app/billing")}`);
  }

  const resolvedSearchParams = await searchParams;
  const checkoutState = pickSearchParam(resolvedSearchParams.checkout);
  const billingState = await getUserBillingState(clerkUserId);
  const billingConfigured = isStripeBillingConfigured();

  const isPremium = billingState.plan === "premium" || hasPremiumAccess(billingState.stripeSubscriptionStatus, billingState.stripeCurrentPeriodEnd);
  const banner = buildBanner(checkoutState, isPremium);
  const billingReady = billingState.billingColumnsReady;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-7 text-white shadow-[0_24px_90px_rgba(15,23,42,0.24)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">Billing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Mate-E Premium</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
          Upgrade this account to Premium, manage payment details, or confirm the current subscription state.
        </p>
      </section>

      {banner ? (
        <section className={banner.tone === "success"
          ? "rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900"
          : "rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        }>
          {banner.message}
        </section>
      ) : null}

      <section>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current plan</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isPremium ? "Premium" : "Free"}
          </h2>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>
              Stripe status: <span className="font-medium text-slate-950">{billingState.stripeSubscriptionStatus || (billingReady ? "Not subscribed" : "Database sync pending")}</span>
            </p>
            <p>
              Access through: <span className="font-medium text-slate-950">{formatPeriodEnd(billingState.stripeCurrentPeriodEnd)}</span>
            </p>
            <p>
              Customer record: <span className="font-medium text-slate-950">{billingState.stripeCustomerId ? "Linked" : (billingReady ? "Not linked yet" : "Unavailable")}</span>
            </p>
            {!billingReady ? (
              <p className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                Billing storage is not fully available in this deployment yet. Checkout and subscription management will stay disabled until billing data becomes readable.
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <BillingActions
              configured={billingConfigured && billingReady}
              isPremium={isPremium}
                hasCustomer={Boolean(billingState.stripeCustomerId)}
            />
          </div>
        </article>
      </section>
    </main>
  );
}

function pickSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function buildBanner(checkoutState: string, isPremium: boolean) {
  if (checkoutState === "success" && isPremium) {
    return {
      tone: "success" as const,
      message: "Premium is active for this account.",
    };
  }

  if (checkoutState === "success") {
    return {
      tone: "warning" as const,
      message: "Checkout completed. Stripe is still syncing the subscription state through the webhook.",
    };
  }

  if (checkoutState === "canceled") {
    return {
      tone: "warning" as const,
      message: "Checkout was canceled before payment completed.",
    };
  }

  return null;
}

function formatPeriodEnd(value: Date | null) {
  if (!value) {
    return "No active renewal date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
