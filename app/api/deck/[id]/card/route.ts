import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deck = await prisma.deck.findFirst({
    where: { id, user: { clerkUserId: userId } },
    select: { id: true },
  });
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { question, answer } = (await req.json().catch(() => ({}))) as { question?: string; answer?: string };
  const q = (question || "").trim().slice(0, 500);
  const a = (answer || "").trim().slice(0, 2000);
  if (!q || !a) return NextResponse.json({ error: "Question and answer required" }, { status: 400 });

  const created = await prisma.card.create({ data: { deckId: deck.id, question: q, answer: a } });
  return NextResponse.json({ ok: true, id: created.id });
}
