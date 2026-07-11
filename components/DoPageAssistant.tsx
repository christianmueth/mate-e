"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { readWorkspaceContext } from "@/lib/workspaceContext";

type AssistantAction = {
  label: string;
  prompt: string;
};

type TutorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type TutorChatResponse = {
  ok: boolean;
  messages?: TutorChatMessage[];
  message?: TutorChatMessage;
  error?: string;
};

export default function DoPageAssistant({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions: AssistantAction[];
}) {
  const searchParams = useSearchParams();
  const starterPrompt = searchParams.get("starterPrompt")?.trim() || "";
  const routeKey = useMemo(() => searchParams.toString(), [searchParams]);
  const handledStarterPromptRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [latestAssistantMessage, setLatestAssistantMessage] = useState<TutorChatMessage | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const response = await fetch("/api/tutor-chat", { cache: "no-store" });
        const payload = (await safeJson(response)) as TutorChatResponse | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "We couldn't load recent guidance right now.");
        }

        const latest = [...(payload.messages || [])].reverse().find((message) => message.role === "assistant") || null;
        if (!cancelled) {
          setLatestAssistantMessage(latest);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "We couldn't load recent guidance right now."));
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [routeKey]);

  useEffect(() => {
    if (!starterPrompt) {
      handledStarterPromptRef.current = null;
      return;
    }

    if (handledStarterPromptRef.current === routeKey || sending) {
      return;
    }

    handledStarterPromptRef.current = routeKey;
    void submitMessage(starterPrompt);
  }, [routeKey, sending, starterPrompt]);

  async function submitMessage(promptOverride?: string) {
    const content = (promptOverride ?? draft).trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/tutor-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          path: "/app/workspace",
          workspaceContext: readWorkspaceContext(),
        }),
      });

      const payload = (await safeJson(response)) as TutorChatResponse | null;
      if (!response.ok || !payload?.ok || !payload.message) {
        throw new Error(payload?.error || "We couldn't generate guidance right now.");
      }

      setLatestAssistantMessage(payload.message);
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "We couldn't generate guidance right now."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI guidance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void submitMessage(action.prompt)}
            disabled={sending}
            className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Working..." : action.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ask something specific</label>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Mate-E to clarify the next move, surface the blocker, or turn the work into a plan."
          className="mt-3 min-h-[96px] w-full rounded-[1rem] border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void submitMessage()}
            disabled={sending || !draft.trim()}
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sending ? "Thinking..." : "Ask Mate-E"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest guidance</p>
        {loadingHistory ? (
          <p className="mt-3 text-sm text-slate-600">Loading recent guidance...</p>
        ) : latestAssistantMessage ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{latestAssistantMessage.content}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No guidance yet. Use one of the actions above to start.</p>
        )}
      </div>
    </section>
  );
}

async function safeJson(response: Response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}