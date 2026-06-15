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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Help me make a plan.</h1>
        <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1.5">Launch Android app</span>
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1.5">Build XR demo</span>
          <span className="rounded-full border border-cyan-200 bg-white px-3 py-1.5">Create study roadmap</span>
        </div>
        <div className="mt-6">
          <Link href="/app/workspace" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white">
            Back to Execute
          </Link>
        </div>
      </section>

      <WorkspaceOperationsConsole initialBuilder={initialBuilder} initialState={initialState} simpleMode />
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
