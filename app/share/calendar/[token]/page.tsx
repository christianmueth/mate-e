import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { WorkspacePlanScheduleItem } from "@/lib/workspaceContext";

export const dynamic = "force-dynamic";

export default async function SharedCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.calendarShare.findUnique({
    where: { token },
    select: { title: true, items: true, updatedAt: true },
  });
  if (!share) notFound();

  const items = sanitizeItems(share.items).sort((left, right) => `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`));

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:px-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Shared Mate-E calendar</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{share.title}</h1>
        <p className="mt-2 text-sm text-slate-600">Read-only schedule, last updated {formatUpdatedAt(share.updatedAt)}.</p>

        {items.length ? (
          <div className="mt-7 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(item.date)} · {item.start}–{item.end}</p>
                  </div>
                  {item.owner ? <span className="text-sm text-slate-600">{item.owner}</span> : null}
                </div>
                {item.notes ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.notes}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This shared calendar has no appointments.</p>
        )}
      </section>
    </main>
  );
}

function sanitizeItems(value: unknown): WorkspacePlanScheduleItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkspacePlanScheduleItem => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return ["id", "title", "date", "start", "end", "owner", "lane", "notes", "status"].every((key) => typeof record[key] === "string");
  });
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value);
}
