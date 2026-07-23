"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type BillingActionsProps = {
  checkoutConfigured: boolean;
  portalConfigured: boolean;
  isPremium: boolean;
  hasCustomer: boolean;
};

export default function BillingActions({
  checkoutConfigured,
  portalConfigured,
  isPremium,
  hasCustomer,
}: BillingActionsProps) {
  const [pendingAction, setPendingAction] = useState<"checkout" | "portal" | null>(null);
  const [isPending, startTransition] = useTransition();

  function launch(endpoint: string, action: "checkout" | "portal", fallbackMessage: string) {
    if (!checkoutConfigured && action === "checkout") {
      toast.error("Stripe checkout is not configured yet.");
      return;
    }

    if (!portalConfigured && action === "portal") {
      toast.error("The billing portal is not configured yet.");
      return;
    }

    startTransition(async () => {
      setPendingAction(action);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; url?: string }
          | null;

        if (!response.ok || !payload?.url) {
          throw new Error(payload?.error || fallbackMessage);
        }

        window.location.assign(payload.url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallbackMessage);
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {!isPremium ? (
        <button
          type="button"
          onClick={() => launch("/api/billing/checkout", "checkout", "Unable to start checkout.")}
          disabled={isPending || !checkoutConfigured}
          className="rounded-full bg-teal-600 px-5 py-3 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pendingAction === "checkout" ? "Opening Checkout..." : "Upgrade to Premium"}
        </button>
      ) : null}

      {(isPremium || hasCustomer) ? (
        <button
          type="button"
          onClick={() => launch("/api/billing/portal", "portal", "Unable to open the billing portal.")}
          disabled={isPending || !portalConfigured}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {pendingAction === "portal" ? "Opening Portal..." : "Manage Subscription"}
        </button>
      ) : null}
    </div>
  );
}
