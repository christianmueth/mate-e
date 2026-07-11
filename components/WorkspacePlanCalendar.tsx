"use client";

import { useEffect, useMemo, useState } from "react";

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

type ScheduleItem = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  owner: string;
  lane: "phase" | "milestone" | "task";
  notes: string;
  status: "ready" | "watch" | "blocked";
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkspacePlanCalendar({ artifact }: { artifact: ExecutionArtifact }) {
  const seedKey = JSON.stringify({
    title: artifact.title,
    phases: artifact.phases,
    milestones: artifact.milestones,
    criticalPath: artifact.criticalPath,
  });
  const [items, setItems] = useState<ScheduleItem[]>(() => buildScheduleItems(artifact));
  const [selectedId, setSelectedId] = useState<string | null>(() => buildScheduleItems(artifact)[0]?.id ?? null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const seeded = buildScheduleItems(artifact)[0];
    return startOfMonth(parseDateInput(seeded?.date) || new Date());
  });

  useEffect(() => {
    const nextItems = buildScheduleItems(artifact);
    setItems(nextItems);
    setSelectedId(nextItems[0]?.id ?? null);
    setVisibleMonth(startOfMonth(parseDateInput(nextItems[0]?.date) || new Date()));
  }, [seedKey, artifact]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`)),
    [items]
  );
  const selectedItem = sortedItems.find((item) => item.id === selectedId) || sortedItems[0] || null;
  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);

  function updateSelectedItem(patch: Partial<ScheduleItem>) {
    if (!selectedItem) return;
    setItems((current) => current.map((item) => (item.id === selectedItem.id ? { ...item, ...patch } : item)));
  }

  function addEvent() {
    const anchorDate = selectedItem?.date || toDateInputValue(new Date());
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

  function removeSelectedItem() {
    if (!selectedItem) return;
    const nextItems = sortedItems.filter((item) => item.id !== selectedItem.id);
    setItems(nextItems);
    setSelectedId(nextItems[0]?.id ?? null);
  }

  function downloadCalendar() {
    const ics = buildIcsFile(sortedItems, artifact);
    downloadTextFile(`${slugify(artifact.title || "workspace-schedule")}.ics`, ics, "text/calendar;charset=utf-8");
  }

  function downloadReport() {
    const report = buildScheduleReport(sortedItems, artifact);
    downloadTextFile(`${slugify(artifact.title || "workspace-schedule")}-report.md`, report, "text/markdown;charset=utf-8");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">AI-augmented schedule</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{artifact.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{artifact.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-cyan-200 bg-white/90 px-3 py-1">{artifact.metaLine}</span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">{artifact.signal}</span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">Editable calendar</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addEvent}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Add block
            </button>
            <button
              type="button"
              onClick={downloadCalendar}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Download calendar
            </button>
            <button
              type="button"
              onClick={downloadReport}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download report
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Calendar</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{formatMonthLabel(visibleMonth)}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {label}
                </div>
              ))}
              {monthCells.map((day) => {
                const dayItems = sortedItems.filter((item) => item.date === day.isoDate);
                const dayIsVisible = day.date.getMonth() === visibleMonth.getMonth();
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    onClick={() => {
                      setVisibleMonth(startOfMonth(day.date));
                      if (dayItems[0]) {
                        setSelectedId(dayItems[0].id);
                      }
                    }}
                    className={dayIsVisible
                      ? "min-h-[120px] rounded-[1.25rem] border border-slate-200 bg-white p-2 text-left hover:border-cyan-300 hover:bg-cyan-50/40"
                      : "min-h-[120px] rounded-[1.25rem] border border-slate-100 bg-slate-50/70 p-2 text-left text-slate-400"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{day.date.getDate()}</span>
                      {dayItems.length ? <span className="text-[11px] text-slate-500">{dayItems.length}</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={item.status === "blocked"
                            ? "truncate rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-800"
                            : item.status === "watch"
                              ? "truncate rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800"
                              : "truncate rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-medium text-cyan-900"
                          }
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
                  className={selectedItem?.id === item.id
                    ? "w-full rounded-[1.25rem] border border-cyan-300 bg-cyan-50 px-4 py-3 text-left"
                    : "w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-white"
                  }
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Edit block</p>
              {selectedItem ? (
                <button
                  type="button"
                  onClick={removeSelectedItem}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  Delete
                </button>
              ) : null}
            </div>

            {selectedItem ? (
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-slate-800">
                  Title
                  <input
                    value={selectedItem.title}
                    onChange={(event) => updateSelectedItem({ title: event.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Date
                    <input
                      type="date"
                      value={selectedItem.date}
                      onChange={(event) => updateSelectedItem({ date: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Owner
                    <input
                      value={selectedItem.owner}
                      onChange={(event) => updateSelectedItem({ owner: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Start
                    <input
                      type="time"
                      value={selectedItem.start}
                      onChange={(event) => updateSelectedItem({ start: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    End
                    <input
                      type="time"
                      value={selectedItem.end}
                      onChange={(event) => updateSelectedItem({ end: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Lane
                    <select
                      value={selectedItem.lane}
                      onChange={(event) => updateSelectedItem({ lane: event.target.value as ScheduleItem["lane"] })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    >
                      <option value="phase">Phase</option>
                      <option value="milestone">Milestone</option>
                      <option value="task">Task</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Status
                    <select
                      value={selectedItem.status}
                      onChange={(event) => updateSelectedItem({ status: event.target.value as ScheduleItem["status"] })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                    >
                      <option value="ready">Ready</option>
                      <option value="watch">Watch</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-800">
                  Notes
                  <textarea
                    value={selectedItem.notes}
                    onChange={(event) => updateSelectedItem({ notes: event.target.value })}
                    className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">Create or select a block to edit the schedule.</p>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI notes</p>
            <div className="mt-4 space-y-3">
              {artifact.criticalPath.slice(0, 3).map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    return {
      date,
      isoDate: toDateInputValue(date),
    };
  });
}

function buildIcsFile(items: ScheduleItem[], artifact: ExecutionArtifact) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mate-E//Workspace Plan Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

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

function buildScheduleReport(items: ScheduleItem[], artifact: ExecutionArtifact) {
  const lines = [
    `# ${artifact.title}`,
    "",
    artifact.summary,
    "",
    `Meta: ${artifact.metaLine}`,
    `Signal: ${artifact.signal}`,
    "",
    "## Calendar Schedule",
    "",
  ];

  for (const item of items) {
    lines.push(`### ${item.title}`);
    lines.push(`- Date: ${item.date}`);
    lines.push(`- Time: ${item.start}-${item.end}`);
    lines.push(`- Owner: ${item.owner}`);
    lines.push(`- Lane: ${item.lane}`);
    lines.push(`- Status: ${item.status}`);
    if (item.notes.trim()) {
      lines.push(`- Notes: ${item.notes.trim()}`);
    }
    lines.push("");
  }

  lines.push("## AI Notes");
  lines.push("");
  for (const item of artifact.criticalPath) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  lines.push("## Milestones");
  lines.push("");
  for (const item of artifact.milestones) {
    lines.push(`- ${item}`);
  }

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

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace-schedule";
}