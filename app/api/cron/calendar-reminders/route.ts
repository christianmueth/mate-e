import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOK_AHEAD_MINUTES = 5;

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("[CalendarReminders] Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return NextResponse.json({ ok: false, error: "Email reminders are not configured." }, { status: 503 });
  }

  try {
    const now = new Date();
    const latestStart = new Date(now.getTime() + LOOK_AHEAD_MINUTES * 60_000);
    const events = await prisma.calendarEvent.findMany({
      where: {
        reminderMinutes: { not: null },
        reminderEmail: { not: null },
        reminderSentAt: null,
        startsAt: { gt: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60_000) },
      },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        timezone: true,
        reminderMinutes: true,
        reminderEmail: true,
      },
      take: 100,
    });

    const due = events.filter((event) => {
      if (event.reminderMinutes === null) return false;
      const reminderAt = event.startsAt.getTime() - event.reminderMinutes * 60_000;
      return reminderAt <= latestStart.getTime();
    });
    const resend = new Resend(apiKey);
    let sent = 0;

    for (const event of due) {
      if (!event.reminderEmail) continue;
      const response = await resend.emails.send({
        from,
        to: event.reminderEmail,
        subject: `Reminder: ${event.title}`,
        html: buildEmail(event),
      });
      if (response.error) {
        console.error("[CalendarReminders] Resend failed:", response.error);
        continue;
      }

      await prisma.calendarEvent.updateMany({
        where: { id: event.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      sent += 1;
    }

    return NextResponse.json({ ok: true, checked: events.length, sent });
  } catch (error) {
    console.error("[CalendarReminders] GET failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to deliver calendar reminders." }, { status: 500 });
  }
}

function buildEmail(event: {
  title: string;
  description: string | null;
  startsAt: Date;
  timezone: string;
}) {
  const startsAt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
    timeZoneName: "short",
  }).format(event.startsAt);
  const description = event.description ? `<p>${escapeHtml(event.description)}</p>` : "";
  return `<h1>${escapeHtml(event.title)}</h1><p>Your Mate-E calendar event begins ${escapeHtml(startsAt)}.</p>${description}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}
