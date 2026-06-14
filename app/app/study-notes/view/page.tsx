export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import StudyNotesViewClient from "./StudyNotesViewClient";

export default async function StudyNotesViewPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const { deckId } = await searchParams;
  let initialBriefing: { notes: string; title: string; source: string; deckId: string } | null = null;

  if (deckId) {
    const { userId } = await auth();
    if (userId) {
      const deck = await prisma.deck.findFirst({
        where: { id: deckId, user: { clerkUserId: userId } },
        select: {
          id: true,
          title: true,
          source: true,
          cards: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { question: true, answer: true },
          },
        },
      });

      const savedBriefing = deck?.cards[0];
      if (deck && savedBriefing?.question === "__WORKSPACE_BRIEFING__") {
        initialBriefing = {
          notes: savedBriefing.answer,
          title: deck.title,
          source: deck.source || "unknown",
          deckId: deck.id,
        };
      }
    }
  }

  return <StudyNotesViewClient initialBriefing={initialBriefing} />;
}
