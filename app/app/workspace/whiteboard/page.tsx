import Link from "next/link";
import CreateForm from "@/components/CreateForm";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspaceWhiteboard from "@/components/WorkspaceWhiteboard";

export const dynamic = "force-dynamic";

export default function WorkspaceWhiteboardPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/whiteboard" />

      <section className="rounded-[2rem] border border-emerald-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Capture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Drop anything here.</h1>
          </div>
          <Link
            href="/app/workspace"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          >
            Back to Do
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <CreateForm defaultGenerationMode="notes" lockedGenerationMode="notes" />
      </section>

      <WorkspaceWhiteboard />
    </div>
  );
}