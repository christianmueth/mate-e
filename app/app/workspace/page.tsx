import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import CreateForm from "@/components/CreateForm";
import WorkspaceSectionNav from "@/components/WorkspaceSectionNav";
import { prisma } from "@/lib/db";
import { summarizeReasoningRuns } from "@/lib/reasoningEngine/analytics";
import { getLatestPersistedWorkspaceContext } from "@/lib/workspaceContextPersistence";
import type { WorkspaceContext } from "@/lib/workspaceContext";

export const dynamic = "force-dynamic";

type RecentRunSummary = {
  id: string;
  mode: string;
  title: string | null;
  confidence: number | null;
  trajectoryScore: number | null;
  searchDepth: number;
  beamWidth: number | null;
  candidatesGenerated: number | null;
  candidatesSelected: number | null;
  prunedCount: number | null;
  verificationApplied: boolean;
  metadata?: unknown;
  createdAt: Date;
  origin: string | null;
  deckId: string | null;
  candidates?: Array<{
    id: string;
    rank: number;
    question: string;
    answer: string;
    score: number;
    verificationConfidence: number | null;
    selected: boolean;
    pruned: boolean;
    trajectoryDepth: number;
    sourceAttempt: number | null;
    difficulty: string | null;
    createdAt: Date;
  }>;
};

type OperationsFeedItem = {
  title: string;
  body: string;
  tone: "sky" | "amber" | "emerald" | "violet";
  href: string;
  cta: string;
  score: number;
};

type FocusQueueItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

type CommandAction = {
  label: string;
  prompt: string;
  href: string;
};

type WorkspacePillar = {
  title: "Capture" | "Organize" | "Execute";
  description: string;
  includes: string[];
  href: string;
  cta: string;
  accent: string;
};

export default async function WorkspacePage() {
  const authResult = await auth().catch(() => null);
  const clerkUserId = authResult?.userId ?? null;
  if (!clerkUserId) {
    redirect(`/?next=${encodeURIComponent("/app/workspace")}`);
  }

  let userRecord = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!userRecord) {
    userRecord = await prisma.user.create({
      data: { clerkUserId },
      select: { id: true },
    });
  }

  const [persistedWorkspace, recentRuns] = await Promise.all([
    getLatestPersistedWorkspaceContext(userRecord.id).catch(() => ({ context: null, savedAt: null, runId: null })),
    prisma.reasoningRun.findMany({
      where: {
        userId: userRecord.id,
        mode: {
          notIn: ["workspace_context_state", "whiteboard_state"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        mode: true,
        title: true,
        origin: true,
        confidence: true,
        trajectoryScore: true,
        searchDepth: true,
        beamWidth: true,
        candidatesGenerated: true,
        candidatesSelected: true,
        prunedCount: true,
        verificationApplied: true,
        metadata: true,
        createdAt: true,
        deckId: true,
        candidates: {
          orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
          take: 6,
          select: {
            id: true,
            rank: true,
            question: true,
            answer: true,
            score: true,
            verificationConfidence: true,
            selected: true,
            pruned: true,
            trajectoryDepth: true,
            sourceAttempt: true,
            difficulty: true,
            createdAt: true,
          },
        },
      },
    }).catch(() => [] as RecentRunSummary[]),
  ]);

  const workspaceContext = persistedWorkspace.context;
  const analytics = summarizeReasoningRuns(recentRuns);
  const operationsFeed = buildOperationsFeed(workspaceContext, persistedWorkspace.savedAt, recentRuns, analytics.lowConfidenceRuns);
  const driftSummary = summarizeDrift(operationsFeed);
  const focusQueue = buildFocusQueue(workspaceContext, analytics.lowConfidenceRuns);
  const commandActions = buildCommandActions(workspaceContext);
  const continuityLabel = persistedWorkspace.savedAt ? formatRelativeTime(persistedWorkspace.savedAt) : "No recent context";
  const whiteboardAgeLabel = workspaceContext?.whiteboardReference?.updatedAt
    ? formatRelativeTime(workspaceContext.whiteboardReference.updatedAt)
    : "No active board";
  const uploadCount = workspaceContext?.uploadedAssets.length ?? 0;
  const primaryCommandAction = commandActions[0] ?? {
    label: "Open workspace chat",
    prompt: "Summarize the current workspace and tell me the highest-leverage next action.",
    href: "/app/workspace?workspaceMode=instructional-chat",
  };
  const organizeActions = commandActions.slice(1, 4);
  const nextActions = buildNextActions(operationsFeed, focusQueue);
  const memoryMoments = buildWorkspaceMemoryMoments(workspaceContext, continuityLabel, whiteboardAgeLabel, driftSummary, recentRuns.length);
  const workspacePillars = buildWorkspacePillars(primaryCommandAction.href);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <WorkspaceSectionNav currentPath="/app/workspace" />

      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-[0_24px_90px_rgba(15,23,42,0.28)]">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Execute</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">What are we working on?</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
              Mate-E should feel like one memory-backed chief of staff. Reopen the workspace, see what matters now, and move straight into the next useful action.
            </p>
            <Link href={primaryCommandAction.href} className="mt-6 block rounded-[1.75rem] border border-cyan-400/30 bg-white/8 p-5 shadow-inner shadow-cyan-950/30 transition hover:border-cyan-300/50 hover:bg-white/12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Ask Mate-E</p>
              <p className="mt-3 font-mono text-sm leading-7 text-emerald-200">&gt; {primaryCommandAction.prompt}</p>
              <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950">
                Open next action
              </span>
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Workspace memory</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Mate-E should never forget where the work stands.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              {memoryMoments.map((moment) => (
                <li key={moment} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  {moment}
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Continuity</p>
                <p className="mt-2 text-base font-semibold text-white">{continuityLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Capture pulse</p>
                <p className="mt-2 text-base font-semibold text-white">{whiteboardAgeLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Drift pressure</p>
                <p className="mt-2 text-base font-semibold text-white">{driftSummary.label}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {driftSummary.detail} {uploadCount} tracked asset{uploadCount === 1 ? "" : "s"} and {analytics.totalRuns} recent AI run{analytics.totalRuns === 1 ? "" : "s"} are informing this read.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Execute</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Next actions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              Start here every time. If these three actions are clear, the rest of the workspace can stay behind the scenes.
            </p>
          </div>
          <Link href="/app/progress" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
            Open deeper read
          </Link>
        </div>
        <ol className="mt-6 grid gap-3">
          {nextActions.map((item, index) => (
            <li key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{"detail" in item ? item.detail : item.body}</p>
                  </div>
                </div>
                <Link href={item.href} className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
                  {item.cta}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {workspacePillars.map((pillar) => (
          <article key={pillar.title} className={`rounded-[1.75rem] border p-6 shadow-sm ${pillar.accent}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{pillar.title}</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{pillar.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{pillar.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {pillar.includes.map((item) => (
                <li key={item} className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
            <Link href={pillar.href} className="mt-5 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/80">
              {pillar.cta}
            </Link>
            {pillar.title === "Organize" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {organizeActions.map((action) => (
                  <Link key={action.label} href={action.href} className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-950 hover:bg-cyan-50">
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section id="capture" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="px-2 pb-4 pt-2 sm:px-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Capture</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Get things into the system.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Drop in a link, notes, PDF, captions, or video. Users should not have to decide whether they are doing notes, resources, or a brain dump before they start.
          </p>
        </div>
        <CreateForm defaultGenerationMode="notes" lockedGenerationMode="notes" />
      </section>
    </div>
  );
}

function buildWorkspacePillars(executeHref: string): WorkspacePillar[] {
  return [
    {
      title: "Capture",
      description: "One place to dump thoughts, files, notes, and rough structure before the work is clean.",
      includes: ["Whiteboard", "Notes and briefings", "Resources, uploads, and brain dumps"],
      href: "/app/workspace#capture",
      cta: "Open capture area",
      accent: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50",
    },
    {
      title: "Organize",
      description: "Turn the captured mess into plans, sprints, roadmaps, and architecture without surfacing five different tools first.",
      includes: ["Operations and sprint planning", "Roadmaps and prioritization", "Architecture and presentation structure"],
      href: "/app/workspace/operations",
      cta: "Open organize",
      accent: "border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50",
    },
    {
      title: "Execute",
      description: "Use Mate-E's memory to understand what changed, what is blocked, and what deserves attention next.",
      includes: ["Continuity across sessions", "Next actions and drift detection", "Memory-backed AI guidance"],
      href: executeHref,
      cta: "Open execute",
      accent: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50",
    },
  ];
}

function buildNextActions(
  operationsFeed: OperationsFeedItem[],
  focusQueue: FocusQueueItem[]
): Array<OperationsFeedItem | FocusQueueItem> {
  if (operationsFeed.length) {
    return operationsFeed.slice(0, 3);
  }

  return focusQueue.slice(0, 3);
}

function buildWorkspaceMemoryMoments(
  context: WorkspaceContext | null,
  continuityLabel: string,
  whiteboardAgeLabel: string,
  driftSummary: { label: string; detail: string },
  recentRunCount: number
) {
  const moments: string[] = [];

  if (context?.presentationReference?.title) {
    moments.push(`Last active presentation: ${context.presentationReference.title}.`);
  }

  if (context?.whiteboardReference?.workspaceGoal) {
    moments.push(`Current board focus: ${context.whiteboardReference.workspaceGoal}.`);
  }

  moments.push(`Continuity snapshot: ${continuityLabel}.`);
  moments.push(`Capture pulse: ${whiteboardAgeLabel}.`);

  if (recentRunCount > 0) {
    moments.push(`Recent AI activity: ${recentRunCount} run${recentRunCount === 1 ? "" : "s"} informing the current read.`);
  }

  moments.push(`Drift pressure is ${driftSummary.label.toLowerCase()}.`);

  return moments.slice(0, 4);
}

function buildOperationsFeed(
  context: WorkspaceContext | null,
  savedAt: string | null,
  runs: RecentRunSummary[],
  lowConfidenceRuns: number
): OperationsFeedItem[] {
  const items: OperationsFeedItem[] = [];

  if (!savedAt) {
    items.push({
      title: "No active continuity snapshot yet",
      body: "Start with workspace chat, a board, or an operational artifact so Mate-E can begin building a persistent read of your active system.",
      tone: "amber",
      href: buildWorkspaceChatHref("Help me establish an initial operational workspace and capture the most important open threads.", "A daily feed needs a first continuity snapshot."),
      cta: "Start workspace setup",
      score: 95,
    });
  }

  if (context?.whiteboardReference?.boardName) {
    const boardAgeDays = getAgeInDays(context.whiteboardReference.updatedAt);
    const boardComplexity = context.whiteboardReference.noteCount + context.whiteboardReference.shapeCount + context.whiteboardReference.annotationCount;
    const staleBoard = boardAgeDays >= 5;
    const boardScore = Math.min(96, 28 + Math.round(boardAgeDays * 8) + Math.min(18, boardComplexity));
    items.push({
      title: staleBoard ? `${context.whiteboardReference.boardName} is drifting` : `${context.whiteboardReference.boardName} is still active`,
      body: staleBoard
        ? `The current whiteboard context has not been refreshed since ${formatRelativeTime(context.whiteboardReference.updatedAt)}. Reopen it to resolve stale structure, notes, or dependency mapping.`
        : `Your current board focus is ${context.whiteboardReference.workspaceGoal || "still undefined"}, with ${context.whiteboardReference.noteCount} notes, ${context.whiteboardReference.shapeCount} shapes, and ${context.whiteboardReference.annotationCount} annotations.` ,
      tone: staleBoard ? "amber" : "emerald",
      href: "/app/workspace/whiteboard",
      cta: "Open whiteboard",
      score: boardScore,
    });
  }

  if (context?.presentationReference?.title) {
    const thinOutline = context.presentationReference.outlineCount < 4;
    const presentationAgeDays = getAgeInDays(context.presentationReference.updatedAt);
    const presentationScore = Math.min(92, 24 + Math.round(presentationAgeDays * 7) + (thinOutline ? 24 : 8));
    items.push({
      title: thinOutline ? `${context.presentationReference.title} needs structure` : `${context.presentationReference.title} is taking shape`,
      body: thinOutline
        ? `The active presentation has ${context.presentationReference.outlineCount} outline point${context.presentationReference.outlineCount === 1 ? "" : "s"}. It likely still needs a stronger storyline, timeline, or decision framing.`
        : `The active presentation already has ${context.presentationReference.outlineCount} outline points. This is a good time to tighten sequencing and delivery support.`,
      tone: thinOutline ? "amber" : "sky",
      href: "/app/workspace/presentations",
      cta: "Open presentations",
      score: presentationScore,
    });
  }

  if (lowConfidenceRuns > 0) {
    const lowConfidenceScore = Math.min(94, 36 + lowConfidenceRuns * 14);
    items.push({
      title: `${lowConfidenceRuns} recent low-confidence run${lowConfidenceRuns === 1 ? "" : "s"}`,
      body: "Recent analysis confidence dipped below the stable threshold. Review the progress read and turn the weak thread into a deliberate next action before drift compounds.",
      tone: "violet",
      href: "/app/progress",
      cta: "Review progress",
      score: lowConfidenceScore,
    });
  }

  if (context?.recentTutorInteractions?.length) {
    const latest = context.recentTutorInteractions[context.recentTutorInteractions.length - 1];
    const tutorAgeDays = getAgeInDays(latest.createdAt);
    items.push({
      title: "Recent tutor context is available",
      body: `Latest ${latest.role === "assistant" ? "Mate-E" : "user"} turn: ${truncateText(latest.content, 140)}`,
      tone: "sky",
      href: "/app/workspace?workspaceMode=instructional-chat",
      cta: "Resume workspace chat",
      score: Math.max(22, 58 - Math.round(tutorAgeDays * 9)),
    });
  }

  if (!items.length && runs.length) {
    items.push({
      title: "Recent activity exists, but continuity is still thin",
      body: `There have been ${runs.length} recent run${runs.length === 1 ? "" : "s"}, but the workspace does not yet have a strong persisted operational snapshot. Consolidate the current thread into chat, operations, or the whiteboard.`,
      tone: "amber",
      href: "/app/workspace/operations",
      cta: "Open operations",
      score: 74,
    });
  }

  return items
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 4);
}

function buildFocusQueue(context: WorkspaceContext | null, lowConfidenceRuns: number): FocusQueueItem[] {
  const items: FocusQueueItem[] = [];

  if (context?.whiteboardReference?.workspaceGoal) {
    items.push({
      title: `Clarify: ${truncateText(context.whiteboardReference.workspaceGoal, 52)}`,
      detail: "Your board already has an active focus. Convert that into a cleaner execution model, dependency map, or decision-ready structure.",
      href: "/app/workspace/whiteboard",
      cta: "Continue board",
    });
  }

  if (context?.presentationReference?.title) {
    items.push({
      title: `Advance ${truncateText(context.presentationReference.title, 44)}`,
      detail: "Presentations are often the forcing function for clearer narrative, sequencing, and decision communication. Tighten the active draft next.",
      href: "/app/workspace/presentations",
      cta: "Open draft",
    });
  }

  if (context?.weakConcepts?.[0]) {
    items.push({
      title: `Resolve weak thread: ${truncateText(context.weakConcepts[0], 40)}`,
      detail: "A persistent weak concept is a good proxy for ambiguity that will keep resurfacing until it is turned into a concrete plan or explanation.",
      href: buildWorkspaceChatHref(`Help me resolve the weak thread around ${context.weakConcepts[0]} and turn it into an execution-ready plan.`, "Weak threads should become actionable, not just remembered."),
      cta: "Ask Mate-E",
    });
  }

  if (lowConfidenceRuns > 0) {
    items.push({
      title: "Stabilize the recent analysis loop",
      detail: `There ${lowConfidenceRuns === 1 ? "was" : "were"} ${lowConfidenceRuns} low-confidence run${lowConfidenceRuns === 1 ? "" : "s"} recently. Review why confidence dipped and lock in the next bounded action.`,
      href: "/app/progress",
      cta: "Inspect runs",
    });
  }

  if (!items.length) {
    items.push({
      title: "Create the first operational thread",
      detail: "The fastest way to make the workspace sticky is to seed one active board, one command, or one operational artifact that you can reopen tomorrow.",
      href: "/app/workspace/operations",
      cta: "Start operations",
    });
  }

  return items.slice(0, 3);
}

function buildCommandActions(context: WorkspaceContext | null): CommandAction[] {
  const boardGoal = context?.whiteboardReference?.workspaceGoal;
  const presentationTitle = context?.presentationReference?.title;

  return [
    {
      label: "Summarize workspace",
      prompt: `Summarize the current workspace, identify drift, and tell me the highest-leverage next action${boardGoal ? ` for ${boardGoal}` : ""}.`,
      href: buildWorkspaceChatHref(
        `Summarize the current workspace, identify drift, and tell me the highest-leverage next action${boardGoal ? ` for ${boardGoal}` : ""}.`,
        "The workspace homepage should route quickly into a concrete AI command."
      ),
    },
    {
      label: "Build sprint",
      prompt: `Build a sprint structure from the active workspace context${boardGoal ? ` around ${boardGoal}` : ""}, including milestones, owners, blockers, and dependencies.`,
      href: buildWorkspaceChatHref(
        `Build a sprint structure from the active workspace context${boardGoal ? ` around ${boardGoal}` : ""}, including milestones, owners, blockers, and dependencies.`,
        "Operational structuring should be one-click from the homepage."
      ),
    },
    {
      label: "Generate roadmap",
      prompt: `Generate a roadmap with phases, risks, and decision points${presentationTitle ? ` for ${presentationTitle}` : " from the current workspace context"}.`,
      href: buildWorkspaceChatHref(
        `Generate a roadmap with phases, risks, and decision points${presentationTitle ? ` for ${presentationTitle}` : " from the current workspace context"}.`,
        "Roadmap generation is a recurring operational use case."
      ),
    },
    {
      label: "Compare plans",
      prompt: "Compare the strongest execution paths in this workspace and explain the tradeoffs, dependencies, and likely bottlenecks.",
      href: buildWorkspaceChatHref(
        "Compare the strongest execution paths in this workspace and explain the tradeoffs, dependencies, and likely bottlenecks.",
        "Decision support should be a top-level AI command."
      ),
    },
    {
      label: "Visualize architecture",
      prompt: "Translate the current workspace into a visual architecture or system map and tell me what should be grouped, linked, or sequenced next.",
      href: buildWorkspaceChatHref(
        "Translate the current workspace into a visual architecture or system map and tell me what should be grouped, linked, or sequenced next.",
        "The command surface should feed directly into whiteboard-style reasoning."
      ),
    },
  ];
}

function buildWorkspaceChatHref(prompt: string, reason: string) {
  return `/app/workspace?workspaceMode=instructional-chat&starterPrompt=${encodeURIComponent(prompt)}&reason=${encodeURIComponent(reason)}`;
}

function formatRelativeTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return "Unknown";
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Updated less than an hour ago";
  if (diffHours < 24) return `Updated ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Updated ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `Updated ${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
}

function isOlderThanDays(value: string, days: number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getAgeInDays(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function summarizeDrift(items: OperationsFeedItem[]) {
  if (!items.length) {
    return {
      label: "Low",
      detail: "No strong drift signals yet.",
    };
  }

  const averageScore = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  if (averageScore >= 80) {
    return {
      label: "High",
      detail: `Average signal score is ${averageScore}, which means several active threads are stale, unstable, or under-structured.`,
    };
  }
  if (averageScore >= 55) {
    return {
      label: "Moderate",
      detail: `Average signal score is ${averageScore}, so the workspace has some healthy motion but still a few threads that need tightening.`,
    };
  }
  return {
    label: "Low",
    detail: `Average signal score is ${averageScore}, so the current workspace looks comparatively stable.`,
  };
}

