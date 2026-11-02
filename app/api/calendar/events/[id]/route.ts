import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCalendarEvent } from "@/lib/calendarEventInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserId();
    if (!user) return unauthorized();
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const input = parseCalendarEvent(body);
    if (!input.ok) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });

    if (input.data.taskId) {
      const task = await prisma.planTask.findFirst({ where: { id: input.data.taskId, userId: user }, select: { id: true } });
      if (!task) return NextResponse.json({ ok: false, error: "Choose a task from your own plan." }, { status: 400 });
    }

    const result = await prisma.calendarEvent.updateMany({
      where: { id, userId: user },
      data: { ...input.data, reminderSentAt: null },
    });
    if (!result.count) return NextResponse.json({ ok: false, error: "Calendar event not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[CalendarEvent] PATCH failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to update the event." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserId();
    if (!user) return unauthorized();
    const { id } = await context.params;
    const result = await prisma.calendarEvent.deleteMany({ where: { id, userId: user } });
    if (!result.count) return NextResponse.json({ ok: false, error: "Calendar event not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[CalendarEvent] DELETE failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to delete the event." }, { status: 500 });
  }
}

async function getUserId() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  return user?.id ?? null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Sign in to manage your calendar." }, { status: 401 });
}
