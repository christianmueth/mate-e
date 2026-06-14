"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BuilderId = "execution-plan" | "sprint-builder" | "risk-scan" | "task-extractor";
type FeedTone = "risk" | "attention" | "stable";

type BuildState = {
  objective: string;
  deadline: string;
  teamSize: string;
  constraints: string;
  deliverables: string;
  sourceMaterial: string;
  sprintLength: string;
  owners: string;
};

type FeedItem = {
  title: string;
  body: string;
  tone: FeedTone;
};

type SignalItem = {
  label: string;
  body: string;
};

type ExecutionPhase = {
  title: string;
  owner: string;
  window: string;
  status: "ready" | "watch" | "blocked";
  blockers: string[];
};

type SprintTask = {
  title: string;
  owner: string;
  points: number;
  dependency: string | null;
};

type RiskNode = {
  title: string;
  severity: "low" | "medium" | "high";
  impact: "localized" | "cross-team" | "critical-path";
  owner: string;
  mitigation: string;
};

type ExtractedTask = {
  title: string;
  owner: string;
  timeline: string;
  dependency: string;
  status: "new" | "sequenced" | "blocked";
};

type ArtifactBase = {
  kind: BuilderId;
  title: string;
  summary: string;
  metaLine: string;
  signal: string;
  ready: boolean;
  primaryCta: string;
  feed: FeedItem[];
};

type EmptyArtifact = ArtifactBase & {
  ready: false;
  missingInputs: string[];
};

type ExecutionArtifact = ArtifactBase & {
  kind: "execution-plan";
  ready: true;
  phases: ExecutionPhase[];
  milestones: string[];
  criticalPath: string[];
};

type SprintArtifact = ArtifactBase & {
  kind: "sprint-builder";
  ready: true;
  lanes: Array<{ label: string; tone: "neutral" | "active" | "blocked" | "complete"; tasks: SprintTask[] }>;
  capacity: string[];
};

type RiskArtifact = ArtifactBase & {
  kind: "risk-scan";
  ready: true;
  risks: RiskNode[];
  watchlist: string[];
};

type TaskArtifact = ArtifactBase & {
  kind: "task-extractor";
  ready: true;
  groups: Array<{ label: string; tasks: ExtractedTask[] }>;
  intakeSummary: string[];
};

type BuilderArtifact = EmptyArtifact | ExecutionArtifact | SprintArtifact | RiskArtifact | TaskArtifact;

const builders: Array<{
  id: BuilderId;
  label: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: "execution-plan",
    label: "Plan",
    title: "Build a plan",
    subtitle: "Generate a timeline with milestones, owners, dependencies, and critical path pressure.",
  },
  {
    id: "sprint-builder",
    label: "Sprint",
    title: "Build a sprint",
    subtitle: "Generate a live sprint board with workload distribution, blockers, and pacing.",
  },
  {
    id: "risk-scan",
    label: "Risk",
    title: "Map risk",
    subtitle: "Generate a risk map with severity, impact, mitigation, and dependency pressure.",
  },
  {
    id: "task-extractor",
    label: "Tasks",
    title: "Extract tasks",
    subtitle: "Generate an editable task system grouped by owners, timing, and dependency tags.",
  },
];

const initialState: BuildState = {
  objective: "",
  deadline: "",
  teamSize: "3",
  constraints: "",
  deliverables: "",
  sourceMaterial: "",
  sprintLength: "2 weeks",
  owners: "",
};

type WorkspaceOperationsConsoleProps = {
  initialBuilder?: BuilderId;
  initialState?: Partial<BuildState>;
};

export default function WorkspaceOperationsConsole({
  initialBuilder = "execution-plan",
  initialState: seededState,
}: WorkspaceOperationsConsoleProps) {
  const router = useRouter();
  const seededStateKey = JSON.stringify(seededState ?? {});
  const normalizedInitialBuilder = isBuilderId(initialBuilder) ? initialBuilder : "execution-plan";
  const normalizedInitialState = useMemo(() => normalizeBuildState(seededState), [seededStateKey]);
  const [activeBuilder, setActiveBuilder] = useState<BuilderId>(normalizedInitialBuilder);
  const [state, setState] = useState<BuildState>(normalizedInitialState);
  const activeBuilderConfig = builders.find((builder) => builder.id === activeBuilder) ?? builders[0];

  useEffect(() => {
    setActiveBuilder(normalizedInitialBuilder);
    setState(normalizedInitialState);
  }, [normalizedInitialBuilder, normalizedInitialState]);

  const artifact = useMemo(() => buildArtifact(activeBuilder, state), [activeBuilder, state]);
  const signals = useMemo(() => buildSignals(activeBuilder, state), [activeBuilder, state]);
  const chatHref = useMemo(() => buildWorkspaceChatHref(activeBuilder, state, artifact), [activeBuilder, artifact, state]);

  function updateField<K extends keyof BuildState>(key: K, value: BuildState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className={artifact.ready ? "grid gap-5 xl:grid-cols-[0.86fr_1.14fr]" : "grid gap-5"}>
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Organize</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {builders.map((builder) => {
            const active = builder.id === activeBuilder;
            return (
              <button
                key={builder.id}
                type="button"
                onClick={() => setActiveBuilder(builder.id)}
                className={active
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                }
              >
                {builder.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-xl font-semibold text-slate-950">{activeBuilderConfig.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{activeBuilderConfig.subtitle}</p>

          <div className="mt-4 rounded-3xl border border-cyan-200 bg-cyan-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-900">Mate-E organizing read</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {signals.map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-cyan-200 bg-white/90 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-950">{signal.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{signal.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="block text-sm font-medium text-slate-800">
              Objective
              <input
                value={state.objective}
                onChange={(event) => updateField("objective", event.target.value)}
                placeholder="Launch the migration workflow before the quarter closes"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-800">
                Deadline or timeframe
                <input
                  value={state.deadline}
                  onChange={(event) => updateField("deadline", event.target.value)}
                  placeholder="June 28"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Team size
                <input
                  value={state.teamSize}
                  onChange={(event) => updateField("teamSize", event.target.value)}
                  placeholder="5"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-800">
                Sprint length
                <select
                  value={state.sprintLength}
                  onChange={(event) => updateField("sprintLength", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="1 week">1 week</option>
                  <option value="2 weeks">2 weeks</option>
                  <option value="3 weeks">3 weeks</option>
                  <option value="4 weeks">4 weeks</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Owners or functions
                <input
                  value={state.owners}
                  onChange={(event) => updateField("owners", event.target.value)}
                  placeholder="Product, Design, Frontend, Backend"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-800">
              Deliverables
              <textarea
                value={state.deliverables}
                onChange={(event) => updateField("deliverables", event.target.value)}
                placeholder="Migration checklist, owner matrix, launch brief, rollout notes"
                className="mt-2 min-h-[96px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Constraints and blockers
              <textarea
                value={state.constraints}
                onChange={(event) => updateField("constraints", event.target.value)}
                placeholder="Vendor signoff pending, legal review, fixed rollout date, limited backend capacity"
                className="mt-2 min-h-[96px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Source notes, meetings, or docs
              <textarea
                value={state.sourceMaterial}
                onChange={(event) => updateField("sourceMaterial", event.target.value)}
                placeholder="Paste meeting notes, whiteboard summaries, or document fragments that should feed the operational surface"
                className="mt-2 min-h-[128px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push(chatHref)}
              disabled={!artifact.ready}
              className={artifact.ready
                ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                : "rounded-full bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
              }
            >
              {artifact.primaryCta}
            </button>
            <button
              type="button"
              onClick={() => setState(initialState)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Reset inputs
            </button>
          </div>
        </div>
      </div>

      {artifact.ready ? <BuilderSurface artifact={artifact} /> : null}
    </section>
  );
}

function isBuilderId(value: string): value is BuilderId {
  return builders.some((builder) => builder.id === value);
}

function normalizeBuildState(value?: Partial<BuildState>) {
  return {
    ...initialState,
    objective: typeof value?.objective === "string" ? value.objective : initialState.objective,
    deadline: typeof value?.deadline === "string" ? value.deadline : initialState.deadline,
    teamSize: typeof value?.teamSize === "string" ? value.teamSize : initialState.teamSize,
    constraints: typeof value?.constraints === "string" ? value.constraints : initialState.constraints,
    deliverables: typeof value?.deliverables === "string" ? value.deliverables : initialState.deliverables,
    sourceMaterial: typeof value?.sourceMaterial === "string" ? value.sourceMaterial : initialState.sourceMaterial,
    sprintLength: typeof value?.sprintLength === "string" ? value.sprintLength : initialState.sprintLength,
    owners: typeof value?.owners === "string" ? value.owners : initialState.owners,
  } satisfies BuildState;
}

function BuilderSurface({ artifact }: { artifact: Exclude<BuilderArtifact, EmptyArtifact> }) {
  if (artifact.kind === "execution-plan") {
    return <ExecutionPlanSurface artifact={artifact} />;
  }

  if (artifact.kind === "sprint-builder") {
    return <SprintBoardSurface artifact={artifact} />;
  }

  if (artifact.kind === "risk-scan") {
    return <RiskGraphSurface artifact={artifact} />;
  }

  return <TaskSystemSurface artifact={artifact} />;
}

function ExecutionPlanSurface({ artifact }: { artifact: ExecutionArtifact }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Plan structure</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{artifact.summary}</p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white/90 px-3 py-2 text-right text-xs text-slate-600">
            <div>{artifact.metaLine}</div>
            <div className="mt-1">{artifact.signal}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 overflow-x-auto pb-2">
          {artifact.phases.map((phase, index) => (
            <div key={`${phase.title}-${index}`} className="flex items-center gap-3">
              <div className={phase.status === "blocked"
                ? "min-w-[190px] rounded-3xl border border-rose-200 bg-rose-50 p-4"
                : phase.status === "watch"
                  ? "min-w-[190px] rounded-3xl border border-amber-200 bg-amber-50 p-4"
                  : "min-w-[190px] rounded-3xl border border-emerald-200 bg-emerald-50 p-4"
              }>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{phase.window}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{phase.title}</p>
                <p className="mt-2 text-sm text-slate-700">Owner: {phase.owner}</p>
                {phase.blockers.length ? <p className="mt-2 text-sm leading-6 text-slate-700">Blockers: {phase.blockers.join(", ")}</p> : null}
              </div>
              {index < artifact.phases.length - 1 ? <div className="text-2xl text-cyan-500">-&gt;</div> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Critical Path</p>
          <div className="mt-4 space-y-3">
            {artifact.criticalPath.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Milestones</p>
          <div className="mt-4 space-y-3">
            {artifact.milestones.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeedPanel items={artifact.feed} title="Organize signals" />
    </div>
  );
}

function SprintBoardSurface({ artifact }: { artifact: SprintArtifact }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-rose-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">Sprint structure</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{artifact.summary}</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-200 bg-white/90 px-3 py-2 text-right text-xs text-slate-600">
            <div>{artifact.metaLine}</div>
            <div className="mt-1">{artifact.signal}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {artifact.lanes.map((lane) => (
            <div key={lane.label} className={lane.tone === "blocked"
              ? "rounded-3xl border border-rose-200 bg-rose-50 p-4"
              : lane.tone === "active"
                ? "rounded-3xl border border-cyan-200 bg-cyan-50 p-4"
                : lane.tone === "complete"
                  ? "rounded-3xl border border-emerald-200 bg-emerald-50 p-4"
                  : "rounded-3xl border border-slate-200 bg-white/90 p-4"
            }>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lane.label}</p>
              <div className="mt-3 space-y-3">
                {lane.tasks.map((task) => (
                  <div key={`${lane.label}-${task.title}`} className="rounded-2xl border border-white/70 bg-white/90 px-3 py-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-950">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{task.owner} • {task.points} pts</p>
                    {task.dependency ? <p className="mt-2 text-xs text-slate-500">Dependency: {task.dependency}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Capacity Signals</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {artifact.capacity.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <FeedPanel items={artifact.feed} title="Organize signals" />
    </div>
  );
}

function RiskGraphSurface({ artifact }: { artifact: RiskArtifact }) {
  const matrix = {
    "critical-path": artifact.risks.filter((risk) => risk.impact === "critical-path"),
    "cross-team": artifact.risks.filter((risk) => risk.impact === "cross-team"),
    localized: artifact.risks.filter((risk) => risk.impact === "localized"),
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Risk map</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{artifact.summary}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-white/90 px-3 py-2 text-right text-xs text-slate-600">
            <div>{artifact.metaLine}</div>
            <div className="mt-1">{artifact.signal}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {([
            ["critical-path", "Critical path"],
            ["cross-team", "Cross-team"],
            ["localized", "Localized"],
          ] as const).map(([key, label]) => (
            <div key={key} className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <div className="mt-3 space-y-3">
                {matrix[key].map((risk) => (
                  <div key={risk.title} className={risk.severity === "high"
                    ? "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3"
                    : risk.severity === "medium"
                      ? "rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3"
                      : "rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3"
                  }>
                    <p className="text-sm font-semibold text-slate-950">{risk.title}</p>
                    <p className="mt-1 text-sm text-slate-700">Owner: {risk.owner}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{risk.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dependency Watchlist</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {artifact.watchlist.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <FeedPanel items={artifact.feed} title="Organize signals" />
    </div>
  );
}

function TaskSystemSurface({ artifact }: { artifact: TaskArtifact }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Task structure</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{artifact.summary}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2 text-right text-xs text-slate-600">
            <div>{artifact.metaLine}</div>
            <div className="mt-1">{artifact.signal}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {artifact.groups.map((group) => (
            <div key={group.label} className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
              <div className="mt-3 space-y-3">
                {group.tasks.map((task) => (
                  <div key={`${group.label}-${task.title}`} className={task.status === "blocked"
                    ? "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3"
                    : task.status === "sequenced"
                      ? "rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3"
                      : "rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  }>
                    <p className="text-sm font-semibold text-slate-950">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{task.owner} • {task.timeline}</p>
                    <p className="mt-2 text-xs text-slate-500">Dependency: {task.dependency}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Task Intake</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {artifact.intakeSummary.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <FeedPanel items={artifact.feed} title="Organize signals" />
    </div>
  );
}

function FeedPanel({ items, title }: { items: FeedItem[]; title: string }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{item.title}</p>
              <span className={item.tone === "risk"
                ? "rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-rose-700"
                : item.tone === "attention"
                  ? "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-700"
                  : "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700"
              }>
                {item.tone}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildArtifact(builderId: BuilderId, state: BuildState): BuilderArtifact {
  const readiness = getBuilderReadiness(builderId, state);
  if (!readiness.ready) {
    return buildEmptyArtifact(builderId, readiness.missingInputs);
  }

  if (builderId === "execution-plan") {
    return buildExecutionArtifact(state);
  }

  if (builderId === "sprint-builder") {
    return buildSprintArtifact(state);
  }

  if (builderId === "risk-scan") {
    return buildRiskArtifact(state);
  }

  return buildTaskArtifact(state);
}

function buildExecutionArtifact(state: BuildState): ExecutionArtifact {
  const objective = state.objective.trim();
  const deadline = state.deadline.trim() || "No deadline set";
  const owners = tokenize(state.owners);
  const deliverables = tokenize(state.deliverables);
  const constraints = tokenize(state.constraints);
  const phases = [
    { title: "Discovery", owner: owners[0] || "Product", window: "Phase 1", status: "ready" as const, blockers: constraints.slice(0, 1) },
    { title: "Design", owner: owners[1] || owners[0] || "Design", window: "Phase 2", status: constraints[0] ? "watch" as const : "ready" as const, blockers: constraints.slice(0, 2) },
    { title: "Implementation", owner: owners[2] || owners[0] || "Engineering", window: "Phase 3", status: constraints[1] ? "blocked" as const : "watch" as const, blockers: constraints.slice(1, 3) },
    { title: "Launch", owner: owners[3] || owners[0] || "Operations", window: deadline, status: "watch" as const, blockers: constraints.slice(0, 1) },
  ];

  return {
    kind: "execution-plan",
    title: "Execution timeline",
    summary: `A staged execution surface for ${objective} with milestones, owners, and dependency pressure mapped in sequence.`,
    metaLine: `${phases.length} phases • ${deadline}`,
    signal: constraints.length ? `${constraints.length} active blockers` : "dependency map forming",
    ready: true,
    primaryCta: "Refine execution in workspace chat",
    phases,
    milestones: [
      deliverables[0] ? `Ship ${deliverables[0]}` : "Lock the main deliverable",
      deliverables[1] ? `Review ${deliverables[1]}` : "Complete cross-functional review",
      deadline === "No deadline set" ? "Anchor a launch date" : `Hit ${deadline}`,
    ],
    criticalPath: [
      `Objective: ${objective}`,
      constraints[0] ? `Blocked by ${constraints[0]}` : "No blocker has been elevated yet, so dependency ownership is still soft.",
      owners[0] ? `Primary owner lane starts with ${owners[0]}` : "Assign an owner to each phase before execution starts.",
    ],
    feed: [
      { title: "Plan structure generated", body: "Phases now have owner lanes and a visible sequence instead of a prose-only plan.", tone: "stable" },
      { title: "Dependency pressure present", body: constraints[0] ? `${constraints[0]} is already affecting the downstream path.` : "The next best move is to name the first blocker explicitly.", tone: "attention" },
      { title: "Critical path exposed", body: "The execution surface now shows where the plan will stall first if dependencies are not resolved.", tone: "risk" },
    ],
  };
}

function buildSprintArtifact(state: BuildState): SprintArtifact {
  const objective = state.objective.trim();
  const deliverables = tokenize(state.deliverables);
  const owners = tokenize(state.owners);
  const constraints = tokenize(state.constraints);
  const sourceTasks = extractTaskLines(state.sourceMaterial);
  const taskTitles = sourceTasks.length ? sourceTasks : [
    deliverables[0] ? `Draft ${deliverables[0]}` : "Draft main deliverable",
    deliverables[1] ? `Review ${deliverables[1]}` : "Review implementation scope",
    "Coordinate launch readiness",
    "Run final QA and handoff",
  ];

  const tasks = taskTitles.slice(0, 8).map((title, index) => ({
    title,
    owner: owners[index % Math.max(owners.length, 1)] || ["Product", "Design", "Frontend", "Backend"][index % 4],
    points: 2 + (index % 4),
    dependency: constraints[index % Math.max(constraints.length, 1)] || null,
  }));

  return {
    kind: "sprint-builder",
    title: "Sprint structure",
    summary: `A generated sprint surface for ${objective} with backlog, active work, blocked tasks, and completed milestones split into lanes.`,
    metaLine: `${state.sprintLength} • ${tasks.length} generated tasks`,
    signal: owners.length ? `${owners.length} owner lanes detected` : "owners inferred from sprint surface",
    ready: true,
    primaryCta: "Refine sprint structure in workspace chat",
    lanes: [
      { label: "Backlog", tone: "neutral", tasks: tasks.slice(0, 2) },
      { label: "In Progress", tone: "active", tasks: tasks.slice(2, 4) },
      { label: "Blocked", tone: "blocked", tasks: tasks.slice(4, 6) },
      { label: "Completed", tone: "complete", tasks: tasks.slice(6, 8) },
    ],
    capacity: [
      `${tasks.reduce((sum, task) => sum + task.points, 0)} points staged across the sprint`,
      owners.length ? `${owners.length} explicit owner lanes are carrying the work.` : "Owner lanes are still inferred and should be confirmed.",
      constraints[0] ? `Highest pacing risk: ${constraints[0]}` : "The board is ready for a real blocker to be attached.",
    ],
    feed: [
      { title: "Sprint structure generated", body: "Work is now grouped into execution lanes instead of a flat generated text block.", tone: "stable" },
      { title: "Blocked lane needs real ownership", body: constraints[0] ? `${constraints[0]} is already occupying the blocked lane.` : "The blocked lane is still speculative until a real blocker is attached.", tone: "attention" },
      { title: "Workload pacing visible", body: "You can now see where tasks bunch together and where sprint load needs rebalancing.", tone: "risk" },
    ],
  };
}

function buildRiskArtifact(state: BuildState): RiskArtifact {
  const objective = state.objective.trim() || "current initiative";
  const constraints = tokenize(state.constraints);
  const deliverables = tokenize(state.deliverables);
  const owners = tokenize(state.owners);
  const sourceLines = tokenize(state.sourceMaterial);
  const risks: RiskNode[] = [
    {
      title: constraints[0] || "Unassigned dependency",
      severity: "high",
      impact: "critical-path",
      owner: owners[0] || "Operations",
      mitigation: "Resolve ownership and add a mitigation before the next milestone shift.",
    },
    {
      title: constraints[1] || deliverables[0] || "Cross-functional review pressure",
      severity: "medium",
      impact: "cross-team",
      owner: owners[1] || owners[0] || "Product",
      mitigation: "Move review windows earlier and tighten handoff points.",
    },
    {
      title: sourceLines[0] || "Source ambiguity",
      severity: "low",
      impact: "localized",
      owner: owners[2] || owners[0] || "Program lead",
      mitigation: "Normalize the notes into explicit decisions and task references.",
    },
  ];

  return {
    kind: "risk-scan",
    title: "Risk map",
    summary: `A visual risk surface for ${objective} with severity, impact, and mitigation grouped by operational effect.`,
    metaLine: `${risks.length} mapped risks • ${state.deadline.trim() || "open timeline"}`,
    signal: constraints.length ? `${constraints.length} blocker signals attached` : "risk map inferred from current context",
    ready: true,
    primaryCta: "Operationalize risk map in workspace chat",
    risks,
    watchlist: [
      deliverables[0] ? `Watch delivery drift around ${deliverables[0]}` : "Watch for slippage on the first deliverable",
      owners[0] ? `Watch whether ${owners[0]} becomes a single point of failure` : "Watch for unowned risk clusters",
      constraints[0] || "Watch external review dependencies",
      state.deadline.trim() ? `Watch compression into ${state.deadline.trim()}` : "Watch deadline ambiguity and escalation lag",
    ],
    feed: [
      { title: "Risk map generated", body: "Risks are now placed in a severity-impact surface instead of a simple bulleted summary.", tone: "stable" },
      { title: "Critical-path threat is visible", body: `${risks[0].title} is sitting on the critical path lane and should be mitigated first.`, tone: "risk" },
      { title: "Cross-team coordination needs attention", body: `${risks[1].title} is a coordination-level issue that can spread if not contained.`, tone: "attention" },
    ],
  };
}

function buildTaskArtifact(state: BuildState): TaskArtifact {
  const extracted = extractTaskLines(state.sourceMaterial);
  const owners = tokenize(state.owners);
  const constraints = tokenize(state.constraints);
  const deadline = state.deadline.trim() || "Unscheduled";
  const deliverableTokens = tokenize(state.deliverables);
  const taskTitles = extracted.length ? extracted : [
    deliverableTokens[0] ? `Turn ${deliverableTokens[0]} into assigned work` : "Create first operational task",
    "Assign owner and due date",
    "Link blocker to task",
    "Sequence dependencies",
  ];

  const tasks: ExtractedTask[] = taskTitles.slice(0, 9).map((title, index) => ({
    title,
    owner: owners[index % Math.max(owners.length, 1)] || ["Product", "Ops", "Design", "Engineering"][index % 4],
    timeline: index < 3 ? "This week" : index < 6 ? deadline : "Next cycle",
    dependency: constraints[index % Math.max(constraints.length, 1)] || "Needs explicit dependency tag",
    status: index === 0 ? "blocked" : index < 5 ? "sequenced" : "new",
  }));

  return {
    kind: "task-extractor",
    title: "Task system",
    summary: "A generated task surface that turns raw workspace material into grouped, owner-aware operational objects.",
    metaLine: `${tasks.length} extracted tasks • ${owners.length || 1} owner lanes`,
    signal: extracted.length ? `${extracted.length} raw task candidates detected` : "task lanes inferred from current workspace signal",
    ready: true,
    primaryCta: "Refine task system in workspace chat",
    groups: [
      { label: "Owner lanes", tasks: tasks.slice(0, 3) },
      { label: "Timed next", tasks: tasks.slice(3, 6) },
      { label: "Dependency queue", tasks: tasks.slice(6, 9) },
    ],
    intakeSummary: [
      extracted.length ? `${extracted.length} task-like lines were detected from source notes.` : "Source notes were light, so the system inferred a starter task structure.",
      constraints[0] ? `The first blocker attached is ${constraints[0]}.` : "No blocker has been attached to the extracted tasks yet.",
      state.deadline.trim() ? `Timeline pressure is anchored to ${state.deadline.trim()}.` : "Tasks still need a real scheduling boundary.",
    ],
    feed: [
      { title: "Task system generated", body: "Tasks are now grouped into operational lanes instead of appearing as a plain extracted list.", tone: "stable" },
      { title: "Owner assignment still matters", body: owners.length ? `Current owner hints: ${owners.slice(0, 3).join(", ")}.` : "Owner assignment is still inferred and should be confirmed before execution.", tone: "attention" },
      { title: "Dependency queue exposed", body: "The extracted surface now shows which tasks need dependency tagging before they can move cleanly into execution.", tone: "risk" },
    ],
  };
}

function buildSignals(builderId: BuilderId, state: BuildState): SignalItem[] {
  const objective = state.objective.trim();
  const owners = tokenize(state.owners);
  const constraints = tokenize(state.constraints);
  const deliverables = tokenize(state.deliverables);
  const sourceLines = tokenize(state.sourceMaterial);

  if (builderId === "execution-plan") {
    return [
      {
        label: objective ? "Detected initiative" : "Awaiting initiative",
        body: objective || "Add an initiative goal and the console will stage a visible timeline instead of staying idle.",
      },
      {
        label: constraints.length ? "Dependency pressure" : "Planning signal",
        body: constraints.length ? `${constraints[0]} is already shaping the critical path.` : "Add blockers, deliverables, or a deadline so Mate-E can suggest a real execution path.",
      },
    ];
  }

  if (builderId === "sprint-builder") {
    return [
      {
        label: owners.length ? "Owner lanes found" : "Owner lanes missing",
        body: owners.length ? `${owners.slice(0, 4).join(", ")} are currently carrying the sprint surface.` : "Add owners or functions and the sprint structure will stop feeling generic.",
      },
      {
        label: deliverables.length ? "Deliverables shaping board" : "Board needs deliverables",
        body: deliverables.length ? `${deliverables[0]} is anchoring the first sprint lane.` : "Add deliverables and the board will generate real work lanes instead of generic tasks.",
      },
    ];
  }

  if (builderId === "risk-scan") {
    return [
      {
        label: constraints.length ? "Blockers detected" : "Risk evidence missing",
        body: constraints.length ? `${constraints[0]} is likely the top current risk driver.` : "Paste blockers or notes and the risk map will move from empty to operational.",
      },
      {
        label: sourceLines.length ? "Workspace evidence attached" : "Context signal low",
        body: sourceLines.length ? `${Math.min(sourceLines.length, 5)} source lines are available for the risk map.` : "More source notes will make the map feel like a real operational surface instead of a generic scan.",
      },
    ];
  }

  return [
    {
      label: sourceLines.length ? "Task candidates detected" : "Awaiting source notes",
      body: sourceLines.length ? `${Math.min(sourceLines.length, 6)} source lines can be turned into structured tasks.` : "Paste meetings or docs and Mate-E will turn them into grouped operational objects.",
    },
    {
      label: owners.length ? "Owner hints present" : "Owner hints absent",
      body: owners.length ? `${owners.slice(0, 3).join(", ")} can be used to group extracted tasks.` : "Add owners to make the task system feel alive instead of generic.",
    },
  ];
}

function buildWorkspaceChatHref(builderId: BuilderId, state: BuildState, artifact: BuilderArtifact) {
  const prompt = [
    `Build a ${artifact.title.toLowerCase()} for this workspace.`,
    state.objective.trim() ? `Objective: ${state.objective.trim()}.` : null,
    state.deadline.trim() ? `Deadline: ${state.deadline.trim()}.` : null,
    state.teamSize.trim() ? `Team size: ${state.teamSize.trim()}.` : null,
    state.sprintLength.trim() ? `Sprint length: ${state.sprintLength.trim()}.` : null,
    state.owners.trim() ? `Owners/functions: ${state.owners.trim()}.` : null,
    state.deliverables.trim() ? `Deliverables: ${state.deliverables.trim()}.` : null,
    state.constraints.trim() ? `Constraints and blockers: ${state.constraints.trim()}.` : null,
    state.sourceMaterial.trim() ? `Source notes: ${truncateText(state.sourceMaterial, 900)}.` : null,
    artifact.ready
      ? builderId === "execution-plan"
        ? "Refine the current timeline into an editable dependency map with critical path and milestone updates."
        : builderId === "sprint-builder"
          ? "Refine the current sprint structure into a more accurate backlog, in-progress, blocked, and completed system."
          : builderId === "risk-scan"
            ? "Refine the current risk map into a sharper severity and mitigation system."
            : "Refine the current task system into owner-grouped, dependency-aware operational tasks."
      : "Use shared workspace context to suggest the next best operational surface for this builder.",
  ]
    .filter(Boolean)
    .join(" ");

  const params = new URLSearchParams({
    workspaceMode: "instructional-chat",
    starterPrompt: prompt,
    reason: "Operations should generate structured operational surfaces from shared workspace context, not just text outputs.",
  });

  return `/app/workspace?${params.toString()}`;
}

function getBuilderReadiness(builderId: BuilderId, state: BuildState) {
  const objective = state.objective.trim();
  const deadline = state.deadline.trim();
  const constraints = state.constraints.trim();
  const deliverables = state.deliverables.trim();
  const sourceMaterial = state.sourceMaterial.trim();
  const owners = state.owners.trim();

  if (builderId === "execution-plan") {
    const missingInputs: string[] = [];
    if (!objective) missingInputs.push("Objective");
    if (!deliverables && !constraints && !deadline && !owners && !sourceMaterial) {
      missingInputs.push("At least one planning signal: deliverables, blockers, deadline, owners, or source notes");
    }
    return { ready: missingInputs.length === 0, missingInputs };
  }

  if (builderId === "sprint-builder") {
    const missingInputs: string[] = [];
    if (!objective) missingInputs.push("Objective");
    if (!owners && !deliverables) missingInputs.push("Owners/functions or deliverables");
    return { ready: missingInputs.length === 0, missingInputs };
  }

  if (builderId === "risk-scan") {
    const missingInputs: string[] = [];
    if (!constraints && !sourceMaterial) missingInputs.push("Constraints/blockers or source notes");
    if (!deadline && !owners) missingInputs.push("Deadline or owners/functions");
    return { ready: missingInputs.length === 0, missingInputs };
  }

  const missingInputs: string[] = [];
  if (!sourceMaterial) missingInputs.push("Source notes, meetings, or docs");
  return { ready: missingInputs.length === 0, missingInputs };
}

function buildEmptyArtifact(builderId: BuilderId, missingInputs: string[]): EmptyArtifact {
  const titles: Record<BuilderId, string> = {
    "execution-plan": "Execution plan waiting for structure",
    "sprint-builder": "Sprint structure waiting for signal",
    "risk-scan": "Risk map waiting for evidence",
    "task-extractor": "Task system waiting for source notes",
  };

  const summaries: Record<BuilderId, string> = {
    "execution-plan": "Add enough planning signal for Mate-E to generate a timeline and dependency surface.",
    "sprint-builder": "Add enough sprint signal for Mate-E to generate a real work board instead of a generic template.",
    "risk-scan": "Add blockers or source notes so the console can generate an actual risk map.",
    "task-extractor": "Add source notes so the console can build grouped operational tasks instead of staying empty.",
  };

  return {
    kind: builderId,
    title: titles[builderId],
    summary: summaries[builderId],
    metaLine: "Builder idle",
    signal: `${missingInputs.length} required inputs missing`,
    ready: false,
    primaryCta: "Add inputs to activate builder",
    missingInputs,
    feed: [],
  };
}

function tokenize(value: string) {
  return value
    .split(/\r?\n|,/) 
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractTaskLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(^[-*]\s)|(^\d+[.)]\s)|\b(action|owner|deadline|blocker|follow-up|next step|ship|fix|review|prepare|decide)\b/i.test(line))
    .map((line) => line.replace(/^[-*]\s*/, ""));
}

function truncateText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}
