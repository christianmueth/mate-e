import Link from "next/link";
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Capture ideas before they are clean.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Use the board as a capture surface for whiteboards, notes, relationships, and rough structure. The point is to get material into Mate-E fast, then organize it later.
            </p>
          </div>
          <Link
            href="/app/workspace?workspaceMode=instructional-chat&starterPrompt=Help%20me%20plan%20a%20whiteboard%20for%20this%20topic%20with%20the%20best%20visual%20structure%2C%20labels%2C%20and%20explanation%20sequence.&reason=Whiteboard%20planning%20should%20start%20from%20instructional%20chat%20inside%20the%20workspace."
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Plan this capture with Mate-E
          </Link>
        </div>
      </section>

      <WorkspaceWhiteboard />
    </div>
  );
}