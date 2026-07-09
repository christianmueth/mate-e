import Link from "next/link";
import HomeClerkAuthControls from "@/components/HomeClerkAuthControls";

const coreFeatures = [
  {
    name: "Capture",
    purpose: "Reduce the effort required to begin.",
    summary: "Drop notes, files, links, and loose thoughts into one inbox. Mate-E extracts what matters and files it into the current project.",
    details: ["One inbox", "Automatic context", "No manual sorting"],
  },
  {
    name: "Plan",
    purpose: "Turn messy information into an executable strategy.",
    summary: "Mate-E turns incoming material into milestones, dependencies, priorities, timelines, and the next move worth taking.",
    details: ["Roadmaps", "Dynamic priorities", "Plans update automatically"],
  },
  {
    name: "Do",
    purpose: "Move from reminders to execution.",
    summary: "Mate-E drafts, researches, prepares, and follows through so the user can review outcomes instead of operating software.",
    details: ["Drafts work", "Performs tasks", "Configurable autonomy"],
  },
];

const designPrinciples = [
  "If it increases decisions, remove it.",
  "If it requires explanation, simplify it.",
  "If it exposes implementation, hide it.",
  "If AI is visible, make sure it needs to be.",
];

const futureProducts = [
  {
    name: "Mate-E Learn",
    summary: "Adaptive study plans, practice material, reinforcement, and tutoring that target mastery instead of memorization.",
  },
  {
    name: "Mate-E Create",
    summary: "A creative workspace that handles repetitive production work while preserving the artist's control.",
  },
  {
    name: "Mate-E OS",
    summary: "An ambient interface where intent replaces menus and applications fade into the background.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextTarget = normalizeNextTarget(resolvedSearchParams.next);
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.18),transparent_38%),linear-gradient(180deg,#f4fffd_0%,#ffffff_58%,#effcf9_100%)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2.5rem] border border-teal-100 bg-white/85 p-8 shadow-[0_28px_90px_rgba(15,118,110,0.12)] backdrop-blur sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div className="space-y-6">
              <p className="text-sm font-medium tracking-[0.08em] text-slate-500">Ahoy, I'm Mate-E</p>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-teal-950 sm:text-6xl">
                  Capture it. Plan it. Finish it.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-700 sm:text-lg">
                  Mate-E is an intelligent assistant that removes friction between intention and accomplishment. It helps you finish what you are trying to do.
                </p>
              </div>
              <Link
                href={hasClerk ? nextTarget : "/app/workspace"}
                className="block w-full max-w-2xl rounded-[1.6rem] border border-teal-200 bg-teal-50/70 px-5 py-4 text-left text-lg text-teal-950 shadow-sm transition hover:border-teal-300 hover:bg-white"
              >
                I have a thing. Help me move it forward...
              </Link>
              <div className="flex flex-wrap items-center gap-3">
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

            <div className="grid gap-3 rounded-[2rem] border border-teal-100 bg-teal-950 p-5 text-teal-50 shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Core loop</p>
              <div className="rounded-[1.25rem] bg-white/10 p-4">
                <p className="text-sm text-teal-100">Everything routes back to one question:</p>
                <p className="mt-2 text-2xl font-semibold leading-tight">Does this reduce cognitive load?</p>
              </div>
              <div className="grid gap-2 text-sm text-teal-100">
                <p>Human</p>
                <p>AI Agent</p>
                <p>Applications</p>
                <p>Result</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {coreFeatures.map((feature) => (
            <article key={feature.name} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">{feature.name}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{feature.purpose}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">{feature.summary}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {feature.details.map((detail) => (
                  <span key={detail} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {detail}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Design principles</p>
            <div className="mt-5 grid gap-3">
              {designPrinciples.map((principle) => (
                <div key={principle} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  {principle}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Product vision</p>
            <p className="mt-4 text-lg font-medium leading-8 text-slate-900">
              Applications should become invisible. Mate-E should quietly coordinate them on the user's behalf.
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              It is not another task manager or another chatbot. It is an assistant that captures what matters, plans the best path forward, and executes meaningful work with the right level of autonomy.
            </p>
          </article>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Future expansion</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                The interaction model stays the same even as the domains expand.
              </h2>
            </div>
            <div className="grid flex-1 gap-3 lg:grid-cols-3">
              {futureProducts.map((product) => (
                <article key={product.name} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-950">{product.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{product.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
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
