"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";

export default function HomeClerkAuthControls({ nextTarget }: { nextTarget: string }) {
  return (
    <>
      <SignedOut>
        <SignUpButton
          mode="modal"
          forceRedirectUrl={nextTarget}
          signInForceRedirectUrl={nextTarget}
        >
          <button className="rounded-full bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-700">
            Start focused work
          </button>
        </SignUpButton>
        <SignInButton
          mode="modal"
          forceRedirectUrl={nextTarget}
          signUpForceRedirectUrl={nextTarget}
        >
          <button className="rounded-full border border-teal-200 bg-white px-6 py-3 text-sm font-medium text-teal-900 hover:bg-teal-50">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <Link
          href="/app/workspace"
          className="rounded-full bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-700"
        >
          Open productivity workspace
        </Link>
      </SignedIn>
    </>
  );
}