import { auth } from "@clerk/nextjs/server";
import { safeUpsertUser } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspaceContext";
import { getLatestPersistedWorkspaceContext } from "@/lib/workspaceContextPersistence";
import { deriveWorkspaceProjectTitle, getActiveWorkspaceProject } from "@/lib/activeWorkspaceProject";

export function deriveProjectName(context: WorkspaceContext | null) {
  return deriveWorkspaceProjectTitle(context) || "New project";
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
  const project = await getActiveWorkspaceProject(user.id, latest.context).catch(() => null);
  return {
    projectName: project?.title || deriveProjectName(latest.context),
    context: latest.context,
  };
}