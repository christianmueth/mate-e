import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildConflictFreeProposal, DEFAULT_AVAILABILITY, sanitizeAvailability } from "@/lib/calendarPlanner";
import { prisma, safeUpsertUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return unauthorized();
    const user = await safeUpsertUser(clerkUserId, { id: true });
    if (!user) return NextResponse.json({ ok: false, error: "Calendar planner storage is unavailable." }, { status: 503 });
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const deadline = typeof body.deadline === "string" ? new Date(body.deadline) : null;
    const hours = Number(body.hours);
    const taskId = typeof body.taskId === "string" && body.taskId ? body.taskId : null;
    if (!title || !deadline || Number.isNaN(deadline.getTime()) || deadline <= new Date() || !Number.isInteger(hours) || hours < 1 || hours > 80) {
      return NextResponse.json({ ok: false, error: "Provide a title, a future deadline, and 1–80 hours." }, { status: 400 });
    }
    if (taskId && !await prisma.planTask.findFirst({ where: { id: taskId, userId: user.id }, select: { id: true } })) {
      return NextResponse.json({ ok: false, error: "Choose a task from your own plan." }, { status: 400 });
    }

    const [availabilityRecord, events] = await Promise.all([
      prisma.calendarAvailability.findUnique({ where: { userId: user.id } }),
      prisma.calendarEvent.findMany({
        where: { userId: user.id, startsAt: { lte: deadline } },
        select: { startsAt: true, endsAt: true, recurrence: true, recurrenceUntil: true },
      }),
    ]);
    const availability = availabilityRecord ? sanitizeAvailability(availabilityRecord) : DEFAULT_AVAILABILITY;
    const result = buildConflictFreeProposal({ title, deadline, totalMinutes: hours * 60, availability, events });
    if ("error" in result) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });

    const proposal = await prisma.calendarProposal.create({
      data: { userId: user.id, taskId, title, deadline, totalMinutes: hours * 60, items: result.blocks },
      select: { id: true, title: true, deadline: true, totalMinutes: true, items: true, status: true, taskId: true },
    });
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    console.error("[CalendarProposals] POST failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create a scheduling proposal." }, { status: 500 });
  }
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Sign in to use the calendar planner." }, { status: 401 });
}
