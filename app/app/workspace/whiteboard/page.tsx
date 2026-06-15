import Link from "next/link";
import CreateForm from "@/components/CreateForm";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspaceWhiteboard from "@/components/WorkspaceWhiteboard";

export const dynamic = "force-dynamic";

export default function WorkspaceWhiteboardPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/whiteboard" />

      <section className="rounded-[2rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
          <Link
            href="/app/workspace?workspaceMode=instructional-chat&starterPrompt=Help%20me%20plan%20a%20whiteboard%20for%20this%20topic%20with%20the%20best%20visual%20structure%2C%20labels%2C%20and%20explanation%20sequence.&reason=Whiteboard%20planning%20should%20start%20from%20instructional%20chat%20inside%20the%20workspace."
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Ask about this capture
          </Link>
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