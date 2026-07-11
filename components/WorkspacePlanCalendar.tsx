"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  readWorkspaceContext,
  updateWorkspaceContext,
  type WorkspacePlanScheduleItem,
} from "@/lib/workspaceContext";
import type { UsageEntitlement } from "@/lib/subscriptionAccess";

type ExecutionPhase = {
  title: string;
  owner: string;
  window: string;
  status: "ready" | "watch" | "blocked";
  blockers: string[];
};

type ExecutionArtifact = {
  kind: "execution-plan";
  title: string;
  summary: string;
  metaLine: string;
  signal: string;
  ready: true;
  primaryCta: string;
  phases: ExecutionPhase[];
  milestones: string[];
  criticalPath: string[];
  feed: Array<{ title: string; body: string; tone: "risk" | "attention" | "stable" }>;
};

type ScheduleItem = WorkspacePlanScheduleItem;
type ScheduleAssistIntent = "optimize" | "conflicts" | "compress";

type ScheduleAssistResponse = {
  ok: boolean;
  suggestion?: {
    summary: string;
    insights: string[];
    items: ScheduleItem[];
  };
  entitlement?: UsageEntitlement | null;
  error?: string;
};

type TimelineDragState =
  | {
      kind: "move";
      itemId: string;
      startY: number;
      originStartMinutes: number;
      durationMinutes: number;
    }
  | {
      kind: "resize";
      itemId: string;
      startY: number;
      originEndMinutes: number;
      startMinutes: number;
    };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 21;
const TIMELINE_HOUR_HEIGHT = 64;
const SNAP_MINUTES = 30;

export default function WorkspacePlanCalendar({ artifact }: { artifact: ExecutionArtifact }) {
  const scheduleKey = slugify(artifact.title || "workspace-schedule");
  const seedKey = JSON.stringify({
    title: artifact.title,
    phases: artifact.phases,
    milestones: artifact.milestones,
    criticalPath: artifact.criticalPath,
  });
  const [items, setItems] = useState<ScheduleItem[]>(() => getSeededScheduleItems(artifact));
  const [selectedId, setSelectedId] = useState<string | null>(() => getSeededScheduleItems(artifact)[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [assistLoading, setAssistLoading] = useState<ScheduleAssistIntent | null>(null);
  const [assistSummary, setAssistSummary] = useState(artifact.summary);
  const [assistInsights, setAssistInsights] = useState<string[]>(artifact.criticalPath.slice(0, 3));
  const [entitlement, setEntitlement] = useState<UsageEntitlement | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const seeded = getSeededScheduleItems(artifact)[0];
    return startOfMonth(parseDateInput(seeded?.date) || new Date());
  });
  const timelineDragRef = useRef<TimelineDragState | null>(null);

  useEffect(() => {
    const nextItems = getSeededScheduleItems(artifact);
    setItems(nextItems);
    setSelectedId(nextItems[0]?.id ?? null);
    setVisibleMonth(startOfMonth(parseDateInput(nextItems[0]?.date) || new Date()));
    setAssistSummary(artifact.summary);
    setAssistInsights(artifact.criticalPath.slice(0, 3));
  }, [seedKey, artifact]);

  useEffect(() => {
    updateWorkspaceContext((current) => ({
      ...current,
      planSchedule: {
        title: scheduleKey,
        items,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [items, scheduleKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntitlement() {
      try {
        const response = await fetch("/api/workspace/schedule-assist", { method: "GET", cache: "no-store" });
        const data = (await safeJson(response)) as ScheduleAssistResponse | null;
        if (!cancelled && response.ok && data?.entitlement) {
          setEntitlement(data.entitlement);
        }
      } catch {
        return;
      }
    }

    void loadEntitlement();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const current = timelineDragRef.current;
      if (!current) return;
      const deltaMinutes = Math.round(((event.clientY - current.startY) / (TIMELINE_HOUR_HEIGHT / 60)) / SNAP_MINUTES) * SNAP_MINUTES;

      if (current.kind === "move") {
        const nextStart = clampMinutes(current.originStartMinutes + deltaMinutes, TIMELINE_START_HOUR * 60, TIMELINE_END_HOUR * 60 - current.durationMinutes);
        const nextEnd = nextStart + current.durationMinutes;
        updateItemById(current.itemId, {
          start: toTimeString(nextStart),
          end: toTimeString(nextEnd),
        });
        return;
      }

      const nextEnd = clampMinutes(current.originEndMinutes + deltaMinutes, current.startMinutes + SNAP_MINUTES, TIMELINE_END_HOUR * 60);
      updateItemById(current.itemId, {
        end: toTimeString(nextEnd),
      });
    }

    function handlePointerUp() {
      timelineDragRef.current = null;
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`)),
    [items]
  );
  const selectedItem = sortedItems.find((item) => item.id === selectedId) || sortedItems[0] || null;
  const selectedDate = selectedItem?.date || sortedItems[0]?.date || toDateInputValue(new Date());
  const dayItems = sortedItems.filter((item) => item.date === selectedDate);
  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const timelineHours = useMemo(
    () => Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, index) => TIMELINE_START_HOUR + index),
    []
  );

  function updateItemById(itemId: string, patch: Partial<ScheduleItem>) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function updateSelectedItem(patch: Partial<ScheduleItem>) {
    if (!selectedItem) return;
    updateItemById(selectedItem.id, patch);
  }

  function addEvent() {
    const anchorDate = selectedDate || toDateInputValue(new Date());
    const nextItem: ScheduleItem = {
      id: `custom-${Date.now()}`,
      title: "New schedule block",
      date: anchorDate,
      start: "13:00",
      end: "14:00",
      owner: selectedItem?.owner || "Owner",
      lane: "task",
      notes: "",
      status: "ready",
    };
    setItems((current) => [...current, nextItem]);
    setSelectedId(nextItem.id);
    const parsed = parseDateInput(anchorDate);
    if (parsed) {
      setVisibleMonth(startOfMonth(parsed));
    }
  }

  function moveItemToDate(itemId: string, nextDate: string) {
    updateItemById(itemId, { date: nextDate });
    setSelectedId(itemId);
    const parsed = parseDateInput(nextDate);
    if (parsed) {
      setVisibleMonth(startOfMonth(parsed));
    }
  }

  function removeSelectedItem() {
    if (!selectedItem) return;
    const nextItems = sortedItems.filter((item) => item.id !== selectedItem.id);
    setItems(nextItems);
    setSelectedId(nextItems[0]?.id ?? null);
  }

  async function runAssist(intent: ScheduleAssistIntent) {
    setAssistLoading(intent);
    try {
      const response = await fetch("/api/workspace/schedule-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          objective: artifact.title,
          summary: assistSummary,
          items: sortedItems,
          workspaceContext: readWorkspaceContext(),
        }),
      });
      const data = (await safeJson(response)) as ScheduleAssistResponse | null;
      if (!response.ok || !data?.ok || !data.suggestion) {
        if (data?.entitlement) setEntitlement(data.entitlement);
        throw new Error(data?.error || "AI schedule assist is unavailable right now.");
      }
      setItems(data.suggestion.items);
      setSelectedId(data.suggestion.items[0]?.id ?? null);
      setAssistSummary(data.suggestion.summary);
      setAssistInsights(data.suggestion.insights);
      setEntitlement(data.entitlement || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI schedule assist is unavailable right now.");
    } finally {
      setAssistLoading(null);
    }
  }

  function downloadCalendar() {
    const ics = buildIcsFile(sortedItems, artifact);
    downloadTextFile(`${slugify(artifact.title || "workspace-schedule")}.ics`, ics, "text/calendar;charset=utf-8");
  }

  function downloadReport() {
    const report = buildScheduleReport(sortedItems, artifact, assistSummary, assistInsights);
    downloadTextFile(`${slugify(artifact.title || "workspace-schedule")}-report.md`, report, "text/markdown;charset=utf-8");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">AI-augmented schedule</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{assistSummary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-cyan-200 bg-white/90 px-3 py-1">{artifact.metaLine}</span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">{artifact.signal}</span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">Editable calendar</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addEvent} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
              Add block
            </button>
            <button type="button" onClick={downloadCalendar} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
              Download calendar
            </button>
            <button type="button" onClick={downloadReport} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Download report
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAssist("optimize")}
            disabled={assistLoading !== null || Boolean(entitlement?.locked)}
            className="rounded-full border border-cyan-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-50 disabled:opacity-60"
          >
            {assistLoading === "optimize" ? "Optimizing..." : "AI optimize week"}
          </button>
          <button
            type="button"
            onClick={() => void runAssist("conflicts")}
            disabled={assistLoading !== null || Boolean(entitlement?.locked)}
            className="rounded-full border border-cyan-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-50 disabled:opacity-60"
          >
            {assistLoading === "conflicts" ? "Checking..." : "AI find conflicts"}
          </button>
          <button
            type="button"
            onClick={() => void runAssist("compress")}
            disabled={assistLoading !== null || Boolean(entitlement?.locked)}
            className="rounded-full border border-cyan-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-50 disabled:opacity-60"
          >
            {assistLoading === "compress" ? "Compressing..." : "AI compress plan"}
          </button>
        </div>

        {entitlement ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={entitlement.locked ? "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-800" : "rounded-full border border-cyan-200 bg-white px-3 py-1 text-slate-700"}>
              {entitlement.remaining === null ? "Unlimited AI assists" : `${entitlement.remaining} schedule assists left today`}
            </span>
            <p className={entitlement.locked ? "text-amber-800" : "text-slate-600"}>{entitlement.message}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Calendar</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{formatMonthLabel(visibleMonth)}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Prev</button>
                <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Next</button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
              ))}
              {monthCells.map((day) => {
                const dayScheduleItems = sortedItems.filter((item) => item.date === day.isoDate);
                const dayIsVisible = day.date.getMonth() === visibleMonth.getMonth();
                const dayConflictCount = getConflictCount(dayScheduleItems);
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    onClick={() => {
                      setVisibleMonth(startOfMonth(day.date));
                      if (dayScheduleItems[0]) setSelectedId(dayScheduleItems[0].id);
                    }}
                    onDragOver={(event) => {
                      if (!draggingId) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!draggingId) return;
                      event.preventDefault();
                      moveItemToDate(draggingId, day.isoDate);
                      setDraggingId(null);
                    }}
                    className={dayIsVisible
                      ? dayConflictCount > 0
                        ? "min-h-[120px] rounded-[1.25rem] border border-rose-300 bg-rose-50/40 p-2 text-left hover:border-rose-400"
                        : "min-h-[120px] rounded-[1.25rem] border border-slate-200 bg-white p-2 text-left hover:border-cyan-300 hover:bg-cyan-50/40"
                      : "min-h-[120px] rounded-[1.25rem] border border-slate-100 bg-slate-50/70 p-2 text-left text-slate-400"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{day.date.getDate()}</span>
                      <div className="flex items-center gap-1">
                        {dayConflictCount > 0 ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">{dayConflictCount} conflict{dayConflictCount === 1 ? "" : "s"}</span> : null}
                        {dayScheduleItems.length ? <span className="text-[11px] text-slate-500">{dayScheduleItems.length}</span> : null}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayScheduleItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingId(item.id)}
                          onDragEnd={() => setDraggingId(null)}
                          className={badgeClassName(item.status)}
                        >
                          {item.start} {item.title}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Agenda</p>
            <div className="mt-4 space-y-3">
              {sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  draggable
                  onDragStart={() => setDraggingId(item.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={selectedItem?.id === item.id ? "w-full rounded-[1.25rem] border border-cyan-300 bg-cyan-50 px-4 py-3 text-left" : "w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-white"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{formatAgendaDate(item.date)} • {item.start}-{item.end}</p>
                    </div>
                    <span className="text-xs text-slate-500">{item.owner}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Day timeline</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatAgendaDate(selectedDate)}</p>
              </div>
              <p className="text-xs text-slate-500">Drag blocks. Drag lower edge to resize.</p>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
              <div className="relative" style={{ height: `${(TIMELINE_END_HOUR - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT}px` }}>
                {timelineHours.map((hour, index) => (
                  <div key={hour} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${index * TIMELINE_HOUR_HEIGHT}px` }}>
                    <span className="-translate-y-1/2 inline-block bg-slate-50 pr-2 text-[11px] font-medium text-slate-500">{formatHourLabel(hour)}</span>
                  </div>
                ))}
                {dayItems.map((item) => {
                  const top = ((toMinutes(item.start) - TIMELINE_START_HOUR * 60) / 60) * TIMELINE_HOUR_HEIGHT;
                  const height = Math.max(28, ((toMinutes(item.end) - toMinutes(item.start)) / 60) * TIMELINE_HOUR_HEIGHT);
                  return (
                    <div
                      key={item.id}
                      className={selectedItem?.id === item.id ? `${timelineClassName(item.status)} ring-2 ring-cyan-300` : timelineClassName(item.status)}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onMouseDown={(event) => {
                        if ((event.target as HTMLElement).dataset.resizeHandle === "true") return;
                        setSelectedId(item.id);
                        timelineDragRef.current = {
                          kind: "move",
                          itemId: item.id,
                          startY: event.clientY,
                          originStartMinutes: toMinutes(item.start),
                          durationMinutes: toMinutes(item.end) - toMinutes(item.start),
                        };
                      }}
                    >
                      <p className="truncate text-xs font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-[11px] text-slate-700">{item.start}-{item.end}</p>
                      <div
                        data-resize-handle="true"
                        className="absolute inset-x-2 bottom-1 h-2 cursor-ns-resize rounded-full bg-white/80"
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          setSelectedId(item.id);
                          timelineDragRef.current = {
                            kind: "resize",
                            itemId: item.id,
                            startY: event.clientY,
                            originEndMinutes: toMinutes(item.end),
                            startMinutes: toMinutes(item.start),
                          };
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI guidance</p>
            <div className="mt-4 space-y-3">
              {assistInsights.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Edit block</p>
              {selectedItem ? (
                <button type="button" onClick={removeSelectedItem} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">Delete</button>
              ) : null}
            </div>

            {selectedItem ? (
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-slate-800">
                  Title
                  <input value={selectedItem.title} onChange={(event) => updateSelectedItem({ title: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Date
                    <input type="date" value={selectedItem.date} onChange={(event) => updateSelectedItem({ date: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Owner
                    <input value={selectedItem.owner} onChange={(event) => updateSelectedItem({ owner: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Start
                    <input type="time" value={selectedItem.start} onChange={(event) => updateSelectedItem({ start: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    End
                    <input type="time" value={selectedItem.end} onChange={(event) => updateSelectedItem({ end: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Lane
                    <select value={selectedItem.lane} onChange={(event) => updateSelectedItem({ lane: event.target.value as ScheduleItem["lane"] })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
                      <option value="phase">Phase</option>
                      <option value="milestone">Milestone</option>
                      <option value="task">Task</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Status
                    <select value={selectedItem.status} onChange={(event) => updateSelectedItem({ status: event.target.value as ScheduleItem["status"] })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
                      <option value="ready">Ready</option>
                      <option value="watch">Watch</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-800">
                  Notes
                  <textarea value={selectedItem.notes} onChange={(event) => updateSelectedItem({ notes: event.target.value })} className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">Create or select a block to edit the schedule.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function safeJson(response: Response): Promise<any | null> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function buildScheduleItems(artifact: ExecutionArtifact) {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const base = addDays(anchor, 1 - anchor.getDay());

  const phaseItems = (artifact.phases.length ? artifact.phases : fallbackPhases(artifact)).map((phase, index) => {
    const date = addDays(base, index * 2);
    return {
      id: `phase-${index}`,
      title: phase.title,
      date: toDateInputValue(date),
      start: index === 0 ? "09:00" : index === 1 ? "11:00" : index === 2 ? "13:00" : "15:00",
      end: index === 0 ? "10:00" : index === 1 ? "12:00" : index === 2 ? "14:30" : "16:00",
      owner: phase.owner,
      lane: "phase" as const,
      notes: phase.blockers.length ? `Blockers: ${phase.blockers.join(", ")}` : phase.window,
      status: phase.status,
    } satisfies ScheduleItem;
  });

  const milestoneItems = artifact.milestones.map((milestone, index) => {
    const date = addDays(base, index * 3 + 1);
    return {
      id: `milestone-${index}`,
      title: milestone,
      date: toDateInputValue(date),
      start: "16:00",
      end: "16:45",
      owner: phaseItems[index]?.owner || "Team",
      lane: "milestone" as const,
      notes: artifact.feed[index]?.body || artifact.summary,
      status: "watch" as const,
    } satisfies ScheduleItem;
  });

  const taskItems = artifact.criticalPath.map((task, index) => {
    const date = addDays(base, index * 2);
    return {
      id: `task-${index}`,
      title: task,
      date: toDateInputValue(date),
      start: "08:00",
      end: "08:45",
      owner: phaseItems[index]?.owner || "Owner",
      lane: "task" as const,
      notes: artifact.feed[index]?.body || artifact.signal,
      status: index === 1 && /block/i.test(task) ? ("blocked" as const) : ("ready" as const),
    } satisfies ScheduleItem;
  });

  return [...taskItems, ...phaseItems, ...milestoneItems];
}

function fallbackPhases(artifact: ExecutionArtifact): ExecutionPhase[] {
  return [
    { title: "Discovery", owner: "Product", window: "Phase 1", status: "ready", blockers: [] },
    { title: "Design", owner: "Design", window: "Phase 2", status: "watch", blockers: [] },
    { title: "Implementation", owner: "Engineering", window: "Phase 3", status: "watch", blockers: [] },
    { title: "Launch", owner: "Operations", window: artifact.metaLine, status: "watch", blockers: [] },
  ];
}

function buildMonthCells(visibleMonth: Date) {
  const start = startOfWeek(startOfMonth(visibleMonth));
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, isoDate: toDateInputValue(date) };
  });
}

function buildIcsFile(items: ScheduleItem[], artifact: ExecutionArtifact) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mate-E//Workspace Plan Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const item of items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@mate-e`);
    lines.push(`DTSTAMP:${formatIcsTimestamp(new Date())}`);
    lines.push(`DTSTART:${formatIcsDateTime(item.date, item.start)}`);
    lines.push(`DTEND:${formatIcsDateTime(item.date, item.end)}`);
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    lines.push(`DESCRIPTION:${escapeIcs([item.notes, `Owner: ${item.owner}`, `Lane: ${item.lane}`].filter(Boolean).join("\\n"))}`);
    lines.push(`CATEGORIES:${item.lane.toUpperCase()}`);
    lines.push("END:VEVENT");
  }
  lines.push(`X-WR-CALNAME:${escapeIcs(artifact.title)}`);
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function buildScheduleReport(items: ScheduleItem[], artifact: ExecutionArtifact, summary: string, insights: string[]) {
  const lines = [`# ${artifact.title}`, "", summary, "", `Meta: ${artifact.metaLine}`, `Signal: ${artifact.signal}`, "", "## Calendar Schedule", ""];
  for (const item of items) {
    lines.push(`### ${item.title}`);
    lines.push(`- Date: ${item.date}`);
    lines.push(`- Time: ${item.start}-${item.end}`);
    lines.push(`- Owner: ${item.owner}`);
    lines.push(`- Lane: ${item.lane}`);
    lines.push(`- Status: ${item.status}`);
    if (item.notes.trim()) lines.push(`- Notes: ${item.notes.trim()}`);
    lines.push("");
  }
  lines.push("## AI Insights", "");
  for (const item of insights) lines.push(`- ${item}`);
  lines.push("", "## Milestones", "");
  for (const item of artifact.milestones) lines.push(`- ${item}`);
  return lines.join("\n");
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function addMonths(date: Date, count: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return startOfMonth(next);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatAgendaDate(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short" }).format(parsed);
}

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized} ${suffix}`;
}

function formatIcsDateTime(dateValue: string, timeValue: string) {
  const safeTime = timeValue || "09:00";
  const date = new Date(`${dateValue}T${safeTime}:00`);
  return formatIcsTimestamp(date);
}

function formatIcsTimestamp(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

function clampMinutes(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace-schedule";
}

function getSeededScheduleItems(artifact: ExecutionArtifact) {
  const stored = readWorkspaceContext().planSchedule;
  if (stored?.title === slugify(artifact.title || "workspace-schedule") && stored.items.length) {
    return stored.items;
  }
  return buildScheduleItems(artifact);
}

function badgeClassName(status: ScheduleItem["status"]) {
  if (status === "blocked") return "truncate rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-800 cursor-grab";
  if (status === "watch") return "truncate rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 cursor-grab";
  return "truncate rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-medium text-cyan-900 cursor-grab";
}

function timelineClassName(status: ScheduleItem["status"]) {
  if (status === "blocked") return "absolute inset-x-2 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 shadow-sm cursor-grab";
  if (status === "watch") return "absolute inset-x-2 rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 shadow-sm cursor-grab";
  return "absolute inset-x-2 rounded-xl border border-cyan-200 bg-cyan-100 px-3 py-2 shadow-sm cursor-grab";
}

function getConflictCount(items: ScheduleItem[]) {
  const sorted = [...items].sort((left, right) => toMinutes(left.start) - toMinutes(right.start));
  let conflicts = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    if (toMinutes(sorted[index - 1].end) > toMinutes(sorted[index].start)) {
      conflicts += 1;
    }
  }
  return conflicts;
}