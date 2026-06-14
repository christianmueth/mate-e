import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function DeckCarousel({ userId }: { userId: string }) {
  if (!userId) return null;

  try {
    const decks = await prisma.deck.findMany({
      where: { user: { clerkUserId: userId } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true, cards: { orderBy: { createdAt: "asc" }, take: 1, select: { question: true } }, _count: { select: { cards: true } } },
    });
    if (decks.length === 0) return null;

    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace OS</p>
          <h2 className="text-xl font-semibold">Resume an active workspace</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-4 pr-2 snap-x">
            {decks.map((d) => (
              (() => {
                const briefingDeck = d.cards[0]?.question === "__WORKSPACE_BRIEFING__";
                const href = briefingDeck ? `/app/study-notes/view?deckId=${d.id}` : `/app/deck/${d.id}`;
                return (
              <Link
                key={d.id}
                href={href}
                className="min-w-[240px] snap-start rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                <div className="font-medium truncate">{d.title}</div>
                <div className="mt-1 text-xs text-gray-500">{briefingDeck ? "briefing document" : `${d._count.cards} workspace item${d._count.cards === 1 ? "" : "s"}`}</div>
              </Link>
                );
              })()
            ))}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("[DeckCarousel] Error fetching decks:", error);
    return null;
  }
}
