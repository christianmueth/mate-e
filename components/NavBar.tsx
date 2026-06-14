// components/NavBar.tsx
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import GlobalCommandBar from "@/components/GlobalCommandBar";

const NavBarClerkControls = dynamic(() => import("@/components/NavBarClerkControls"), {
  ssr: false,
});

export default function NavBar() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <header className="sticky top-0 z-50 border-b border-teal-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg text-teal-950">
          Mate-E
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/how-adaptive-guidance-works" className="text-sm px-3 py-1.5 rounded border border-teal-200 bg-white text-teal-900 hover:bg-teal-50">
            Resources
          </Link>

          {hasClerk ? (
            <NavBarClerkControls />
          ) : (
            <Link href="/app/workspace" className="text-sm px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700">
              Open productivity workspace
            </Link>
          )}
        </div>
      </nav>
      <GlobalCommandBar />
    </header>
  );
}
