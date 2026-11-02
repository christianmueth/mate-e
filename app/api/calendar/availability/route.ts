import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, safeUpsertUser } from "@/lib/db";
import { DEFAULT_AVAILABILITY, sanitizeAvailability } from "@/lib/calendarPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();
  const availability = await prisma.calendarAvailability.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ ok: true, availability: availability ? sanitizeAvailability(availability) : DEFAULT_AVAILABILITY });
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const availability = sanitizeAvailability(await request.json());
    if (availability.endMinutes <= availability.startMinutes) {
      return NextResponse.json({ ok: false, error: "Availability must end after it starts." }, { status: 400 });
    }
    const saved = await prisma.calendarAvailability.upsert({
      where: { userId: user.id },
      update: availability,
      create: { userId: user.id, ...availability },
    });
    return NextResponse.json({ ok: true, availability: sanitizeAvailability(saved) });
  } catch (error) {
    console.error("[CalendarAvailability] PUT failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to save availability." }, { status: 500 });
  }
}

async function getUser() {
  const { userId: clerkUserId } = await auth();
  return clerkUserId ? safeUpsertUser(clerkUserId, { id: true }) : null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Sign in to manage calendar availability." }, { status: 401 });
}
