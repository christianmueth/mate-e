"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type Task = { id: string; title: string };
type Availability = { workdays: number[]; startMinutes: number; endMinutes: number };
type Proposal = { id: string; title: string; deadline: string; totalMinutes: number; taskId: string | null; items: Array<{ title: string; startsAt: string; endsAt: string }> };

export default function CalendarPlanningAssistant({ tasks, onApplied }: { tasks: Task[]; onApplied: () => Promise<void> }) {
  const [availability, setAvailability] = useState<Availability>({ workdays: [1, 2, 3, 4, 5], startMinutes: 540, endMinutes: 1020 });
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("4");
  const [deadline, setDeadline] = useState("");
  const [taskId, setTaskId] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/calendar/availability", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() as { ok?: boolean; availability?: Availability } }))
      .then(({ response, data }) => { if (response.ok && data.ok && data.availability) setAvailability(data.availability); })
      .catch(() => undefined);
  }, []);

  async function saveAvailability() {
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/availability", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(availability) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save availability.");
      toast.success("Availability saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function requestProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveAvailability();
      const response = await fetch("/api/calendar/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, hours: Number(hours), deadline: new Date(`${deadline}T17:00:00`).toISOString(), taskId: taskId || null }),
      });
      const data = await response.json() as { ok?: boolean; proposal?: Proposal; error?: string };
      if (!response.ok || !data.ok || !data.proposal) throw new Error(data.error || "Unable to create a scheduling proposal.");
      setProposal(data.proposal);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create a scheduling proposal.");
    } finally {
      setSaving(false);
    }
  }

  async function approveProposal() {
    if (!proposal) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/calendar/proposals/${proposal.id}/approve`, { method: "POST" });
      const data = await response.json() as { ok?: boolean; created?: number; alreadyApproved?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to approve calendar changes.");
      await onApplied();
      setProposal(null);
      toast.success(data.alreadyApproved ? "This proposal was already applied." : `${data.created || 0} work blocks added to your calendar.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve calendar changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-800">Mate-E scheduling assistant</p>
      <h3 className="mt-2 text-xl font-semibold text-slate-950">Protect time before a deadline.</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">Mate-E checks your events and availability, then proposes changes for your approval. Nothing is added automatically.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">Workday starts<input type="time" value={minutesToTime(availability.startMinutes)} onChange={(event) => setAvailability({ ...availability, startMinutes: timeToMinutes(event.target.value) })} className={inputClass} /></label>
        <label className="text-sm font-medium text-slate-800">Workday ends<input type="time" value={minutesToTime(availability.endMinutes)} onChange={(event) => setAvailability({ ...availability, endMinutes: timeToMinutes(event.target.value) })} className={inputClass} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => <button key={label} type="button" onClick={() => setAvailability({ ...availability, workdays: availability.workdays.includes(day) ? availability.workdays.filter((value) => value !== day) : [...availability.workdays, day].sort() })} className={availability.workdays.includes(day) ? activeClass : buttonClass}>{label}</button>)}</div>
      <form onSubmit={requestProposal} className="mt-5 grid gap-3">
        <label className="text-sm font-medium text-slate-800">What needs to be scheduled?<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Draft final project report" className={inputClass} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-800">Hours<input required min="1" max="80" type="number" value={hours} onChange={(event) => setHours(event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-800">Deadline<input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-medium text-slate-800">Link task<select value={taskId} onChange={(event) => setTaskId(event.target.value)} className={inputClass}><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        </div>
        <button disabled={saving} type="submit" className="w-fit rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">Ask Mate-E to propose time</button>
      </form>
      {proposal ? <div className="mt-5 rounded-2xl border border-violet-200 bg-white p-4"><p className="font-semibold text-slate-950">Review proposal: {proposal.title}</p><p className="mt-1 text-sm text-slate-600">{proposal.totalMinutes / 60} hours before {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(proposal.deadline))}</p><div className="mt-3 space-y-2">{proposal.items.map((item) => <p key={item.startsAt} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt))} — {item.title}</p>)}</div><div className="mt-4 flex gap-2"><button disabled={saving} type="button" onClick={() => void approveProposal()} className="rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60">Approve changes</button><button type="button" onClick={() => setProposal(null)} className={buttonClass}>Discard</button></div></div> : null}
    </section>
  );
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100";
const buttonClass = "rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";
const activeClass = "rounded-full bg-violet-700 px-3 py-2 text-sm font-medium text-white";
function minutesToTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function timeToMinutes(value: string) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }
