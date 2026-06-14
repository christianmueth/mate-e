import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const t = (title || "").trim().slice(0, 120);
  if (!t) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const deck = await prisma.deck.findFirst({
    where: { id, user: { clerkUserId: userId } },
    select: { id: true },
  });
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.deck.update({ where: { id }, data: { title: t } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deck = await prisma.deck.findFirst({
    where: { id, user: { clerkUserId: userId } },
    select: { id: true },
  });
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.card.deleteMany({ where: { deckId: id } });
  await prisma.deck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
