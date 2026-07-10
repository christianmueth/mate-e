"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function NavBarClerkControls() {
  return (
    <>
      <SignedIn>
        <Link href="/app/workspace" className="text-sm px-3 py-1.5 rounded border border-teal-200 bg-white text-teal-900 hover:bg-teal-50 md:hidden">
          Execute
        </Link>
      </SignedIn>

      <Suspense fallback={<SignedOutAuthButtons nextTarget="/app/workspace" />}>
        <SignedOutAuthButtonsFromLocation />
      </Suspense>

      <SignedIn>
        <Link href="/app/billing" className="text-sm px-3 py-1.5 rounded border border-teal-200 bg-white text-teal-900 hover:bg-teal-50">
          Billing
        </Link>
      </SignedIn>

      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}

function SignedOutAuthButtonsFromLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextTarget = buildAuthRedirectTarget(pathname, searchParams);
  return <SignedOutAuthButtons nextTarget={nextTarget} />;
}

function SignedOutAuthButtons({ nextTarget }: { nextTarget: string }) {
  return (
    <SignedOut>
      <SignInButton mode="modal" forceRedirectUrl={nextTarget} signUpForceRedirectUrl={nextTarget}>
        <button className="text-sm px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700">Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl={nextTarget} signInForceRedirectUrl={nextTarget}>
        <button className="text-sm px-3 py-1.5 rounded border border-teal-200 bg-white text-teal-900 hover:bg-teal-50">Create account</button>
      </SignUpButton>
    </SignedOut>
  );
}

function buildAuthRedirectTarget(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
) {
  if (pathname === "/") {
    const requestedTarget = searchParams.get("next");
    return normalizeNextTarget(requestedTarget);
  }

  const query = searchParams.toString();
  return normalizeNextTarget(query ? `${pathname}?${query}` : pathname);
}

function normalizeNextTarget(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/")) return "/app/workspace";
  if (trimmed.startsWith("//")) return "/app/workspace";
  return trimmed;
}