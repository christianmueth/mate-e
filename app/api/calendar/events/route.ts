import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, safeUpsertUser } from "@/lib/db";
import { parseCalendarEvent } from "@/lib/calendarEventInput";

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
    const input = parseCalendarEvent(body);
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
