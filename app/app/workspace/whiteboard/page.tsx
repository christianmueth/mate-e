import CreateForm from "@/components/CreateForm";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspaceWhiteboard from "@/components/WorkspaceWhiteboard";

export const dynamic = "force-dynamic";

export default function WorkspaceWhiteboardPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/whiteboard" />

      <section className="rounded-[2rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-6 py-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Capture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Drop anything here.</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5">Upload</span>
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5">Paste</span>
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5">Write</span>
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5">Sketch</span>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Capture intake</p>
        <div className="mt-5">
          <CreateForm defaultGenerationMode="notes" lockedGenerationMode="notes" />
        </div>
      </section>

      <WorkspaceWhiteboard />
    </div>
  );
}