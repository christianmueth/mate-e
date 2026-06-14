import Link from "next/link";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspaceOperationsConsole from "@/components/WorkspaceOperationsConsole";

export const dynamic = "force-dynamic";

export default async function WorkspaceOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    operationsBuilder?: string;
    objective?: string;
    sourceMaterial?: string;
    constraints?: string;
    deliverables?: string;
    owners?: string;
    deadline?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialBuilder = normalizeBuilderId(resolvedSearchParams.operationsBuilder);
  const initialState = {
    objective: normalizeSearchValue(resolvedSearchParams.objective, 220),
    sourceMaterial: normalizeSearchValue(resolvedSearchParams.sourceMaterial, 1200),
    constraints: normalizeSearchValue(resolvedSearchParams.constraints, 400),
    deliverables: normalizeSearchValue(resolvedSearchParams.deliverables, 400),
    owners: normalizeSearchValue(resolvedSearchParams.owners, 240),
    deadline: normalizeSearchValue(resolvedSearchParams.deadline, 120),
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/operations" />

      <section className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Organize</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Turn captured work into plans, sprints, and structure.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">This is the organizing layer for Mate-E. Convert notes, boards, and source material into execution plans, sprint structures, task systems, and risk maps without changing the underlying routes yet.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/workspace?workspaceMode=instructional-chat&starterPrompt=Help%20me%20turn%20this%20workspace%20into%20an%20operational%20system%20with%20owners%2C%20milestones%2C%20dependencies%2C%20and%20risks.&reason=Operations%20should%20generate%20structured%20execution%20artifacts%20from%20shared%20workspace%20context." className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Ask Mate-E to organize this
          </Link>
          <Link href="/app/workspace" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white">
            Back to Execute
          </Link>
        </div>
      </section>

      <WorkspaceOperationsConsole initialBuilder={initialBuilder} initialState={initialState} />
    </div>
  );
}

function normalizeBuilderId(value: string | undefined) {
  return value === "execution-plan" || value === "sprint-builder" || value === "risk-scan" || value === "task-extractor"
    ? value
    : "execution-plan";
}

function normalizeSearchValue(value: string | undefined, maxLength: number) {
  if (!value) return "";
  return value.trim().slice(0, maxLength);
}
