"use client";
import { useEffect, useState } from "react";

type Me = { ok: boolean; signedIn: boolean; xp: number; streak: number; xpToday: number; dailyGoal: number };

export default function UserStatsPill() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then(r => r.json()).then(setMe).catch(() => {});
  }, []);

  if (!me?.signedIn) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="px-2 py-1 rounded border border-teal-200 bg-teal-50 text-teal-900">Continuity {me.streak} day{me.streak===1?"":"s"}</span>
      <span className="px-2 py-1 rounded border border-teal-200 bg-white text-teal-900">Workspace active</span>
    </div>
  );
}
