import Link from "next/link";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import WorkspacePresentationPlanner from "@/components/WorkspacePresentationPlanner";
import { getCurrentProjectFrame } from "@/lib/currentProject";

export const dynamic = "force-dynamic";

export default async function WorkspacePresentationsPage() {
  const { projectName } = await getCurrentProjectFrame();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <WorkspaceSectionNav currentPath="/app/workspace/presentations" projectName={projectName} />

      <section className="rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Organize</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Shape the story, structure, and decision flow.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
          Use this organizing surface to turn captured notes and source material into a narrative structure, outline, and delivery flow. Mate-E should help organize the presentation without pretending to author it for you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/app/workspace?workspaceMode=instructional-chat&starterPrompt=Help%20me%20build%20a%20presentation%20outline%20from%20my%20current%20workspace%20materials%2C%20with%20slide%20flow%2C%20speaker%20guidance%2C%20and%20suggested%20visuals.&reason=Presentation%20building%20should%20be%20a%20guided%20workspace%20feature%20separate%20from%20prompt%20generation."
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Ask Mate-E to organize the narrative
          </Link>
          <Link href="/app/workspace" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white">
            Back to Execute
          </Link>
        </div>
      </section>

      <WorkspacePresentationPlanner />
    </div>
  );
}