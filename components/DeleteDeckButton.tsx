"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DeleteDeckButton({ deckId }: { deckId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function onAskDelete() {
    if (busy) return;
    toast("Remove this workspace?", {
      description: "This removes the workspace and everything inside it.",
      action: {
        label: "Remove",
        onClick: async () => {
          setBusy(true);
          const t = toast.loading("Removing workspace...");
          try {
            const res = await fetch(`/api/deck/${deckId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("We couldn't remove this workspace.");
            toast.success("Workspace removed");
            router.push("/app");
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message || "We couldn't remove this workspace.");
            setBusy(false);
          } finally {
            toast.dismiss(t);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 8000,
    });
  }

  return (
    <button
      onClick={onAskDelete}
      disabled={busy}
      className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-60"
    >
      {busy ? "Removing..." : "Remove workspace"}
    </button>
  );
}
