/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callLLMResult } from "@/lib/aiClient";
import { prisma, safeUpsertUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "gpt-4o-mini";
const MAX_SOURCE_CHARS = 30_000;
const WORKSPACE_BRIEFING_CARD_QUESTION = "__WORKSPACE_BRIEFING__";

function cleanText(s: string) { return s.replace(/\s+/g, " ").trim(); }
function truncate(s: string, max = MAX_SOURCE_CHARS) { return s.length > max ? s.slice(0, max) : s; }

async function generateStudyNotesWithOpenAI(source: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[StudyNotes] OPENAI_API_KEY missing");
    return null;
  }
  
  const systemPrompt = `You are an expert workspace strategist. Given source material, create a professional Workspace Briefing in clean Markdown.

The briefing must contain these sections in this order:

## Executive Summary
- Summarize the most important context, conclusions, and why this material matters.

## Key Decisions
- Call out important choices, tradeoffs, open decisions, and unresolved questions.

## Action Items
- Extract practical next steps, owners if obvious, and immediate follow-through items.

## Risks & Unknowns
- Identify blockers, ambiguities, dependencies, missing information, and execution risks.

## Important Entities
- List important people, systems, timelines, teams, vendors, projects, or clients mentioned.

## Suggested Follow-Ups
- Recommend investigations, clarifications, or validation steps that should happen next.

Instructions:
- Keep the tone operational, concise, and decision-oriented.
- Prefer actionability over academic explanation.
- Use bullet points where useful.
- Do not frame the output as study notes, tutoring, or exam prep.
- If a section has limited evidence, say that clearly instead of inventing content.`;

  const userPrompt = `Create a Workspace Briefing for the following material:\n\n${truncate(source)}`;

  try {
    console.log("[StudyNotes] Calling OpenAI API...");
    
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt }
    ];
    
    const result = await callLLMResult(messages, 4000);
    if (!result.ok) {
      if (result.reason === "TIMEOUT" && String(result.lastStatus || "").toUpperCase() === "IN_QUEUE") {
        const err: any = new Error("AI generation is queued and did not start yet. Try again in a minute.");
        err.code = "AI_IN_QUEUE";
        err.jobId = result.jobId;
        err.lastStatus = result.lastStatus;
        throw err;
      }
      console.error("[StudyNotes] OpenAI call failed:", result.reason, result.httpStatus || "");
      return null;
    }

    const content = result.content;

    console.log(`[StudyNotes] Generated ${content.length} characters of notes`);
    return content.trim();
  } catch (err: any) {
    console.error("[StudyNotes] OpenAI error:", err.message);
    return null;
  }
}

async function extractPdfTextFromBuffer(buf: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    console.log("[StudyNotes/PDF] Starting extraction, buffer size:", buf.length);
    const data = await pdfParse(buf, { max: 0 });
    
    if (!data?.text) {
      console.error("[StudyNotes/PDF] No text content found");
      return "";
    }
    
    const text = cleanText(data.text);
    console.log("[StudyNotes/PDF] Extracted", text.length, "characters");
    return text;
  } catch (error) {
    console.error("[StudyNotes/PDF] Error extracting text:", error);
    return "";
  }
}

async function extractPptxTextFromBuffer(buf: Buffer): Promise<string> {
  try {
    console.log("[StudyNotes/PPTX] Starting extraction, buffer size:", buf.length);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    
    const slideFiles = Object.keys(zip.files)
      .filter((p) => p.startsWith("ppt/slides/slide") && p.endsWith(".xml"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
        return numA - numB;
      });
    
    console.log("[StudyNotes/PPTX] Found", slideFiles.length, "slides");
    if (slideFiles.length === 0) return "";
    
    const chunks: string[] = [];
    for (const p of slideFiles) {
      const xml = await zip.files[p].async("string");
      const slideText = (xml.match(/<a:t>([^<]*)<\/a:t>/g) || [])
        .map(match => match.replace(/<a:t>|<\/a:t>/g, ""))
        .filter(text => text.trim().length > 0)
        .join(" ");
      if (slideText.trim()) {
        chunks.push(`[Slide ${chunks.length + 1}] ${cleanText(slideText)}`);
      }
    }
    
    const fullText = chunks.join("\n\n");
    console.log("[StudyNotes/PPTX] Extracted", fullText.length, "characters");
    return fullText;
  } catch (error) {
    console.error("[StudyNotes/PPTX] Error extracting text:", error);
    return "";
  }
}

async function extractTextFromSource(fd: FormData): Promise<{ text: string; title: string; source: string }> {
  let text = "";
  let title = (fd.get("title") as string) || "Workspace Briefing";
  let source = "unknown";

  // Handle different content types
  const urlStr = fd.get("url") as string;
  const textContent = fd.get("source") as string;
  const file = fd.get("file") as File | null;
  const docUrl = (fd.get("docUrl") as string) || "";
  const docName = (fd.get("docName") as string) || "";

  if (textContent) {
    text = truncate(cleanText(textContent));
    source = "text";
  } else if (file) {
    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    if (fileName.endsWith(".pdf")) {
      text = await extractPdfTextFromBuffer(buffer);
      source = "pdf";
    } else if (fileName.endsWith(".pptx")) {
      text = await extractPptxTextFromBuffer(buffer);
      source = "pptx";
    }
    text = truncate(text);
  } else if (docUrl) {
    // Fetch PDF/PPTX from remote URL (e.g. Vercel Blob) to avoid request-size limits.
    try {
      const head = await fetch(docUrl, { method: "HEAD" }).catch(() => null);
      const ct = head?.ok ? head.headers.get("content-type") || "" : "";
      const res = await fetch(docUrl);
      if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const lowerName = (docName || "").toLowerCase();
      const isPdf = lowerName.endsWith(".pdf") || ct.includes("application/pdf");
      const isPptx = lowerName.endsWith(".pptx") || ct.includes("presentation");

      if (isPdf) {
        text = await extractPdfTextFromBuffer(buffer);
        source = "pdf";
      } else if (isPptx) {
        text = await extractPptxTextFromBuffer(buffer);
        source = "pptx";
      }

      text = truncate(text);
    } catch (err) {
      console.error("[StudyNotes] docUrl fetch/extract error:", err);
      text = "";
    }
  } else if (urlStr) {
    // For URLs, try to extract content (simplified - you could enhance this)
    try {
      const response = await fetch(urlStr);
      const html = await response.text();
      // Basic text extraction from HTML
      const textOnly = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      text = truncate(textOnly);
      source = "url";
    } catch (err) {
      console.error("[StudyNotes] URL fetch error:", err);
      text = `Content from URL: ${urlStr}`;
    }
  }

  if (!text) {
    throw new Error("No content provided");
  }

  return { text, title, source };
}

export async function POST(req: Request) {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production we should not silently fail if OpenAI isn't configured.
    if (process.env.NODE_ENV === "production") {
      const missingApiKey = !process.env.OPENAI_API_KEY;
      if (missingApiKey) {
        return NextResponse.json(
          {
            error: "OpenAI is not configured on the server. Set OPENAI_API_KEY in Vercel environment variables.",
            code: "OPENAI_NOT_CONFIGURED",
            missing: {
              OPENAI_API_KEY: missingApiKey,
            },
            vercel: {
              VERCEL_ENV: process.env.VERCEL_ENV || null,
              VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || null,
              VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || null,
            },
          },
          { status: 500 }
        );
      }
    }

    const fd = await req.formData();
    
    // Extract content
    const { text, title, source } = await extractTextFromSource(fd);
    console.log(`[StudyNotes] Generating notes for: ${title} (source: ${source}, ${text.length} chars)`);

    // Generate study notes
    let notes: string | null = null;
    try {
      notes = await generateStudyNotesWithOpenAI(text);
    } catch (e: any) {
      if (e?.code === "AI_IN_QUEUE") {
        return NextResponse.json(
          {
            error: "AI generation did not start within the request time limit. Please retry shortly.",
            code: "AI_IN_QUEUE",
            jobId: e?.jobId || null,
            lastStatus: e?.lastStatus || null,
          },
          { status: 503 }
        );
      }
      throw e;
    }
    
    if (!notes) {
      return NextResponse.json(
        { error: "Failed to generate study notes" },
        { status: 500 }
      );
    }

    let deckId: string | null = null;
    let persisted = false;
    try {
      const userRow = await safeUpsertUser(authResult.userId, { id: true });
      if (userRow) {
        const deck = await prisma.deck.create({
          data: {
            title,
            userId: userRow.id,
            source,
            cards: {
              create: {
                question: WORKSPACE_BRIEFING_CARD_QUESTION,
                answer: notes,
              },
            },
          },
          select: { id: true },
        });
        deckId = deck.id;
        persisted = true;
      }
    } catch (persistError) {
      console.error("[StudyNotes] Failed to persist workspace briefing:", persistError);
    }

    return NextResponse.json({
      success: true,
      notes,
      title,
      source,
      deckId,
      persisted,
    });

  } catch (error: any) {
    console.error("[StudyNotes] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate study notes" },
      { status: 500 }
    );
  }
}
