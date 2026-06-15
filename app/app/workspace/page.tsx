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
  workspaceName: string;
  lastActive: string;
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
    select: {
      id: true,
      xp: true,
      studyStreak: true,
      xpToday: true,
      xpTodayDate: true,
      dailyGoal: true,
    },
  });

  if (!userRecord) {
    userRecord = await prisma.user.create({
      data: { clerkUserId },
      select: {
        id: true,
        xp: true,
        studyStreak: true,
        xpToday: true,
        xpTodayDate: true,
        dailyGoal: true,
      },
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
    title: `Continue ${memoryCard.workspaceName}`,
    detail: "Start with one concrete task, source, or plan so Mate-E can keep this workspace moving.",
    href: "/app/workspace/whiteboard",
    cta: "Continue working",
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <WorkspaceSectionNav currentPath="/app/workspace" />

      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-[0_24px_90px_rgba(15,23,42,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Execute</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">What should happen next?</h1>
        <div className="mt-6 rounded-[1.75rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">{primaryAction.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{"detail" in primaryAction ? primaryAction.detail : primaryAction.body}</p>
            </div>
            <Link href={primaryAction.href} className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 hover:bg-slate-100">
              {primaryAction.cta}
            </Link>
          </div>
        </div>

        {secondaryActions.length ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Need something else?</p>
            <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {secondaryActions.map((item, index) => (
              <li key={item.title} className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-slate-200">{"detail" in item ? item.detail : item.body}</p>
                  <Link href={item.href} className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">
                    {item.cta}
                  </Link>
                </div>
              </li>
            ))}
            </ol>
          </div>
        ) : null}
      </section>

      <section>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current workspace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{memoryCard.workspaceName}</h2>
          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm leading-6 text-slate-700">Last active: {memoryCard.lastActive}</p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next action</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{memoryCard.nextSuggestedStep}</p>
            <div className="mt-5">
              <Link href={primaryAction.href} className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800">
                Continue working
              </Link>
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
  const workspaceName = deriveWorkspaceName(context);

  return {
    workspaceName,
    lastActive: trimUpdatedLabel(continuityLabel),
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
      title: "Start this workspace",
      body: "Capture one concrete task, source, or plan so Mate-E can start carrying this workspace forward.",
      tone: "amber",
      href: "/app/workspace/whiteboard",
      cta: "Open Capture",
      score: 95,
    });
  }

  if (context?.whiteboardReference?.boardName) {
    const boardAgeDays = getAgeInDays(context.whiteboardReference.updatedAt);
    const boardComplexity = context.whiteboardReference.noteCount + context.whiteboardReference.shapeCount + context.whiteboardReference.annotationCount;
    const staleBoard = boardAgeDays >= 5;
    const boardScore = Math.min(96, 28 + Math.round(boardAgeDays * 8) + Math.min(18, boardComplexity));
    items.push({
      title: context.whiteboardReference.noteCount > 0
        ? `Continue ${truncateText(context.whiteboardReference.workspaceGoal || context.whiteboardReference.boardName || "workspace", 36)}`
        : `Capture new ideas`,
      body: staleBoard
        ? `This workspace has been idle since ${formatRelativeTime(context.whiteboardReference.updatedAt)}. Reopen it and decide what should move first.`
        : context.whiteboardReference.noteCount > 0
          ? `The current workspace still needs a clearer structure so the next move is obvious.`
          : `No notes have been captured yet for this workspace.`,
      tone: staleBoard ? "amber" : "emerald",
      href: "/app/workspace/whiteboard",
      cta: context.whiteboardReference.noteCount > 0 ? "Open Capture" : "Start Capture",
      score: boardScore,
    });
  }

  if (context?.presentationReference?.title) {
    const thinOutline = context.presentationReference.outlineCount < 4;
    const presentationAgeDays = getAgeInDays(context.presentationReference.updatedAt);
    const presentationScore = Math.min(92, 24 + Math.round(presentationAgeDays * 7) + (thinOutline ? 24 : 8));
    items.push({
      title: `Continue ${truncateText(context.presentationReference.title, 36)}`,
      body: thinOutline
        ? "The active presentation still needs clearer objectives and stronger structure before it is ready to use."
        : "The active presentation is already in motion. Tighten the next section while the thread is still fresh.",
      tone: thinOutline ? "amber" : "sky",
      href: "/app/workspace/presentations",
      cta: "Continue",
      score: presentationScore,
    });
  }

  if (lowConfidenceRuns > 0) {
    const lowConfidenceScore = Math.min(94, 36 + lowConfidenceRuns * 14);
    items.push({
      title: context?.presentationReference?.title
        ? `Review ${truncateText(context.presentationReference.title, 36)}`
        : context?.weakConcepts?.[0]
          ? `Clarify ${truncateText(context.weakConcepts[0], 36)}`
          : `Continue ${truncateText(deriveWorkspaceName(context), 36)}`,
      body: context?.presentationReference?.title
        ? "Confidence dropped around the active presentation, so the fastest win is to clarify what the deck is trying to accomplish."
        : "The last session ended without a clear next move, so resolve the unclear part before you widen scope again.",
      tone: "violet",
      href: context?.presentationReference?.title ? "/app/workspace/presentations" : buildWorkspaceChatHref("Help me review the recent low-confidence work and turn it into one clear next step.", "Low-confidence runs should become one bounded action."),
      cta: context?.presentationReference?.title ? "Review now" : "Resolve now",
      score: lowConfidenceScore,
    });
  }

  if (context?.recentTutorInteractions?.length) {
    const latest = context.recentTutorInteractions[context.recentTutorInteractions.length - 1];
    const tutorAgeDays = getAgeInDays(latest.createdAt);
    items.push({
      title: context?.presentationReference?.title
        ? `Continue ${truncateText(context.presentationReference.title, 36)}`
        : `Continue ${truncateText(deriveWorkspaceName(context), 36)}`,
      body: latest.role === "assistant"
        ? truncateText(latest.content, 140)
        : `Last session ended with ${truncateText(latest.content, 120)}`,
      tone: "sky",
      href: "/app/workspace?workspaceMode=instructional-chat",
      cta: "Continue",
      score: Math.max(22, 58 - Math.round(tutorAgeDays * 9)),
    });
  }

  if (!items.length && runs.length) {
    items.push({
      title: "Review workspace structure",
      body: "Recent work exists, but the next step is still not clear. Tighten this workspace until one action stands out.",
      tone: "amber",
      href: "/app/workspace/operations",
      cta: "Review now",
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
      title: `Clarify ${truncateText(context.weakConcepts[0], 40)}`,
      detail: "Turn the unclear part into a concrete plan or explanation before it keeps resurfacing.",
      href: buildWorkspaceChatHref(`Help me clarify the project issue around ${context.weakConcepts[0]} and turn it into an execution-ready plan.`, "Unclear project issues should become actionable, not just remembered."),
      cta: "Clarify now",
    });
  }

  if (lowConfidenceRuns > 0) {
    items.push({
      title: context?.presentationReference?.title
        ? `Clarify ${truncateText(context.presentationReference.title, 40)}`
        : "Review the unclear step",
      detail: context?.presentationReference?.title
        ? "The active presentation still needs a clearer objective before the next section is worth refining."
        : "The last pass ended without a clear next move, so define the next bounded step before doing anything broader.",
      href: context?.presentationReference?.title
        ? "/app/workspace/presentations"
        : buildWorkspaceChatHref("Help me review the unclear part of the current work and turn it into one concrete next step.", "The next move should be explicit and bounded."),
      cta: context?.presentationReference?.title ? "Review now" : "Define next step",
    });
  }

  if (!items.length) {
    items.push({
      title: "Start a new workspace",
      detail: "The fastest way to make Mate-E useful is to seed one active workspace you can reopen tomorrow.",
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

function buildPriorityReason(
  context: WorkspaceContext | null,
  runs: RecentRunSummary[],
  lowConfidenceRuns: number,
  nextStepLabel: string
) {
  if (context?.presentationReference?.title && lowConfidenceRuns > 0) {
    return `Confidence dropped after the last review, so ${context.presentationReference.title} should be clarified before anything else competes for attention.`;
  }
  if (context?.weakConcepts?.[0]) {
    return `${truncateText(context.weakConcepts[0], 120)} is still unresolved, so clearing that project issue will reduce repeated drift.`;
  }
  if (context?.whiteboardReference?.workspaceGoal) {
    return `${context.whiteboardReference.workspaceGoal} is already the active workspace focus. Tightening it now is the fastest path to a better next move.`;
  }
  if (runs[0]?.title) {
    return `${runs[0].title} was the latest active work. The next step should stay close to that project instead of starting something new.`;
  }
  return `${nextStepLabel} is the clearest move because the workspace still needs one active project before Mate-E can prioritize more aggressively.`;
}

function deriveWorkspaceName(context: WorkspaceContext | null) {
  const preferred = context?.presentationReference?.title
    || context?.whiteboardReference?.workspaceGoal
    || context?.whiteboardReference?.boardName
    || context?.weakConcepts?.[0]
    || null;

  if (!preferred) return "Current workspace";

  const trimmed = preferred.trim();
  if (!trimmed) return "Current workspace";
  if (/^untitled$/i.test(trimmed) || /^untitled workspace$/i.test(trimmed) || /^board$/i.test(trimmed)) {
    return "Current workspace";
  }

  return trimmed;
}

function trimUpdatedLabel(value: string) {
  return value.replace(/^Updated\s+/i, "");
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

