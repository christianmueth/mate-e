import { getCurrentProjectFrame } from "@/lib/currentProject";
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
  const { projectName } = await getCurrentProjectFrame();
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
      <WorkspaceSectionNav currentPath="/app/workspace/operations" projectName={projectName} />

      <section className="rounded-[2rem] border border-cyan-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Plan</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Break this down.</h1>
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
