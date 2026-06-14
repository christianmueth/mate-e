// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import HomeClerkAuthControls from "@/components/HomeClerkAuthControls";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextTarget = normalizeNextTarget(resolvedSearchParams.next);
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center p-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-teal-100 bg-white/70 p-8 text-center shadow-[0_24px_80px_rgba(15,118,110,0.12)] backdrop-blur space-y-6">
        {/* Logo / feature image */}
        <div className="relative mx-auto h-40 w-40 sm:h-48 sm:w-48">
          <Image
            src="/site-logo.png"
            alt="Mate-E"
            fill
            sizes="(max-width: 640px) 160px, 192px"
            className="object-contain"
            priority
          />
        </div>

        {/* Headline + subcopy always visible */}
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
          Ahoy there, I&apos;m Mate-E
        </p>
        <h1 className="text-3xl sm:text-5xl font-semibold text-teal-950">
          A calm adaptive workspace for focused work
        </h1>
        <p className="mx-auto max-w-2xl text-teal-800/80">
          Organize material, keep context across sessions, and move into the next useful work block faster.
        </p>

        <details className="mx-auto max-w-2xl rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-left text-sm text-teal-900/80">
          <summary className="cursor-pointer font-medium text-teal-950">How the workspace guidance works</summary>
          <p className="mt-3">
            Recommendations stay lightweight and explainable. The workspace suggests next steps without turning into an opaque planner.
          </p>
        </details>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/how-adaptive-guidance-works"
            className="rounded-full border border-teal-200 bg-white px-6 py-3 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            Explore resources
          </Link>

          {hasClerk ? (
            <HomeClerkAuthControls nextTarget={nextTarget} />
          ) : (
            <Link
              href="/app/workspace"
              className="rounded-full bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-700"
            >
              Open workspace
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function normalizeNextTarget(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/")) return "/app/workspace";
  if (trimmed.startsWith("//")) return "/app/workspace";
  return trimmed;
}
