"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  WORKSPACE_CONTEXT_EVENT,
  createEmptyWorkspaceContext,
  readWorkspaceContext,
  type WorkspaceContext,
} from "@/lib/workspaceContext";

type CommandPreset = {
  label: string;
  prompt: string;
  action?: {
    kind: "whiteboard";
    command: "assist" | "image" | "prefill" | "operations-execution" | "operations-task-extractor";
    intent?: "clean-sketch" | "flowchart" | "relationships" | "visualize";
  };
};

export default function GlobalCommandBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext>(() => createEmptyWorkspaceContext());

  const shouldShow = pathname.startsWith("/app");
  useEffect(() => {
    setWorkspaceContext(readWorkspaceContext());

    function handleWorkspaceContextEvent(event: Event) {
      const nextContext = (event as CustomEvent<WorkspaceContext | undefined>).detail;
      setWorkspaceContext(nextContext ?? readWorkspaceContext());
    }

    function handleStorageSync() {
      setWorkspaceContext(readWorkspaceContext());
    }

    window.addEventListener(WORKSPACE_CONTEXT_EVENT, handleWorkspaceContextEvent as EventListener);
    window.addEventListener("storage", handleStorageSync);
    return () => {
      window.removeEventListener(WORKSPACE_CONTEXT_EVENT, handleWorkspaceContextEvent as EventListener);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, []);

  const commandPresets = useMemo(
    () => buildCommandPresets(workspaceContext, pathname),
    [pathname, workspaceContext]
  );

  const contextualHint = useMemo(() => {
    if (pathname.startsWith("/app/workspace/whiteboard") && workspaceContext.whiteboardReference?.workspaceGoal) {
      return `Try: convert ${workspaceContext.whiteboardReference.workspaceGoal} into a cleaner plan, dependency map, or task system`;
    }
    if (pathname.startsWith("/app/workspace/operations")) return "Try: summarize blockers, tighten the sprint, or compare execution paths";
    if (pathname.startsWith("/app/workspace/presentations") && workspaceContext.presentationReference?.title) {
      return `Try: sharpen the narrative and decision framing for ${workspaceContext.presentationReference.title}`;
    }
    if (pathname === "/app/workspace" && workspaceContext.weakConcepts[0]) {
      return `Try: explain the drift around ${workspaceContext.weakConcepts[0]} and recommend a recovery step`;
    }
    const latestTutorInteraction = workspaceContext.recentTutorInteractions[workspaceContext.recentTutorInteractions.length - 1];
    if (latestTutorInteraction?.content) {
      return `Continue from: ${truncateText(latestTutorInteraction.content, 84)}`;
    }
    return "Ask Mate-E to summarize, plan, compare, map, or structure your current workspace";
  }, [pathname, workspaceContext]);

  const contextSummary = useMemo(() => buildContextSummary(workspaceContext), [workspaceContext]);

  if (!shouldShow) return null;

  function runPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (pathname.startsWith("/app/workspace/whiteboard")) {
      const classification = classifyWhiteboardPrompt(trimmed);
      const href = classification.kind === "operations"
        ? buildOperationsCommandHref({
            builder: classification.builder,
            objective: workspaceContext.whiteboardReference?.workspaceGoal || workspaceContext.whiteboardReference?.boardName || "Translate the current board into an operational artifact",
            sourceMaterial: trimmed,
            constraints: workspaceContext.whiteboardReference?.sourceAttachmentName
              ? `Board source: ${workspaceContext.whiteboardReference.sourceAttachmentName}`
              : undefined,
          })
        : buildWhiteboardCommandHref({
            command: classification.command,
            intent: classification.intent,
            prompt: trimmed,
            workspaceGoal: workspaceContext.whiteboardReference?.workspaceGoal || undefined,
          });
      startTransition(() => {
        router.push(href);
      });
      return;
    }
    const href = buildWorkspaceChatHref(trimmed, "The global command bar should provide immediate access to workspace actions from anywhere in the app.");
    startTransition(() => {
      router.push(href);
    });
  }

  function runPreset(preset: CommandPreset) {
    if (preset.action?.kind === "whiteboard" && pathname.startsWith("/app/workspace/whiteboard")) {
      if (preset.action.command === "operations-execution" || preset.action.command === "operations-task-extractor") {
        const href = buildOperationsCommandHref({
          builder: preset.action.command === "operations-execution" ? "execution-plan" : "task-extractor",
          objective: workspaceContext.whiteboardReference?.workspaceGoal || workspaceContext.whiteboardReference?.boardName || "Translate the current board into an operational artifact",
          sourceMaterial: preset.prompt,
          constraints: workspaceContext.whiteboardReference?.sourceAttachmentName
            ? `Board source: ${workspaceContext.whiteboardReference.sourceAttachmentName}`
            : undefined,
        });
        startTransition(() => {
          router.push(href);
        });
        return;
      }

      const href = buildWhiteboardCommandHref({
        command: preset.action.command as "assist" | "image" | "prefill",
        intent: preset.action.intent,
        prompt: preset.prompt,
        workspaceGoal: workspaceContext.whiteboardReference?.workspaceGoal || undefined,
      });
      startTransition(() => {
        router.push(href);
      });
      return;
    }
    runPrompt(preset.prompt);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runPrompt(draft);
  }

  return (
    <div className="border-t border-teal-100 bg-white/85 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:w-56">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">AI Command Center</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Global workspace actions from anywhere in the app.</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{contextSummary}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={contextualHint}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              className="rounded-full bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {isPending ? "Running..." : "Run"}
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {commandPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => runPreset(preset)}
              disabled={isPending}
              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-950 hover:bg-teal-100 disabled:opacity-60"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildWorkspaceChatHref(prompt: string, reason: string) {
  return `/app/workspace?workspaceMode=instructional-chat&starterPrompt=${encodeURIComponent(prompt)}&reason=${encodeURIComponent(reason)}`;
}

function buildCommandPresets(context: WorkspaceContext, pathname: string): CommandPreset[] {
  const whiteboardGoal = context.whiteboardReference?.workspaceGoal;
  const boardName = context.whiteboardReference?.boardName;
  const presentationTitle = context.presentationReference?.title;
  const weakConcept = context.weakConcepts[0];

  if (pathname.startsWith("/app/workspace/whiteboard")) {
    return [
      {
        label: "Clean layout",
        prompt: `Clean up the current whiteboard${whiteboardGoal ? ` for ${whiteboardGoal}` : ""} and suggest a more readable layout.`,
        action: { kind: "whiteboard", command: "assist", intent: "clean-sketch" },
      },
      {
        label: "Convert board to plan",
        prompt: `Convert the current whiteboard${whiteboardGoal ? ` about ${whiteboardGoal}` : ""} into a cleaner execution plan with dependencies, milestones, and next actions.`,
        action: { kind: "whiteboard", command: "assist", intent: "flowchart" },
      },
      {
        label: "Build timeline",
        prompt: `Turn the current whiteboard${whiteboardGoal ? ` about ${whiteboardGoal}` : ""} into an execution timeline with milestones, owners, sequencing, and critical path pressure.`,
        action: { kind: "whiteboard", command: "operations-execution" },
      },
      {
        label: "Extract tasks",
        prompt: `Extract an actionable task system from the current whiteboard${whiteboardGoal ? ` for ${whiteboardGoal}` : ""}, grouped by owner, timing, and dependency.`,
        action: { kind: "whiteboard", command: "operations-task-extractor" },
      },
      {
        label: "Map dependencies",
        prompt: `Map the most important dependencies and relationships on the current whiteboard${boardName ? ` for ${boardName}` : ""}.`,
        action: { kind: "whiteboard", command: "assist", intent: "relationships" },
      },
      {
        label: "Generate board image",
        prompt: `Generate a helpful visual for the current whiteboard${whiteboardGoal ? ` about ${whiteboardGoal}` : ""}.`,
        action: { kind: "whiteboard", command: "image" },
      },
    ];
  }

  const presets: CommandPreset[] = [
    {
      label: "Summarize workspace",
      prompt: `Summarize the current workspace${boardName ? ` around ${boardName}` : ""}, identify drift, and tell me the single highest-leverage next action.`,
    },
    {
      label: pathname.startsWith("/app/workspace/whiteboard") ? "Convert board to plan" : "Build sprint",
      prompt: pathname.startsWith("/app/workspace/whiteboard")
        ? `Convert the current whiteboard${whiteboardGoal ? ` about ${whiteboardGoal}` : ""} into a cleaner execution plan with dependencies, milestones, and next actions.`
        : `Build a sprint from the current workspace context${whiteboardGoal ? ` around ${whiteboardGoal}` : ""} with milestones, dependencies, blockers, and a practical next move.`,
    },
    {
      label: presentationTitle ? "Tighten narrative" : "Compare plans",
      prompt: presentationTitle
        ? `Tighten the narrative, sequencing, and decision framing for ${presentationTitle}, and point out what is still missing.`
        : "Compare the strongest execution paths in this workspace and explain the tradeoffs, risks, and bottlenecks.",
    },
    {
      label: weakConcept ? "Resolve weak thread" : "Visualize architecture",
      prompt: weakConcept
        ? `Help me resolve the weak thread around ${weakConcept} and turn it into a concrete plan, explanation, or next step.`
        : "Translate the current workspace into a system map and tell me what should be grouped, linked, or sequenced next.",
    },
  ];

  return presets;
}

function buildContextSummary(context: WorkspaceContext) {
  if (context.whiteboardReference?.boardName && context.presentationReference?.title) {
    return `Tracking ${context.whiteboardReference.boardName} and ${truncateText(context.presentationReference.title, 34)}.`;
  }
  if (context.whiteboardReference?.boardName) {
    return `Tracking board ${truncateText(context.whiteboardReference.boardName, 34)}.`;
  }
  if (context.presentationReference?.title) {
    return `Tracking presentation ${truncateText(context.presentationReference.title, 34)}.`;
  }
  if (context.weakConcepts[0]) {
    return `Watching weak thread ${truncateText(context.weakConcepts[0], 34)}.`;
  }
  const latestTutorInteraction = context.recentTutorInteractions[context.recentTutorInteractions.length - 1];
  if (latestTutorInteraction?.content) {
    return `Recent context: ${truncateText(latestTutorInteraction.content, 52)}`;
  }
  return "No live workspace context yet. Commands will still route into workspace chat.";
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function buildWhiteboardCommandHref(input: {
  command: "assist" | "image" | "prefill";
  prompt: string;
  intent?: "clean-sketch" | "flowchart" | "relationships" | "visualize";
  workspaceGoal?: string;
}) {
  const params = new URLSearchParams({
    whiteboardCommand: input.command,
    commandPrompt: input.prompt,
  });
  if (input.intent) {
    params.set("whiteboardIntent", input.intent);
  }
  if (input.workspaceGoal?.trim()) {
    params.set("commandGoal", input.workspaceGoal.trim());
  }
  return `/app/workspace/whiteboard?${params.toString()}`;
}

function buildOperationsCommandHref(input: {
  builder: "execution-plan" | "task-extractor";
  objective: string;
  sourceMaterial: string;
  constraints?: string;
}) {
  const params = new URLSearchParams({
    operationsBuilder: input.builder,
    objective: input.objective,
    sourceMaterial: input.sourceMaterial,
  });
  if (input.constraints?.trim()) {
    params.set("constraints", input.constraints.trim());
  }
  return `/app/workspace/operations?${params.toString()}`;
}

function classifyWhiteboardPrompt(prompt: string):
  | { kind: "whiteboard"; command: "assist" | "image" | "prefill"; intent?: "clean-sketch" | "flowchart" | "relationships" | "visualize" }
  | { kind: "operations"; builder: "execution-plan" | "task-extractor" } {
  const normalized = prompt.toLowerCase();

  if (matchesPrompt(normalized, ["image", "illustration", "diagram image", "generate visual", "render", "mockup"])) {
    return { kind: "whiteboard", command: "image" };
  }

  if (matchesPrompt(normalized, ["timeline", "milestone", "critical path", "execution plan", "sequence this", "roadmap"])) {
    return { kind: "operations", builder: "execution-plan" };
  }

  if (matchesPrompt(normalized, ["extract tasks", "task list", "todos", "to-do", "action items", "next actions", "work items"])) {
    return { kind: "operations", builder: "task-extractor" };
  }

  if (matchesPrompt(normalized, ["dependency", "dependencies", "relationship", "relationships", "connect these", "link these"])) {
    return { kind: "whiteboard", command: "assist", intent: "relationships" };
  }

  if (matchesPrompt(normalized, ["clean", "organize", "tidy", "restructure", "improve layout", "make this clearer"])) {
    return { kind: "whiteboard", command: "assist", intent: "clean-sketch" };
  }

  if (matchesPrompt(normalized, ["flowchart", "convert to plan", "turn this into a plan", "structure this", "map the flow"])) {
    return { kind: "whiteboard", command: "assist", intent: "flowchart" };
  }

  if (matchesPrompt(normalized, ["visualize", "architecture", "system map", "cluster", "group this visually"])) {
    return { kind: "whiteboard", command: "assist", intent: "visualize" };
  }

  return { kind: "whiteboard", command: "prefill" };
}

function matchesPrompt(prompt: string, phrases: string[]) {
  return phrases.some((phrase) => prompt.includes(phrase));
}