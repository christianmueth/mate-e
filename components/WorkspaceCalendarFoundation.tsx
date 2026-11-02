"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CalendarPlanningAssistant from "@/components/CalendarPlanningAssistant";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceUntil: string | null;
  reminderMinutes: number | null;
  taskId: string | null;
  task: PlanTask | null;
};

type PlanTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueAt: string | null;
};

type CalendarView = "day" | "week" | "month";

type EventForm = {
  title: string;
  description: string;
  date: string;
  start: string;
  end: string;
  recurrence: CalendarEvent["recurrence"];
  recurrenceUntil: string;
  reminderMinutes: string;
  taskId: string;
  newTaskTitle: string;
};

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  date: toDateInput(new Date()),
  start: "09:00",
  end: "10:00",
  recurrence: "NONE",
  recurrenceUntil: "",
  reminderMinutes: "15",
  taskId: "",
  newTaskTitle: "",
};

export default function WorkspaceCalendarFoundation() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const displayedDates = useMemo(() => getDatesForView(anchorDate, view), [anchorDate, view]);
  const visibleEvents = useMemo(() => expandEvents(events, displayedDates), [events, displayedDates]);
  const selectedEvent = events.find((event) => event.id === selectedId) || null;

  useEffect(() => {
    void loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/events", { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; events?: CalendarEvent[]; tasks?: PlanTask[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load your calendar.");
      setEvents(data.events || []);
      setTasks(data.tasks || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your calendar.");
    } finally {
      setLoading(false);
    }
  }

  function chooseEvent(event: CalendarEvent) {
    setSelectedId(event.id);
    setAnchorDate(startOfDay(new Date(event.startsAt)));
    setForm({
      title: event.title,
      description: event.description || "",
      date: toDateInput(new Date(event.startsAt)),
      start: toTimeInput(new Date(event.startsAt)),
      end: toTimeInput(new Date(event.endsAt)),
      recurrence: event.recurrence,
      recurrenceUntil: event.recurrenceUntil ? toDateInput(new Date(event.recurrenceUntil)) : "",
      reminderMinutes: event.reminderMinutes ? String(event.reminderMinutes) : "",
      taskId: event.taskId || "",
      newTaskTitle: "",
    });
  }

  function startNewEvent(date = toDateInput(anchorDate)) {
    setSelectedId(null);
    setForm({ ...EMPTY_FORM, date, start: "09:00", end: "10:00" });
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      let taskId = form.taskId || null;
      if (form.newTaskTitle.trim()) {
        const taskResponse = await fetch("/api/calendar/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.newTaskTitle, dueAt: toLocalDateTime(form.date, form.end) }),
        });
        const taskData = await taskResponse.json() as { ok?: boolean; task?: PlanTask; error?: string };
        if (!taskResponse.ok || !taskData.ok || !taskData.task) throw new Error(taskData.error || "Unable to create the linked task.");
        taskId = taskData.task.id;
        setTasks((current) => [...current, taskData.task!]);
      }

      const payload = {
        title: form.title,
        description: form.description,
        startsAt: toLocalDateTime(form.date, form.start),
        endsAt: toLocalDateTime(form.date, form.end),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        recurrence: form.recurrence,
        recurrenceUntil: form.recurrenceUntil ? toLocalDateTime(form.recurrenceUntil, "23:59") : null,
        reminderMinutes: form.reminderMinutes || null,
        taskId,
      };
      const response = await fetch(selectedId ? `/api/calendar/events/${selectedId}` : "/api/calendar/events", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { ok?: boolean; event?: CalendarEvent; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save the event.");

      if (selectedId) {
        await loadCalendar();
        toast.success("Event updated.");
      } else if (data.event) {
        setEvents((current) => [...current, data.event!]);
        toast.success("Event created.");
      }
      startNewEvent(form.date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the event.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedEvent() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/calendar/events/${selectedId}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to delete the event.");
      setEvents((current) => current.filter((event) => event.id !== selectedId));
      startNewEvent();
      toast.success("Event deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the event.");
    } finally {
      setSaving(false);
    }
  }

  async function moveEvent(event: CalendarEvent, nextDate: string) {
      const start = new Date(event.startsAt);
      const end = new Date(event.endsAt);
      try {
        const response = await fetch(`/api/calendar/events/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            description: event.description,
            startsAt: toLocalDateTime(nextDate, toTimeInput(start)),
            endsAt: toLocalDateTime(nextDate, toTimeInput(end)),
            timezone: event.timezone,
            recurrence: event.recurrence,
            recurrenceUntil: event.recurrenceUntil,
            reminderMinutes: event.reminderMinutes,
            taskId: event.taskId,
          }),
        });
        const data = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || "Unable to move the event.");
        await loadCalendar();
        toast.success("Event moved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to move the event.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Calendar</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Plan time, then connect it to work.</h2>
            <p className="mt-1 text-sm text-slate-700">Email reminders are sent to your signed-in account.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportCalendar(events)} className={secondaryButtonClass}>Export .ics</button>
            {(["day", "week", "month"] as CalendarView[]).map((option) => (
              <button key={option} type="button" onClick={() => setView(option)} className={view === option ? activeButtonClass : secondaryButtonClass}>
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAnchorDate(moveAnchor(anchorDate, view, -1))} className={secondaryButtonClass}>Previous</button>
            <button type="button" onClick={() => setAnchorDate(startOfDay(new Date()))} className={secondaryButtonClass}>Today</button>
            <button type="button" onClick={() => setAnchorDate(moveAnchor(anchorDate, view, 1))} className={secondaryButtonClass}>Next</button>
          </div>
          <p className="text-sm font-semibold text-slate-900">{viewLabel(anchorDate, view)}</p>
        </div>
        {loading ? <p className="mt-5 text-sm text-slate-600">Loading calendar…</p> : (
          <div className={view === "month" ? "mt-5 grid grid-cols-7 gap-2" : "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
            {displayedDates.map((date) => {
              const dateKey = toDateInput(date);
              const dayEvents = visibleEvents.filter((event) => event.date === dateKey);
              return (
                <button key={dateKey} type="button" onClick={() => startNewEvent(dateKey)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedEvent) void moveEvent(draggedEvent, dateKey); setDraggedEvent(null); }} className={view === "month" ? "min-h-24 rounded-xl border border-slate-200 bg-slate-50 p-2 text-left hover:border-cyan-400 hover:bg-cyan-50" : "min-h-32 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-cyan-400 hover:bg-cyan-50"}>
                  <span className="text-xs font-semibold text-slate-700">{formatCalendarDate(date, view)}</span>
                  <span className="mt-2 block space-y-1">
                    {dayEvents.slice(0, view === "month" ? 2 : 5).map((event) => (
                      <span key={`${event.sourceId}-${event.date}`} draggable onDragStart={() => setDraggedEvent(event.source)} onDragEnd={() => setDraggedEvent(null)} onClick={(click) => { click.stopPropagation(); chooseEvent(event.source); }} className="block cursor-grab truncate rounded-md bg-cyan-100 px-1.5 py-1 text-xs text-cyan-950">
                        {formatTime(event.source.startsAt)} {event.source.title}{event.source.task ? " · task" : ""}
                      </span>
                    ))}
                    {dayEvents.length > (view === "month" ? 2 : 5) ? <span className="block text-xs text-slate-500">+{dayEvents.length - (view === "month" ? 2 : 5)} more</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <CalendarPlanningAssistant tasks={tasks} onApplied={loadCalendar} />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{selectedEvent ? "Edit event" : "New event"}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{selectedEvent ? selectedEvent.title : "Add time to your calendar"}</h3>
            {selectedEvent?.task ? <a href="#plan-tasks" className="mt-2 inline-block text-sm font-medium text-cyan-800 hover:underline">Open linked task: {selectedEvent.task.title}</a> : null}
          </div>
          {selectedEvent ? <button type="button" onClick={() => void deleteSelectedEvent()} disabled={saving} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60">Delete</button> : null}
        </div>
        <form onSubmit={submitEvent} className="mt-5 grid gap-4">
          <label className="text-sm font-medium text-slate-800">Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-800">Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={inputClass} /></label>
            <label className="text-sm font-medium text-slate-800">Start<input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} className={inputClass} /></label>
            <label className="text-sm font-medium text-slate-800">End<input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} className={inputClass} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-800">Repeats<select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as CalendarEvent["recurrence"] })} className={inputClass}><option value="NONE">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
            <label className="text-sm font-medium text-slate-800">Repeat until<input disabled={form.recurrence === "NONE"} type="date" value={form.recurrenceUntil} onChange={(event) => setForm({ ...form, recurrenceUntil: event.target.value })} className={inputClass} /></label>
            <label className="text-sm font-medium text-slate-800">Email reminder<select value={form.reminderMinutes} onChange={(event) => setForm({ ...form, reminderMinutes: event.target.value })} className={inputClass}><option value="">No reminder</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
          </div>
          <label className="text-sm font-medium text-slate-800">Link a Mate-E plan task<select value={form.taskId} onChange={(event) => setForm({ ...form, taskId: event.target.value })} className={inputClass}><option value="">No linked task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-800">Or create and link a task<input value={form.newTaskTitle} onChange={(event) => setForm({ ...form, newTaskTitle: event.target.value })} placeholder="e.g. Prepare project check-in" className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-800">Notes<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} min-h-24`} /></label>
          <div className="flex flex-wrap gap-2"><button disabled={saving} type="submit" className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">{saving ? "Saving…" : selectedEvent ? "Save event" : "Create event"}</button>{selectedEvent ? <button type="button" onClick={() => startNewEvent(form.date)} className={secondaryButtonClass}>New event</button> : null}</div>
        </form>
      </section>

      <section id="plan-tasks" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mate-E plan tasks</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-950">Linked work</h3>
        <div className="mt-4 space-y-2">{tasks.length ? tasks.map((task) => <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="font-medium text-slate-900">{task.title}</p><p className="mt-1 text-sm text-slate-600">{task.description || task.status}</p></article>) : <p className="text-sm text-slate-600">Create a linked task from an event or scheduling proposal.</p>}</div>
      </section>
    </div>
  );
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100";
const secondaryButtonClass = "rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";
const activeButtonClass = "rounded-full bg-slate-950 px-3 py-2 text-sm font-medium text-white";

function expandEvents(events: CalendarEvent[], dates: Date[]) {
  const datesByKey = new Map(dates.map((date) => [toDateInput(date), date]));
  return events.flatMap((event) => {
    const start = startOfDay(new Date(event.startsAt));
    const until = event.recurrenceUntil ? startOfDay(new Date(event.recurrenceUntil)) : null;
    return [...datesByKey.entries()].flatMap(([date, current]) => {
      if (current < start || (until && current > until) || !matchesRecurrence(start, current, event.recurrence)) return [];
      return [{ sourceId: event.id, date, source: event }];
    });
  });
}

function matchesRecurrence(start: Date, current: Date, recurrence: CalendarEvent["recurrence"]) {
  if (recurrence === "NONE") return toDateInput(start) === toDateInput(current);
  const elapsedDays = Math.round((current.getTime() - start.getTime()) / 86_400_000);
  if (recurrence === "DAILY") return elapsedDays >= 0;
  if (recurrence === "WEEKLY") return elapsedDays >= 0 && elapsedDays % 7 === 0;
  return current.getDate() === start.getDate() && current >= start;
}

function getDatesForView(anchor: Date, view: CalendarView) {
  if (view === "day") return [anchor];
  if (view === "week") return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function moveAnchor(date: Date, view: CalendarView, offset: number) {
  if (view === "day") return addDays(date, offset);
  if (view === "week") return addDays(date, offset * 7);
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function viewLabel(date: Date, view: CalendarView) {
  if (view === "day") return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
  if (view === "week") return `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(startOfWeek(date))}`;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatCalendarDate(date: Date, view: CalendarView) {
  return new Intl.DateTimeFormat("en-US", view === "month" ? { day: "numeric" } : { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function toLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function exportCalendar(events: CalendarEvent[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mate-E//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@mate-e`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${formatIcsDate(new Date(event.startsAt))}`);
    lines.push(`DTEND:${formatIcsDate(new Date(event.endsAt))}`);
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.recurrence !== "NONE") {
      const rule = `FREQ=${event.recurrence}${event.recurrenceUntil ? `;UNTIL=${formatIcsDate(new Date(event.recurrenceUntil))}` : ""}`;
      lines.push(`RRULE:${rule}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mate-e-calendar.ics";
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success("Calendar exported.");
}

function formatIcsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
