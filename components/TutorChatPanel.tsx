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
import { readWorkspaceContext, updateWorkspaceContext } from "@/lib/workspaceContext";

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
  const [draft, setDraft] = useState("");
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  const isWorkspaceRoute = pathname?.startsWith("/app") ?? false;
  const isWhiteboardRoute = pathname?.startsWith("/app/workspace/whiteboard") ?? false;
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
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, open]);

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
    setDraft((current) => current.trim() ? current : nextStarter);
    lastStarterPromptRef.current = routeKey;
  }, [isWorkspaceRoute, routeKey, starterPrompt]);

  if (!isWorkspaceRoute || !enabled || isWhiteboardRoute) return null;

  const summaryLabel = buildSummaryLabel({ pathname, deckId, deckTitle: context?.deckTitle ?? null });

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

  const visibleMessages = messages.slice(-4);
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:left-auto sm:right-5 sm:w-[20rem]">
      <div className={open
        ? "pointer-events-auto overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur"
        : "pointer-events-auto"
      }>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Chat</p>
            <p className="truncate text-sm text-slate-700">{summaryLabel}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Close" : "Open"}
          </button>
        </div>

        {open ? (
          <div className="space-y-3 border-t border-slate-100 p-4">
            {latestAssistantMessage && !visibleMessages.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                <p className="mt-1">{latestAssistantMessage.content}</p>
              </div>
            ) : null}

            <div ref={messageViewportRef} className="max-h-[14rem] space-y-2 overflow-y-auto pr-1">
              {bootstrapping || loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  Loading...
                </div>
              ) : visibleMessages.length ? (
                visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "assistant"
                      ? "mr-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700"
                      : "ml-6 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900"
                    }
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                  No messages yet.
                </div>
              )}
            </div>

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
                placeholder="Message"
                className="min-h-[76px] w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={sending || !draft.trim()}
                >
                  {sending ? "Thinking..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            type="button"
            className="h-11 w-11 rounded-full border border-slate-200 bg-white/92 text-xs font-medium text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-white"
            onClick={() => setOpen(true)}
          >
            Chat
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
  if (pathname === "/app/progress") return "progress view";
  if (deckId) return deckTitle || "current workspace set";
  return "workspace";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}