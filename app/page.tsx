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
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.12),transparent_42%),linear-gradient(180deg,#f7fffd_0%,#ffffff_100%)] px-6 py-10">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 rounded-[2.5rem] border border-teal-100 bg-white/88 p-8 text-center shadow-[0_24px_80px_rgba(15,118,110,0.10)] backdrop-blur sm:p-12">
        <Image
          src="/logo.png"
          alt="Mate-E logo"
          width={176}
          height={176}
          className="h-32 w-32 sm:h-44 sm:w-44"
          priority
        />
        <p className="text-sm font-medium tracking-[0.08em] text-slate-500">Ahoy, I'm Mate-E</p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-teal-950 sm:text-6xl">
            I help you move things forward.
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            Start with the thing you need to do. Mate-E helps you get it done.
          </p>
        </div>

        <Link
          href={hasClerk ? nextTarget : "/app/workspace"}
          className="block w-full max-w-2xl rounded-[1.6rem] border border-teal-200 bg-white px-5 py-4 text-left text-lg text-teal-950 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
        >
          I have a thing. Help me move it forward...
        </Link>

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
      </section>
    </main>
  );
}

function normalizeNextTarget(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/")) return "/app/workspace";
  if (trimmed.startsWith("//")) return "/app/workspace";
  return trimmed;
}
