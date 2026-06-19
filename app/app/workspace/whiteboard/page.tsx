import CreateForm from "@/components/CreateForm";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspaceWhiteboard from "@/components/WorkspaceWhiteboard";

export const dynamic = "force-dynamic";

export default function WorkspaceWhiteboardPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/whiteboard" />

      <section className="rounded-[2rem] border border-emerald-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Capture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Drop anything here.</h1>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <CreateForm defaultGenerationMode="notes" lockedGenerationMode="notes" />
      </section>

      <WorkspaceWhiteboard />
    </div>
  );
}