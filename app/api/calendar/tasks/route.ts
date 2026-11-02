import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, safeUpsertUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ ok: false, error: "Sign in to create a plan task." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    if (!title) return NextResponse.json({ ok: false, error: "A task title is required." }, { status: 400 });
    const user = await safeUpsertUser(clerkUserId, { id: true });
    if (!user) return NextResponse.json({ ok: false, error: "Task storage is unavailable." }, { status: 503 });

    const task = await prisma.planTask.create({
      data: {
        userId: user.id,
        title,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null,
        dueAt: parseDate(body.dueAt),
      },
      select: { id: true, title: true, description: true, status: true, dueAt: true },
    });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    console.error("[CalendarTasks] POST failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to create the task." }, { status: 500 });
  }
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
