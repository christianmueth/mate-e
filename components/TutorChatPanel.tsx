"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  TUTOR_CHAT_SESSION_CONTEXT_EVENT,
  LEGACY_TUTOR_CHAT_SESSION_CONTEXT_EVENT,
  readStoredTutorChatSessionContext,
  sanitizeTutorChatSessionContext,
  type TutorChatSessionContext,
} from "@/lib/tutorChatSessionContext";
import { readTutorChatEnabled, setTutorChatEnabled, TUTOR_CHAT_ENABLED_EVENT } from "@/lib/tutorChatPreferences";
import { readWorkspaceContext, updateWorkspaceContext, WORKSPACE_CONTEXT_EVENT, type WorkspaceContext } from "@/lib/workspaceContext";

type TutorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type TutorChatContext = {
  deckTitle: string | null;
  cardCount: number | null;
  weakConcepts: string[];
  recentSuccesses: string[];
  recentFailures: string[];
  explanationStyle: string | null;
  lowConfidenceStreak: number;
  recentGuidance: string[];
};

type TutorChatResponse = {
  ok: boolean;
  messages?: TutorChatMessage[];
  message?: TutorChatMessage;
  context?: TutorChatContext;
  error?: string;
};

const OPEN_STORAGE_KEY = "mate-e:tutor-chat-open";
const LEGACY_OPEN_STORAGE_KEY = "quickstud:tutor-chat-open";

type RecommendationAction = {
  label: string;
  prompt: string;
  tone: "primary" | "secondary";
};

type RecommendationCard = {
  title: string;
  subtitle: string;
  modeLabel: string;
  currentGoal: string;
  nextAction: string;
  risk: string;
  changes: string;
  lastWorkedOn: string;
  lastUpdated: string;
  confidence: string | null;
  actions: RecommendationAction[];
};

export default function TutorChatPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [context, setContext] = useState<TutorChatContext | null>(null);
  const [sessionContext, setSessionContext] = useState<TutorChatSessionContext | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceContext>(() => readWorkspaceContext());
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  const isWorkspaceRoute = pathname?.startsWith("/app") ?? false;
  const deckId = useMemo(() => extractDeckId(pathname), [pathname]);
  const isDeckStudyRoute = Boolean(deckId);
  const focusConcept = searchParams.get("concept");
  const focusReason = searchParams.get("reason");
  const workspaceMode = searchParams.get("workspaceMode");
  const starterPrompt = searchParams.get("starterPrompt");
  const routeKey = `${pathname || ""}?${searchParams.toString()}`;
  const activeSessionContext =
    isDeckStudyRoute && sessionContext?.deckId === deckId && !sessionContext.sessionComplete
      ? sessionContext
      : null;
  const lastStarterPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(OPEN_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_OPEN_STORAGE_KEY);
    if (stored === "0") setOpen(false);
    if (stored === "1") setOpen(true);
  }, []);

  useEffect(() => {
    if (workspaceMode === "instructional-chat" || starterPrompt) {
      setOpen(true);
    }
  }, [starterPrompt, workspaceMode]);

  useEffect(() => {
    setEnabled(readTutorChatEnabled());

    function syncEnabledState(event?: Event) {
      const detail = event && "detail" in event ? (event as CustomEvent<{ enabled?: unknown }>).detail : undefined;
      if (typeof detail?.enabled === "boolean") {
        setEnabled(detail.enabled);
        return;
      }

      setEnabled(readTutorChatEnabled());
    }

    window.addEventListener(TUTOR_CHAT_ENABLED_EVENT, syncEnabledState);
    return () => window.removeEventListener(TUTOR_CHAT_ENABLED_EVENT, syncEnabledState);
  }, []);

  useEffect(() => {
    function syncWorkspaceState(event?: Event) {
      const detail = event && "detail" in event ? (event as CustomEvent<WorkspaceContext>).detail : null;
      setWorkspaceState(detail || readWorkspaceContext());
    }

    syncWorkspaceState();
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspaceState);
    return () => window.removeEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspaceState);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
    window.localStorage.setItem(LEGACY_OPEN_STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    function syncSessionContext(nextValue: unknown) {
      setSessionContext(sanitizeTutorChatSessionContext(nextValue));
    }

    syncSessionContext(readStoredTutorChatSessionContext());

    function onSessionContext(event: Event) {
      syncSessionContext((event as CustomEvent).detail);
    }

    window.addEventListener(TUTOR_CHAT_SESSION_CONTEXT_EVENT, onSessionContext);
    window.addEventListener(LEGACY_TUTOR_CHAT_SESSION_CONTEXT_EVENT, onSessionContext);
    return () => {
      window.removeEventListener(TUTOR_CHAT_SESSION_CONTEXT_EVENT, onSessionContext);
      window.removeEventListener(LEGACY_TUTOR_CHAT_SESSION_CONTEXT_EVENT, onSessionContext);
    };
  }, []);

  useEffect(() => {
    if (!isWorkspaceRoute) return;

    let cancelled = false;
    async function loadHistory() {
      if (!cancelled) {
        setContext((current) => (deckId ? current : null));
      }
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (deckId) query.set("deckId", deckId);
        const res = await fetch(`/api/tutor-chat${query.size ? `?${query.toString()}` : ""}`, { cache: "no-store" });
        const data = (await safeJson(res)) as TutorChatResponse | null;
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "We couldn't load workspace continuity right now.");
        }
        if (!cancelled) {
          setMessages(Array.isArray(data.messages) ? data.messages : []);
          setContext(data.context || null);
        }
      } catch (error: unknown) {
        if (!cancelled) toast.error(getErrorMessage(error, "We couldn't load workspace continuity right now."));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBootstrapping(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [deckId, isWorkspaceRoute, routeKey]);

  useEffect(() => {
    updateWorkspaceContext((currentWorkspaceContext) => ({
      ...currentWorkspaceContext,
      weakConcepts: context?.weakConcepts?.length ? context.weakConcepts.slice(0, 8) : currentWorkspaceContext.weakConcepts,
      tutorMemory: {
        explanationStyle: context?.explanationStyle || currentWorkspaceContext.tutorMemory?.explanationStyle || null,
        recentGuidance: context?.recentGuidance?.length ? context.recentGuidance.slice(0, 4) : currentWorkspaceContext.tutorMemory?.recentGuidance || [],
      },
      recentTutorInteractions: messages.slice(-6).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
      currentGuidedSession: activeSessionContext
        ? {
            answerDraft: activeSessionContext.answerDraft,
            latestHint: activeSessionContext.latestCoaching?.hint || null,
            latestRationale: activeSessionContext.latestCoaching?.rationale || null,
            confidence: activeSessionContext.latestCoaching?.confidence || null,
            strategyType: activeSessionContext.latestCoaching?.strategyType || null,
            worldModelExplanation: activeSessionContext.latestCoaching?.worldModelExplanation || null,
            projectedConfidenceDelta: activeSessionContext.latestCoaching?.projectedConfidenceDelta || null,
            projectedRecoveryProbability: activeSessionContext.latestCoaching?.projectedRecoveryProbability || null,
            projectedStabilityGain: activeSessionContext.latestCoaching?.projectedStabilityGain || null,
          }
        : currentWorkspaceContext.currentGuidedSession,
    }));
  }, [activeSessionContext, context, messages]);

  useEffect(() => {
    if (!isWorkspaceRoute) return;

    const nextStarter = starterPrompt?.trim() || null;
    if (!nextStarter) {
      lastStarterPromptRef.current = null;
      return;
    }

    if (lastStarterPromptRef.current === routeKey) return;

    setOpen(true);
    setShowComposer(true);
    setDraft((current) => current.trim() ? current : nextStarter);
    lastStarterPromptRef.current = routeKey;
  }, [isWorkspaceRoute, routeKey, starterPrompt]);

  if (!isWorkspaceRoute || !enabled) return null;

  const summaryLabel = buildSummaryLabel({ pathname, deckId, deckTitle: context?.deckTitle ?? null });
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;
  const recommendation = useMemo(() => buildRecommendationCard({
    pathname,
    summaryLabel,
    workspaceState,
    context,
    deckTitle: context?.deckTitle ?? null,
    focusConcept,
    focusReason,
  }), [context, focusConcept, focusReason, pathname, summaryLabel, workspaceState]);

  async function submitMessage(prefill?: string) {
    const content = (prefill ?? draft).trim();
    if (!content || sending) return;

    const optimisticMessage: TutorChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch("/api/tutor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          path: pathname,
          deckId,
          focusConcept,
          focusReason,
          liveContext: activeSessionContext,
          workspaceContext: readWorkspaceContext(),
        }),
      });
      const data = (await safeJson(res)) as TutorChatResponse | null;
      if (!res.ok || !data?.ok || !data.message) {
        throw new Error(data?.error || "We couldn't get workspace guidance right now.");
      }
      setMessages((current) => [...current, data.message as TutorChatMessage]);
      setContext(data.context || null);
      setOpen(true);
    } catch (error: unknown) {
      setMessages((current) => current.filter((item) => item.id !== optimisticMessage.id));
      toast.error(getErrorMessage(error, "We couldn't get workspace guidance right now."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:left-auto sm:right-5 sm:w-[22rem]">
      <div className={open
        ? "pointer-events-auto w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur"
        : "pointer-events-auto"
      }>
        {open ? (
          <div>
            <div className="flex items-start justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mate-E Recommendation</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{recommendation.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{recommendation.subtitle}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Hide
              </button>
            </div>

            <div className="space-y-3 border-t border-slate-100 p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current goal</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{recommendation.currentGoal}</p>
                {recommendation.confidence ? (
                  <p className="mt-2 text-xs font-medium text-slate-600">Confidence: {recommendation.confidence}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Next action" value={recommendation.nextAction} />
                <InfoCard label="Risk" value={recommendation.risk} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace awareness</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium text-slate-950">Last working on:</span> {recommendation.lastWorkedOn}</p>
                  <p><span className="font-medium text-slate-950">Last active:</span> {recommendation.lastUpdated}</p>
                  <p><span className="font-medium text-slate-950">Changes since then:</span> {recommendation.changes}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {recommendation.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={action.tone === "primary"
                      ? "rounded-full bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      : "rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    }
                    disabled={sending}
                    onClick={() => void submitMessage(action.prompt)}
                  >
                    {sending ? "Working..." : action.label}
                  </button>
                ))}
              </div>

              {bootstrapping || loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  Loading recommendation...
                </div>
              ) : latestAssistantMessage ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommendation note</p>
                  <p className="mt-2 whitespace-pre-wrap">{latestAssistantMessage.content}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{recommendation.modeLabel}</p>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowComposer((current) => !current)}
                >
                  {showComposer ? "Hide custom" : "Custom request"}
                </button>
              </div>

              {showComposer ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitMessage();
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask for a custom recommendation"
                    className="min-h-[76px] w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      disabled={sending || !draft.trim()}
                    >
                      {sending ? "Working..." : "Ask Mate-E"}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-[15.75rem] rounded-[1.35rem] border border-slate-200 bg-white/95 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-white"
            onClick={() => setOpen(true)}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mate-E</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Next recommendation</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{recommendation.nextAction}</p>
            <p className="mt-2 text-xs text-slate-600">{recommendation.currentGoal}</p>
            <p className="mt-3 text-xs font-medium text-slate-700">Expand</p>
          </button>
        )}
      </div>
    </div>
  );
}

async function safeJson(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function extractDeckId(pathname: string | null) {
  const match = String(pathname || "").match(/^\/app\/deck\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildSummaryLabel({
  pathname,
  deckId,
  deckTitle,
}: {
  pathname: string | null;
  deckId: string | null;
  deckTitle: string | null;
}) {
  if (pathname?.startsWith("/app/workspace/whiteboard")) return "capture";
  if (pathname?.startsWith("/app/workspace/operations") || pathname?.startsWith("/app/workspace/presentations")) return "organize";
  if (pathname === "/app/workspace") return "execute";
  if (deckId) return deckTitle || "current workspace set";
  return "workspace";
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function buildRecommendationCard({
  pathname,
  summaryLabel,
  workspaceState,
  context,
  deckTitle,
  focusConcept,
  focusReason,
}: {
  pathname: string | null;
  summaryLabel: string;
  workspaceState: WorkspaceContext;
  context: TutorChatContext | null;
  deckTitle: string | null;
  focusConcept: string | null;
  focusReason: string | null;
}): RecommendationCard {
  const isCapture = pathname?.startsWith("/app/workspace/whiteboard") ?? false;
  const isOrganize = pathname?.startsWith("/app/workspace/operations") || pathname?.startsWith("/app/workspace/presentations") || false;
  const weakConcept = context?.weakConcepts[0] || workspaceState.weakConcepts[0] || null;
  const recentFailure = context?.recentFailures[0] || null;
  const latestGuidance = context?.recentGuidance[0] || workspaceState.tutorMemory?.recentGuidance?.[0] || null;
  const board = workspaceState.whiteboardReference;
  const presentation = workspaceState.presentationReference;
  const currentGoal = board?.workspaceGoal
    || presentation?.objective
    || presentation?.title
    || focusConcept
    || deckTitle
    || weakConcept
    || "Keep the current workspace moving";
  const lastWorkedOn = board?.boardName || presentation?.title || deckTitle || summaryLabel;
  const lastUpdated = formatRelativeTime(board?.updatedAt || presentation?.updatedAt || workspaceState.updatedAt);
  const confidence = typeof workspaceState.currentGuidedSession?.confidence === "number"
    ? formatPercent(workspaceState.currentGuidedSession.confidence)
    : null;
  const changes = board
    ? `${board.noteCount} notes, ${board.shapeCount} shapes, ${board.annotationCount} annotations on the active board.`
    : presentation
      ? `${presentation.outlineCount} outline point${presentation.outlineCount === 1 ? "" : "s"} in the active plan.`
      : workspaceState.uploadedAssets[0]
        ? `Latest asset: ${workspaceState.uploadedAssets[0].name}.`
        : latestGuidance
          ? `Latest guidance: ${truncateText(latestGuidance, 96)}`
          : "No new activity detected.";

  if (isCapture) {
    const nextAction = workspaceState.uploadedAssets[0]
      ? `Extract action items from ${workspaceState.uploadedAssets[0].name}`
      : board?.workspaceGoal
        ? `Summarize and structure ${board.workspaceGoal}`
        : "Turn the latest capture into tasks";
    const risk = board?.noteCount
      ? "Captured material is still loose until it becomes tasks or themes."
      : focusReason || "Raw inputs can disappear into the board if they are not structured quickly.";
    return {
      title: "Intake Assistant",
      subtitle: "Turn raw input into action.",
      modeLabel: "Capture",
      currentGoal,
      nextAction,
      risk,
      changes,
      lastWorkedOn,
      lastUpdated,
      confidence,
      actions: [
        { label: "Summarize", prompt: `Summarize the current capture around ${currentGoal} and keep it short.`, tone: "primary" },
        { label: "Categorize", prompt: `Categorize the current capture around ${currentGoal} into a few clean themes.`, tone: "secondary" },
        { label: "Extract Tasks", prompt: `Extract concrete tasks and decisions from the current capture around ${currentGoal}.`, tone: "secondary" },
        { label: "Action Items", prompt: `Generate the next action items from the current capture around ${currentGoal}.`, tone: "secondary" },
      ],
    };
  }

  if (isOrganize) {
    const nextAction = presentation?.title
      ? `Build the plan for ${presentation.title}`
      : `Turn ${currentGoal} into a working plan`;
    const risk = presentation && presentation.outlineCount < 4
      ? "The plan still looks thin and may be missing sequence or dependencies."
      : recentFailure || weakConcept || "A plan without explicit risks and timing will drift.";
    return {
      title: "Planning Assistant",
      subtitle: "Shape the current plan.",
      modeLabel: "Organize",
      currentGoal,
      nextAction,
      risk,
      changes,
      lastWorkedOn,
      lastUpdated,
      confidence,
      actions: [
        { label: "Generate Plan", prompt: `Generate a concise plan for ${currentGoal} with the fewest necessary steps.`, tone: "primary" },
        { label: "Identify Risks", prompt: `Identify the main risks and blockers for ${currentGoal}.`, tone: "secondary" },
        { label: "Build Sprint", prompt: `Build a short sprint for ${currentGoal} with the next bounded tasks.`, tone: "secondary" },
        { label: "Estimate", prompt: `Estimate the timeline and sequence for ${currentGoal}.`, tone: "secondary" },
      ],
    };
  }

  const nextAction = weakConcept
    ? `Resolve ${truncateText(weakConcept, 64)}`
    : latestGuidance
      ? truncateText(latestGuidance, 72)
      : `Do the next bounded step for ${currentGoal}`;
  const risk = recentFailure
    ? truncateText(recentFailure, 96)
    : context?.lowConfidenceStreak
      ? `${context.lowConfidenceStreak} recent low-confidence pass${context.lowConfidenceStreak === 1 ? "" : "es"}.`
      : weakConcept
        ? `Weak thread: ${truncateText(weakConcept, 88)}`
        : "No dominant blocker is recorded, so the risk is drift through indecision.";

  return {
    title: "Chief of Staff",
    subtitle: "What should happen next?",
    modeLabel: "Execute",
    currentGoal,
    nextAction,
    risk,
    changes,
    lastWorkedOn,
    lastUpdated,
    confidence,
    actions: [
      { label: "Do This", prompt: `Give me the single highest-leverage next step for ${currentGoal}. Keep it concrete.`, tone: "primary" },
      { label: "Why?", prompt: `Why is ${nextAction} the right next step for ${currentGoal}? Include blockers and rationale.`, tone: "secondary" },
      { label: "Alternative", prompt: `If I do not do ${nextAction}, what is the best alternative next step for ${currentGoal}?`, tone: "secondary" },
      { label: "Unblock", prompt: `What blocker is most likely to stall ${currentGoal}, and how should I resolve it first?`, tone: "secondary" },
    ],
  };
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Less than an hour ago";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}