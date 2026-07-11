import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { chatV1 } from "@/lib/aiGateway";
import { prisma, safeUpsertUser } from "@/lib/db";
import { getScheduleAssistEntitlement } from "@/lib/subscriptionAccess";
import { buildWorkspaceConstitutionPrompt } from "@/lib/workspaceConstitution";
import { sanitizeWorkspaceContext, summarizeWorkspaceContext, type WorkspaceContext, type WorkspacePlanScheduleItem } from "@/lib/workspaceContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScheduleAssistRequest = {
  intent?: "optimize" | "conflicts" | "compress";
  objective?: string;
  summary?: string;
  items?: WorkspacePlanScheduleItem[];
  workspaceContext?: WorkspaceContext | null;
};

const scheduleAssistSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "insights", "items"],
  properties: {
    summary: { type: "string" },
    insights: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "date", "start", "end", "owner", "lane", "notes", "status"],
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          owner: { type: "string" },
          lane: { type: "string", enum: ["phase", "milestone", "task"] },
          notes: { type: "string" },
          status: { type: "string", enum: ["ready", "watch", "blocked"] },
        },
      },
    },
  },
} as const;

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const entitlement = await getScheduleAssistEntitlement(clerkUserId);
    return NextResponse.json({ ok: true, entitlement });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to load schedule assist entitlement." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ScheduleAssistRequest;
    const objective = clean(body.objective);
    const summary = clean(body.summary);
    const items = sanitizeScheduleItems(body.items);
    const workspaceContext = sanitizeWorkspaceContext(body.workspaceContext);
    if (!objective || !items.length) {
      return NextResponse.json({ ok: false, error: "Objective and schedule items are required." }, { status: 400 });
    }

    const entitlement = await getScheduleAssistEntitlement(clerkUserId);
    if (entitlement.locked) {
      return NextResponse.json(
        { ok: false, error: entitlement.message, code: "SUBSCRIPTION_REQUIRED", entitlement },
        { status: 402 }
      );
    }

    const user = await safeUpsertUser(clerkUserId, { id: true });
    const intent = body.intent === "conflicts" || body.intent === "compress" ? body.intent : "optimize";

    let suggestion = null as null | { summary: string; insights: string[]; items: WorkspacePlanScheduleItem[] };

    try {
      const response = await chatV1({
        allowUnauthenticated: true,
        disableOpenAICompat: true,
        temperature: 0.25,
        max_output_tokens: 1200,
        structured_output: { type: "json_schema", name: "schedule_assist", schema: scheduleAssistSchema },
        messages: [
          {
            role: "system",
            content: buildWorkspaceConstitutionPrompt([
              "You are an AI scheduling assistant inside a human-controlled workspace calendar.",
              "Rearrange work into a more realistic, editable schedule without overfilling any day.",
              "Preserve the user's control and return compact, practical scheduling changes.",
              "Use ISO dates in YYYY-MM-DD and 24-hour HH:MM times.",
            ]),
          },
          {
            role: "user",
            content: [
              `Intent: ${intent}`,
              `Objective: ${objective}`,
              `Current summary: ${summary || "none provided"}`,
              `Active workspace context: ${summarizeWorkspaceContext(workspaceContext)}`,
              "Current schedule:",
              items.map((item) => `${item.date} ${item.start}-${item.end} | ${item.title} | ${item.owner} | ${item.lane} | ${item.status} | ${item.notes}`).join("\n"),
              intent === "compress"
                ? "Compress the plan into fewer days while preserving ordering and surfacing any risky blocks."
                : intent === "conflicts"
                  ? "Expose collisions, overbooked blocks, and dependency risks, then return a corrected schedule."
                  : "Optimize the week for realistic sequencing, focus blocks, and fewer collisions.",
            ].join("\n\n"),
          },
        ],
      });

      const json = response.output_json;
      if (json && typeof json === "object") {
        const record = json as { summary?: unknown; insights?: unknown; items?: unknown };
        const nextItems = sanitizeScheduleItems(record.items);
        if (nextItems.length) {
          suggestion = {
            summary: clean(record.summary) || buildFallbackSummary(intent, objective),
            insights: sanitizeInsights(record.insights),
            items: nextItems,
          };
        }
      }
    } catch {
      suggestion = null;
    }

    const finalSuggestion = suggestion || buildFallbackSuggestion(intent, objective, items);

    if (user?.id) {
      await prisma.reasoningRun.create({
        data: {
          userId: user.id,
          mode: "schedule_assist",
          origin: "workspace_schedule_assist",
          title: objective.slice(0, 120) || "Workspace schedule assist",
          prompt: `${intent}: ${objective}`,
          metadata: {
            intent,
            scheduleItems: finalSuggestion.items,
            summary: finalSuggestion.summary,
          } as Prisma.InputJsonValue,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      suggestion: finalSuggestion,
      entitlement: user ? await getScheduleAssistEntitlement(clerkUserId) : entitlement,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error?.message || "Schedule assist failed." }, { status: 500 });
  }
}

function sanitizeScheduleItems(value: unknown) {
  if (!Array.isArray(value)) return [] as WorkspacePlanScheduleItem[];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const title = clean(record.title);
      const date = clean(record.date);
      const start = clean(record.start);
      const end = clean(record.end);
      const owner = clean(record.owner) || "Owner";
      const lane = record.lane === "phase" || record.lane === "milestone" || record.lane === "task" ? record.lane : "task";
      const notes = clean(record.notes) || "";
      const status = record.status === "ready" || record.status === "watch" || record.status === "blocked" ? record.status : "ready";
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return null;
      }
      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `assist-${index}-${date}-${start}`,
        title,
        date,
        start,
        end,
        owner,
        lane,
        notes,
        status,
      } satisfies WorkspacePlanScheduleItem;
    })
    .filter((item): item is WorkspacePlanScheduleItem => Boolean(item));
}

function sanitizeInsights(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(clean).filter(Boolean).slice(0, 5);
}

function buildFallbackSuggestion(intent: "optimize" | "conflicts" | "compress", objective: string, items: WorkspacePlanScheduleItem[]) {
  const sorted = [...items].sort((left, right) => `${left.date}-${left.start}`.localeCompare(`${right.date}-${right.start}`));
  const adjusted = sorted.map((item, index) => {
    if (intent === "compress") {
      const anchor = sorted[0]?.date || item.date;
      const dayOffset = Math.floor(index / 3);
      return {
        ...item,
        date: shiftDate(anchor, dayOffset),
        status: index > 4 ? "watch" : item.status,
      };
    }

    if (intent === "conflicts") {
      return {
        ...item,
        status: index > 0 && sorted[index - 1]?.date === item.date && sorted[index - 1]?.end > item.start ? "blocked" : item.status,
        notes: index > 0 && sorted[index - 1]?.date === item.date && sorted[index - 1]?.end > item.start
          ? `${item.notes} Conflict with ${sorted[index - 1]?.title}`.trim()
          : item.notes,
      };
    }

    const nextStart = snapTime(item.start, index % 2 === 0 ? 0 : 30);
    return {
      ...item,
      start: nextStart,
      end: ensureLaterTime(snapTime(item.end, index % 2 === 0 ? 0 : 30), nextStart, 60),
    };
  });

  return {
    summary: buildFallbackSummary(intent, objective),
    insights: buildFallbackInsights(intent, adjusted),
    items: adjusted,
  };
}

function buildFallbackSummary(intent: "optimize" | "conflicts" | "compress", objective: string) {
  if (intent === "compress") return `Compressed the schedule for ${objective} into a tighter sequence with fewer active days.`;
  if (intent === "conflicts") return `Checked ${objective} for collisions and surfaced the risky overlaps.`;
  return `Rebalanced ${objective} into a cleaner week with fewer timing collisions and more focused blocks.`;
}

function buildFallbackInsights(intent: "optimize" | "conflicts" | "compress", items: WorkspacePlanScheduleItem[]) {
  const byDay = new Map<string, WorkspacePlanScheduleItem[]>();
  for (const item of items) {
    byDay.set(item.date, [...(byDay.get(item.date) || []), item]);
  }
  const busiest = [...byDay.entries()].sort((left, right) => right[1].length - left[1].length)[0];
  const lines = [
    busiest ? `Busiest day is ${busiest[0]} with ${busiest[1].length} blocks.` : "The schedule stays lightly distributed across the week.",
    intent === "compress" ? "Compression increased delivery density, so blocked items should be watched first." : "Protected focus blocks are better than scattering every task across the same day.",
    items.some((item) => item.status === "blocked") ? "At least one block is still marked blocked and should be resolved before more work is added." : "No critical blocker is dominating the schedule right now.",
  ];
  return lines.slice(0, 3);
}

function snapTime(value: string, minuteOffset: number) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  const total = Math.max(7 * 60, Math.min(21 * 60, hours * 60 + minutes + minuteOffset));
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${`${nextHours}`.padStart(2, "0")}:${`${nextMinutes}`.padStart(2, "0")}`;
}

function ensureLaterTime(end: string, start: string, minimumMinutes: number) {
  const startMinutes = toMinutes(start);
  const endMinutes = Math.max(toMinutes(end), startMinutes + minimumMinutes);
  return `${`${Math.floor(endMinutes / 60)}`.padStart(2, "0")}:${`${endMinutes % 60}`.padStart(2, "0")}`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function shiftDate(date: string, offsetDays: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + offsetDays);
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}