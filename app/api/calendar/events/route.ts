import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, safeUpsertUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  recurrence: true,
  recurrenceUntil: true,
  reminderMinutes: true,
  taskId: true,
  task: { select: { id: true, title: true, status: true, dueAt: true } },
} as const;

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const [events, tasks] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { userId: user.id },
        orderBy: { startsAt: "asc" },
        select: eventSelect,
      }),
      prisma.planTask.findMany({
        where: { userId: user.id },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, description: true, status: true, dueAt: true },
      }),
    ]);

    return NextResponse.json({ ok: true, events, tasks });
  } catch (error) {
    console.error("[CalendarEvents] GET failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to load your calendar." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const body = await request.json() as Record<string, unknown>;
    const input = parseEvent(body);
    if (!input.ok) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });

    if (input.data.taskId) {
      const task = await prisma.planTask.findFirst({ where: { id: input.data.taskId, userId: user.id }, select: { id: true } });
      if (!task) return NextResponse.json({ ok: false, error: "Choose a task from your own plan." }, { status: 400 });
    }

    const event = await prisma.calendarEvent.create({
      data: { ...input.data, userId: user.id, reminderEmail: input.data.reminderMinutes === null ? null : user.email },
      select: eventSelect,
    });
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    console.error("[CalendarEvents] POST failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create the event." }, { status: 500 });
  }
}

async function getUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const [user, clerkUser] = await Promise.all([
    safeUpsertUser(clerkUserId, { id: true }),
    currentUser(),
  ]);
  if (!user) return null;
  const email = clerkUser?.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)?.emailAddress
    || clerkUser?.emailAddresses[0]?.emailAddress
    || null;
  return { ...user, email };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Sign in to manage your calendar." }, { status: 401 });
}

export function parseEvent(body: Record<string, unknown>) {
  const title = text(body.title, 160);
  const startsAt = date(body.startsAt);
  const endsAt = date(body.endsAt);
  const recurrence = body.recurrence === "DAILY" || body.recurrence === "WEEKLY" || body.recurrence === "MONTHLY" ? body.recurrence : "NONE";
  const recurrenceUntil = recurrence === "NONE" ? null : optionalDate(body.recurrenceUntil);
  const reminderMinutes = optionalReminderMinutes(body.reminderMinutes);
  const taskId = text(body.taskId, 120) || null;

  if (!title) return { ok: false as const, error: "An event title is required." };
  if (!startsAt || !endsAt || endsAt <= startsAt) return { ok: false as const, error: "Choose an end time after the start time." };
  if (recurrence !== "NONE" && recurrenceUntil && recurrenceUntil < startsAt) {
    return { ok: false as const, error: "The recurrence end date must be after the event starts." };
  }
  if (body.reminderMinutes != null && reminderMinutes === null) {
    return { ok: false as const, error: "Choose a reminder between 5 minutes and 30 days." };
  }

  return {
    ok: true as const,
    data: {
      title,
      description: text(body.description, 2000) || null,
      startsAt,
      endsAt,
      timezone: text(body.timezone, 80) || "UTC",
      recurrence,
      recurrenceUntil,
      reminderMinutes,
      taskId,
    },
  };
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function date(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalDate(value: unknown) {
  return value == null || value === "" ? null : date(value);
}

function optionalReminderMinutes(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 43_200 ? parsed : null;
}
