import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
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

type WorkspaceMemoryCard = {
  lastActive: string;
  youWere: string;
  nextSuggestedStep: string;
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
  const focusQueue = buildFocusQueue(workspaceContext, analytics.lowConfidenceRuns);
  const continuityLabel = persistedWorkspace.savedAt ? formatRelativeTime(persistedWorkspace.savedAt) : "No recent context";
  const nextActions = buildNextActions(operationsFeed, focusQueue);
  const memoryCard = buildWorkspaceMemoryCard(workspaceContext, continuityLabel, nextActions[0]?.title ?? "Choose the highest-leverage next action");
  const secondaryActions = nextActions.slice(1, 3);
  const primaryAction = nextActions[0] ?? {
    title: "Create the first active thread",
    detail: "Seed the workspace with one concrete task, source, or plan so tomorrow's next step is obvious.",
    href: "/app/workspace/whiteboard",
    cta: "Start working",
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <WorkspaceSectionNav currentPath="/app/workspace" />

      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-[0_24px_90px_rgba(15,23,42,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Execute</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">What should happen next?</h1>
        <div className="mt-6 rounded-[1.75rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-slate-950">
                1
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-white">{primaryAction.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{"detail" in primaryAction ? primaryAction.detail : primaryAction.body}</p>
              </div>
            </div>
            <Link href={primaryAction.href} className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 hover:bg-slate-100">
              {primaryAction.cta}
            </Link>
          </div>
        </div>

        {secondaryActions.length ? (
          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {secondaryActions.map((item, index) => (
              <li key={item.title} className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                    {index + 2}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{"detail" in item ? item.detail : item.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace memory</p>
          <div className="mt-5 space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Last active</p>
              <p className="mt-1 text-base font-semibold text-slate-950">{memoryCard.lastActive}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">You were</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{memoryCard.youWere}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next suggested step</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{memoryCard.nextSuggestedStep}</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
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

function buildWorkspaceMemoryCard(
  context: WorkspaceContext | null,
  continuityLabel: string,
  nextSuggestedStep: string
): WorkspaceMemoryCard {
  const activeThread = context?.whiteboardReference?.workspaceGoal
    || context?.presentationReference?.title
    || context?.weakConcepts?.[0]
    || "Building the current workspace thread";

  return {
    lastActive: continuityLabel,
    youWere: activeThread,
    nextSuggestedStep,
  };
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

function buildWorkspaceChatHref(prompt: string, reason: string) {
  return `/app/workspace?workspaceMode=instructional-chat&starterPrompt=${encodeURIComponent(prompt)}&reason=${encodeURIComponent(reason)}`;
}

