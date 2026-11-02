import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma, safeUpsertUser } from "@/lib/db";
import type { WorkspacePlanScheduleItem } from "@/lib/workspaceContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CalendarShareRequest = {
  title?: unknown;
  items?: unknown;
};

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Sign in to create a public calendar link." }, { status: 401 });
    }

    const body = await request.json() as CalendarShareRequest;
    const title = cleanText(body.title, 120) || "Mate-E calendar";
    const items = sanitizeItems(body.items);
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "Add at least one appointment before sharing a public calendar." }, { status: 400 });
    }

    const user = await safeUpsertUser(clerkUserId, { id: true });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Calendar sharing is unavailable until your account can be saved." }, { status: 503 });
    }

    const share = await prisma.calendarShare.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        title,
        items,
      },
      select: { token: true },
    });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const url = new URL(`/share/calendar/${share.token}`, origin).toString();

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("[CalendarShare] POST failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create a public calendar link." }, { status: 500 });
  }
}

function sanitizeItems(value: unknown): WorkspacePlanScheduleItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const title = cleanText(record.title, 160);
      const date = cleanText(record.date, 10);
      const start = cleanText(record.start, 5);
      const end = cleanText(record.end, 5);
      const owner = cleanText(record.owner, 120);
      const notes = cleanText(record.notes, 1000);
      const lane = record.lane === "phase" || record.lane === "milestone" ? record.lane : "task";
      const status = record.status === "watch" || record.status === "blocked" ? record.status : "ready";
      if (!title || !isDate(date) || !isTime(start) || !isTime(end) || end <= start) return null;

      return {
        id: cleanText(record.id, 120) || randomUUID(),
        title,
        date,
        start,
        end,
        owner,
        lane,
        notes,
        status,
      } satisfies WorkspacePlanScheduleItem;
    })
    .filter((item): item is WorkspacePlanScheduleItem => Boolean(item))
    .slice(0, 48);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}
