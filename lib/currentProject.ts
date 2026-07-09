import { auth } from "@clerk/nextjs/server";
import { safeUpsertUser } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspaceContext";
import { getLatestPersistedWorkspaceContext } from "@/lib/workspaceContextPersistence";

export function deriveProjectName(context: WorkspaceContext | null) {
  const preferred = context?.presentationReference?.title
    || context?.whiteboardReference?.workspaceGoal
    || context?.whiteboardReference?.boardName
    || context?.weakConcepts?.[0]
    || null;

  if (!preferred) return "New project";

  const trimmed = preferred.trim();
  if (!trimmed) return "New project";
  if (/^untitled$/i.test(trimmed) || /^untitled workspace$/i.test(trimmed) || /^untitled project$/i.test(trimmed) || /^board$/i.test(trimmed)) {
    return "New project";
  }

  return trimmed;
}

export async function getCurrentProjectFrame() {
  const authResult = await auth().catch(() => null);
  const clerkUserId = authResult?.userId ?? null;

  if (!clerkUserId) {
    return { projectName: "New project", context: null };
  }

  const user = await safeUpsertUser(clerkUserId, { id: true }).catch(() => null);
  if (!user) {
    return { projectName: "New project", context: null };
  }

  const latest = await getLatestPersistedWorkspaceContext(user.id).catch(() => ({ context: null, savedAt: null, runId: null }));
  return {
    projectName: deriveProjectName(latest.context),
    context: latest.context,
  };
}