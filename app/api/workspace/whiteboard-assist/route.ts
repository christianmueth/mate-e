import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { chatV1 } from "@/lib/aiGateway";
import { prisma, safeUpsertUser } from "@/lib/db";
import { getWhiteboardAssistEntitlement } from "@/lib/subscriptionAccess";
import { buildWorkspaceConstitutionPrompt } from "@/lib/workspaceConstitution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhiteboardAssistRequest = {
  intent?: "clean-sketch" | "flowchart" | "relationships" | "visualize";
  workspaceGoal?: string;
  annotations?: string[];
  boardSummary?: string;
  hasSourceAttachment?: boolean;
};

const whiteboardAssistSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "actions", "cautions", "nodes", "connections"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    actions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    cautions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    nodes: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "x", "y"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          x: { type: "number", minimum: 0.1, maximum: 0.9 },
          y: { type: "number", minimum: 0.12, maximum: 0.88 },
        },
      },
    },
    connections: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
} as const;

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as WhiteboardAssistRequest;
    const intent = body.intent || "visualize";
    const entitlement = await getWhiteboardAssistEntitlement(clerkUserId);
    if (entitlement.locked) {
      return NextResponse.json(
        { ok: false, error: entitlement.message, code: "SUBSCRIPTION_REQUIRED", entitlement },
        { status: 402 }
      );
    }

    const user = await safeUpsertUser(clerkUserId, { id: true });

    const response = await chatV1({
      allowUnauthenticated: true,
      temperature: 0.3,
      max_output_tokens: 700,
      structured_output: { type: "json_schema", name: "whiteboard_assist", schema: whiteboardAssistSchema },
      messages: [
        {
          role: "system",
          content: buildWorkspaceConstitutionPrompt([
            "You are an instructional workspace assistant for a human-operated whiteboard.",
            "Suggest structure, visual sequencing, and relationships.",
            "Do not propose taking control of the whiteboard.",
            "Return compact guidance that helps the learner draw the board themselves.",
          ]),
        },
        {
          role: "user",
          content: [
            `Intent: ${intent}`,
            `Workspace goal: ${clean(body.workspaceGoal) || "none provided"}`,
            `Board summary: ${clean(body.boardSummary) || "empty board"}`,
            `Source attachment present: ${body.hasSourceAttachment ? "yes" : "no"}`,
            `Annotations: ${(body.annotations || []).map(clean).filter(Boolean).join(" | ") || "none"}`,
            "Build a suggested node-and-connection overlay plus concrete drawing actions and cautions.",
          ].join("\n"),
        },
      ],
    });

    const suggestion = response.output_json;
    if (!suggestion || typeof suggestion !== "object") {
      throw new Error("Whiteboard assist did not return structured output.");
    }

    if (user?.id) {
      await prisma.reasoningRun.create({
        data: {
          userId: user.id,
          mode: "whiteboard_assist",
          origin: "workspace_whiteboard_assist",
          title: clean(body.workspaceGoal) || "Workspace whiteboard assist",
          prompt: clean(body.boardSummary) || clean(body.workspaceGoal) || intent,
          metadata: {
            intent,
            annotationCount: Array.isArray(body.annotations) ? body.annotations.length : 0,
            hasSourceAttachment: Boolean(body.hasSourceAttachment),
          } as Prisma.InputJsonValue,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      suggestion,
      entitlement: user ? await getWhiteboardAssistEntitlement(clerkUserId) : entitlement,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error?.message || "Whiteboard assist failed." }, { status: 500 });
  }
}

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}