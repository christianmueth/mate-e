import { NextResponse } from "next/server";
import { buildWorkspaceConstitutionPrompt } from "@/lib/workspaceConstitution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhiteboardImageRequest = {
  prompt?: string;
  workspaceGoal?: string;
  boardSummary?: string;
  annotations?: string[];
};

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildPrompt(body: WhiteboardImageRequest) {
  const rawPrompt = clean(body.prompt);
  const workspaceGoal = clean(body.workspaceGoal);
  const boardSummary = clean(body.boardSummary);
  const annotations = (body.annotations || []).map(clean).filter(Boolean).slice(0, 6);

  return buildWorkspaceConstitutionPrompt([
    "Create a single image for a human-operated workspace whiteboard.",
    "The image should help explain, plan, or visualize the requested idea.",
    "Prefer clean diagrammatic or sketch-friendly visuals over photorealism unless the prompt clearly asks for realism.",
    "Do not include watermarks, logos, UI chrome, or embedded text paragraphs.",
    rawPrompt ? `Requested image: ${rawPrompt}` : "Requested image: visualize the workspace idea.",
    workspaceGoal ? `Workspace goal: ${workspaceGoal}` : null,
    boardSummary ? `Current board: ${boardSummary}` : null,
    annotations.length ? `Board notes: ${annotations.join(" | ")}` : null,
    "Output only the image via the model response. Do not describe it in text.",
  ].filter(Boolean) as string[]);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WhiteboardImageRequest;
    const prompt = clean(body.prompt);
    if (!prompt) {
      return NextResponse.json({ ok: false, error: "An image prompt is required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const response = await fetchWithTimeout(
      `${baseUrl}/images/generations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: buildPrompt(body),
          size: "1024x1024",
        }),
      },
      180000
    );

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof data?.error === "object" && typeof (data.error as Record<string, unknown>).message === "string"
        ? (data.error as Record<string, unknown>).message as string
        : "Image generation failed.";
      return NextResponse.json({ ok: false, error: message }, { status: response.status || 500 });
    }

    const first = Array.isArray(data?.data) ? data.data[0] as Record<string, unknown> | undefined : undefined;
    const b64 = typeof first?.b64_json === "string" ? first.b64_json : null;
    const url = typeof first?.url === "string" ? first.url : null;
    if (!b64 && !url) {
      return NextResponse.json({ ok: false, error: "Image generation returned no image data." }, { status: 500 });
    }

    const imageUrl = b64 ? `data:image/png;base64,${b64}` : url;
    return NextResponse.json({ ok: true, imageUrl, model });
  } catch (error: any) {
    const message = String(error?.name || "") === "AbortError"
      ? "Image generation timed out."
      : error?.message || "Image generation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}