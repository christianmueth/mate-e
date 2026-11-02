import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceProject } from "@/lib/activeWorkspaceProject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProposedBlock = { title: string; startsAt: string; endsAt: string };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ ok: false, error: "Sign in to approve calendar changes." }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: "Calendar planner storage is unavailable." }, { status: 503 });
    const project = await getActiveWorkspaceProject(user.id);
    const { id } = await context.params;

    const created = await prisma.$transaction(async (transaction) => {
      const proposal = await transaction.calendarProposal.findFirst({ where: { id, userId: user.id, projectId: project.id }, select: { id: true, title: true, projectId: true, taskId: true, status: true, items: true } });
      if (!proposal) return { kind: "missing" as const };
      if (proposal.status === "APPROVED") return { kind: "approved" as const };
      const blocks = sanitizeBlocks(proposal.items);
      if (!blocks.length) return { kind: "invalid" as const };
      const claimed = await transaction.calendarProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "APPROVED", appliedAt: new Date() },
      });
      if (!claimed.count) return { kind: "approved" as const };
      await transaction.calendarEvent.createMany({
        data: blocks.map((block) => ({
          userId: user.id,
          projectId: proposal.projectId,
          proposalId: proposal.id,
          taskId: proposal.taskId,
          title: block.title,
          startsAt: new Date(block.startsAt),
          endsAt: new Date(block.endsAt),
          timezone: "UTC",
        })),
      });
      return { kind: "created" as const, count: blocks.length };
    });

    if (created.kind === "missing") return NextResponse.json({ ok: false, error: "Scheduling proposal not found." }, { status: 404 });
    if (created.kind === "invalid") return NextResponse.json({ ok: false, error: "Scheduling proposal is invalid." }, { status: 400 });
    return NextResponse.json({ ok: true, created: created.kind === "created" ? created.count : 0, alreadyApproved: created.kind === "approved" });
  } catch (error) {
    console.error("[CalendarProposalApprove] POST failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to approve calendar changes." }, { status: 500 });
  }
}

function sanitizeBlocks(value: unknown): ProposedBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProposedBlock => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return typeof record.title === "string" && typeof record.startsAt === "string" && typeof record.endsAt === "string"
      && !Number.isNaN(new Date(record.startsAt).getTime()) && !Number.isNaN(new Date(record.endsAt).getTime());
  });
}
