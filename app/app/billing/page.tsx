import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BillingActions from "@/components/BillingActions";
import { hasPremiumAccess } from "@/lib/billing";
import { safeUpsertUser } from "@/lib/db";
import { isStripeBillingConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type BillingPageSearchParams = Promise<{
  checkout?: string | string[];
}>;

type BillingDiagnostic = {
  step: string;
  ok: boolean;
  detail: string;
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: BillingPageSearchParams;
}) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    redirect(`/?next=${encodeURIComponent("/app/billing")}`);
  }

  const diagnostics: BillingDiagnostic[] = [];
  let checkoutState = "";
  let user: Awaited<ReturnType<typeof safeUpsertUser<{
    plan: true;
    stripeCustomerId: true;
    stripeSubscriptionStatus: true;
    stripeCurrentPeriodEnd: true;
  }>>> | null = null;
  let billingConfigured = false;

  try {
    const resolvedSearchParams = await searchParams;
    checkoutState = pickSearchParam(resolvedSearchParams.checkout);
    diagnostics.push({ step: "Search params", ok: true, detail: "Loaded billing query state." });
  } catch (error) {
    diagnostics.push({ step: "Search params", ok: false, detail: summarizeError(error) });
  }

  try {
    user = await safeUpsertUser(clerkUserId, {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
    });
    diagnostics.push({
      step: "User billing state",
      ok: true,
      detail: user ? "Billing fields loaded from the user record." : "User persistence unavailable; billing actions disabled.",
    });
  } catch (error) {
    console.error("[BillingPage] user load failed:", error);
    diagnostics.push({ step: "User billing state", ok: false, detail: summarizeError(error) });
  }

  try {
    billingConfigured = isStripeBillingConfigured();
    diagnostics.push({
      step: "Stripe environment",
      ok: true,
      detail: billingConfigured ? "Billing env vars detected." : "One or more Stripe billing env vars are missing.",
    });
  } catch (error) {
    console.error("[BillingPage] env check failed:", error);
    diagnostics.push({ step: "Stripe environment", ok: false, detail: summarizeError(error) });
  }

  const isPremium = user?.plan === "premium" || hasPremiumAccess(user?.stripeSubscriptionStatus, user?.stripeCurrentPeriodEnd);
  const banner = buildBanner(checkoutState, isPremium);
  const billingReady = Boolean(user);

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

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current plan</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isPremium ? "Premium" : "Free"}
          </h2>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>
              Stripe status: <span className="font-medium text-slate-950">{user?.stripeSubscriptionStatus || (billingReady ? "Not subscribed" : "Database sync pending")}</span>
            </p>
            <p>
              Access through: <span className="font-medium text-slate-950">{formatPeriodEnd(user?.stripeCurrentPeriodEnd ?? null)}</span>
            </p>
            <p>
              Customer record: <span className="font-medium text-slate-950">{user?.stripeCustomerId ? "Linked" : (billingReady ? "Not linked yet" : "Unavailable")}</span>
            </p>
            {!billingReady ? (
              <p className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                Billing storage is not fully available in this deployment yet. The page can load, but checkout and portal actions will stay disabled until the database schema is in sync.
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <BillingActions
              configured={billingConfigured && billingReady}
              isPremium={isPremium}
              hasCustomer={Boolean(user?.stripeCustomerId)}
            />
          </div>
        </article>

        <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Production config</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>{billingConfigured ? "Stripe billing environment variables are present." : "Stripe billing is not fully configured in this environment yet."}</p>
            <p>Expected variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PREMIUM_PRICE_ID, NEXT_PUBLIC_APP_URL.</p>
            <p>Webhook endpoint: https://mate-e.com/api/webhooks/stripe</p>
          </div>
        </aside>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Diagnostics</p>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          {diagnostics.map((item) => (
            <div key={item.step} className={item.ok ? "rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3" : "rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3"}>
              <p className="font-medium text-slate-950">{item.step}: {item.ok ? "OK" : "Issue detected"}</p>
              <p className="mt-1 text-slate-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Unknown server error.";
  }

  return "Unknown server error.";
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
