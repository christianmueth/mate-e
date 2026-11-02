import { prisma } from "@/lib/db";
import { getLatestPersistedWorkspaceContext } from "@/lib/workspaceContextPersistence";
import type { WorkspaceContext } from "@/lib/workspaceContext";

export function deriveWorkspaceProjectTitle(context: WorkspaceContext | null) {
  const preferred = context?.presentationReference?.title
    || context?.whiteboardReference?.workspaceGoal
    || context?.whiteboardReference?.boardName
    || context?.weakConcepts?.[0]
    || null;

  if (!preferred) return null;
  const title = preferred.trim();
  if (!title || /^(untitled|untitled workspace|untitled project|board)$/i.test(title)) return null;
  return title.slice(0, 160);
}

export async function getActiveWorkspaceProject(userId: string, context?: WorkspaceContext | null) {
  const resolvedContext = context === undefined
    ? (await getLatestPersistedWorkspaceContext(userId).catch(() => ({ context: null }))).context
    : context;
  const contextTitle = deriveWorkspaceProjectTitle(resolvedContext);

  return prisma.workspaceProject.upsert({
    where: { userId },
    create: { userId, title: contextTitle || "Workspace project" },
    update: contextTitle ? { title: contextTitle } : {},
    select: { id: true, title: true },
  });
}
