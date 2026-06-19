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
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-[2rem] border border-teal-100 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,118,110,0.12)] backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-gray-500">Mate-E</p>
        <h1 className="text-3xl sm:text-5xl font-semibold text-teal-950">
          What are we working on?
        </h1>
        <Link
          href={hasClerk ? nextTarget : "/app/workspace"}
          className="w-full max-w-2xl rounded-[1.5rem] border border-teal-200 bg-white px-5 py-4 text-left text-lg text-teal-950 shadow-sm hover:bg-teal-50"
        >
          Start with a note, plan, or next action...
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-teal-900">
          <span>Capture</span>
          <span className="text-teal-300">/</span>
          <span>Organize</span>
          <span className="text-teal-300">/</span>
          <span>Execute</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {hasClerk ? (
            <HomeClerkAuthControls nextTarget={nextTarget} />
          ) : (
            <Link
              href="/app/workspace"
              className="rounded-full bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-700"
            >
              Open Mate-E
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
