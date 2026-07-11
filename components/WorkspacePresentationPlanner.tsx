"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { UsageEntitlement } from "@/lib/subscriptionAccess";
import { readWorkspaceContext, updateWorkspaceContext, upsertWorkspaceAsset } from "@/lib/workspaceContext";

async function safeJson(response: Response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

type PresentationPlan = {
  title: string;
  audience: string;
  objective: string;
  outline: Array<{
    slideTitle: string;
    purpose: string;
    bullets: string[];
    speakerGuidance: string;
    suggestedVisual: string;
  }>;
  presenterChecklist: string[];
  exportMarkdown: string;
};

type PresentationPlanResponse = {
  ok: boolean;
  plan?: PresentationPlan;
  error?: string;
  entitlement?: UsageEntitlement | null;
};

const sourceTypeOptions = [
  { value: "notes", label: "Notes" },
  { value: "study-set", label: "Reference set" },
  { value: "tutor-summary", label: "Guidance summary" },
  { value: "transcript", label: "Transcript" },
  { value: "pdf", label: "PDF or document" },
];

export default function WorkspacePresentationPlanner() {
  const [sourceType, setSourceType] = useState("notes");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [presentationGoal, setPresentationGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [entitlement, setEntitlement] = useState<UsageEntitlement | null>(null);

  const canGenerate = sourceText.trim().length > 0;

  const outlineCount = useMemo(() => plan?.outline.length || 0, [plan]);

  useEffect(() => {
    updateWorkspaceContext((currentContext) => {
      const trimmedSourceTitle = sourceTitle.trim();
      const sourceAsset = trimmedSourceTitle
        ? {
            id: `presentation:${sourceType}:${trimmedSourceTitle.toLowerCase()}`,
            kind: sourceType,
            name: trimmedSourceTitle,
            source: "presentation" as const,
            updatedAt: new Date().toISOString(),
          }
        : null;

      return {
        ...currentContext,
        presentationReference: {
          title: plan?.title?.trim() || trimmedSourceTitle || null,
          audience: audience.trim() || plan?.audience?.trim() || null,
          objective: plan?.objective?.trim() || presentationGoal.trim() || null,
          sourceType,
          sourceTitle: trimmedSourceTitle || null,
          outlineCount,
          updatedAt: new Date().toISOString(),
        },
        uploadedAssets: sourceAsset ? upsertWorkspaceAsset(currentContext.uploadedAssets, sourceAsset) : currentContext.uploadedAssets,
      };
    });
  }, [audience, outlineCount, plan, presentationGoal, sourceTitle, sourceType]);

  async function generatePlan() {
    if (!canGenerate || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/workspace/presentation-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceTitle,
          sourceText,
          presentationGoal,
          audience,
          workspaceContext: readWorkspaceContext(),
        }),
      });

      const data = (await safeJson(response)) as PresentationPlanResponse | null;
      if (!response.ok || !data?.ok || !data.plan) {
        if (data?.entitlement) {
          setEntitlement(data.entitlement);
        }
        throw new Error(data?.error || "Presentation planning is unavailable right now.");
      }
      setPlan(data.plan as PresentationPlan);
      setEntitlement(data.entitlement || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Presentation planning is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  function updateSlideField(index: number, field: "slideTitle" | "purpose" | "speakerGuidance" | "suggestedVisual", value: string) {
    setPlan((current) => {
      if (!current) return current;
      const outline = [...current.outline];
      outline[index] = { ...outline[index], [field]: value };
      return { ...current, outline, exportMarkdown: buildMarkdown({ ...current, outline }) };
    });
  }

  function updateSlideBullets(index: number, value: string) {
    const bullets = value.split("\n").map((item) => item.trim()).filter(Boolean);
    setPlan((current) => {
      if (!current) return current;
      const outline = [...current.outline];
      outline[index] = { ...outline[index], bullets };
      return { ...current, outline, exportMarkdown: buildMarkdown({ ...current, outline }) };
    });
  }

  function downloadMarkdown() {
    if (!plan) return;
    const blob = new Blob([plan.exportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(plan.title || sourceTitle || "workspace-presentation")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPptx() {
    if (!plan || exportingPptx) return;
    setExportingPptx(true);
    try {
      const response = await fetch("/api/workspace/presentation-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        const data = await safeJson(response);
        throw new Error(data?.error || "PPTX export is unavailable right now.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(plan.title || sourceTitle || "workspace-presentation")}.pptx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PPTX export is unavailable right now.");
    } finally {
      setExportingPptx(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Organize narrative</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-950">Turn captured material into a structure you can edit.</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-800">
            Source type
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
              {sourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Working title
            <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="For example: Q3 migration readiness review" className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Audience
            <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="For example: leadership team, product org, or client stakeholders" className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Presentation goal
            <textarea value={presentationGoal} onChange={(event) => setPresentationGoal(event.target.value)} placeholder="What should the audience understand, remember, or do by the end?" className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Source material
            <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste notes, summaries, transcript excerpts, or source material here." className="mt-2 min-h-[220px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">Mate-E proposes structure and speaker guidance, but you stay in control of the final narrative and slide flow.</p>
            <button type="button" onClick={generatePlan} disabled={!canGenerate || loading || Boolean(entitlement?.locked)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading ? "Organizing..." : "Generate structure"}
            </button>
          </div>

          {entitlement ? (
            <div className={entitlement.locked
              ? "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
              : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
            }>
              <p>{entitlement.message}</p>
              {!entitlement.premiumActive ? (
                <div className="mt-3">
                  <Link href="/app/billing" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
                    Upgrade to Premium
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">Editable narrative output</p>
              <p className="mt-2 text-sm text-slate-700">{plan ? `${outlineCount} slides drafted` : "No outline yet"}</p>
            </div>
            {plan ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadMarkdown} className="rounded-full border border-fuchsia-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-fuchsia-50">
                  Export markdown
                </button>
                <button type="button" onClick={() => void downloadPptx()} disabled={exportingPptx} className="rounded-full border border-fuchsia-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-fuchsia-50 disabled:opacity-60">
                  {exportingPptx ? "Exporting PPTX..." : "Export PPTX"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {plan ? (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block text-sm font-medium text-slate-800">
                Presentation title
                <input value={plan.title} onChange={(event) => setPlan((current) => current ? { ...current, title: event.target.value, exportMarkdown: buildMarkdown({ ...current, title: event.target.value }) } : current)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-800">
                Objective
                <textarea value={plan.objective} onChange={(event) => setPlan((current) => current ? { ...current, objective: event.target.value, exportMarkdown: buildMarkdown({ ...current, objective: event.target.value }) } : current)} className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
              </label>
            </div>

            <div className="space-y-4">
              {plan.outline.map((slide, index) => (
                <div key={`${slide.slideTitle}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Slide {index + 1}</p>
                  <label className="mt-3 block text-sm font-medium text-slate-800">
                    Slide title
                    <input value={slide.slideTitle} onChange={(event) => updateSlideField(index, "slideTitle", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                  <label className="mt-3 block text-sm font-medium text-slate-800">
                    Purpose
                    <textarea value={slide.purpose} onChange={(event) => updateSlideField(index, "purpose", event.target.value)} className="mt-2 min-h-[72px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                  <label className="mt-3 block text-sm font-medium text-slate-800">
                    Bullets
                    <textarea value={slide.bullets.join("\n")} onChange={(event) => updateSlideBullets(index, event.target.value)} className="mt-2 min-h-[112px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                  </label>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-800">
                      Speaker guidance
                      <textarea value={slide.speakerGuidance} onChange={(event) => updateSlideField(index, "speakerGuidance", event.target.value)} className="mt-2 min-h-[100px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                    </label>
                    <label className="block text-sm font-medium text-slate-800">
                      Suggested visual
                      <textarea value={slide.suggestedVisual} onChange={(event) => updateSlideField(index, "suggestedVisual", event.target.value)} className="mt-2 min-h-[100px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">Presenter checklist</p>
              <div className="mt-4 space-y-2">
                {plan.presenterChecklist.map((item) => (
                  <div key={item} className="rounded-2xl border border-sky-200 bg-white/80 px-3 py-3 text-sm leading-6 text-slate-700">{item}</div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Generate structure from notes, transcripts, summaries, or guidance recaps. The output stays editable so the final presentation remains human-authored.
          </div>
        )}
      </section>
    </div>
  );
}

function buildMarkdown(plan: PresentationPlan) {
  const lines = [`# ${plan.title}`, "", `Audience: ${plan.audience}`, "", `Objective: ${plan.objective}`, ""];
  plan.outline.forEach((slide, index) => {
    lines.push(`## Slide ${index + 1}: ${slide.slideTitle}`);
    lines.push(`Purpose: ${slide.purpose}`);
    lines.push("");
    slide.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
    lines.push("");
    lines.push(`Speaker guidance: ${slide.speakerGuidance}`);
    lines.push(`Suggested visual: ${slide.suggestedVisual}`);
    lines.push("");
  });
  lines.push("## Presenter checklist");
  plan.presenterChecklist.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  return lines.join("\n");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace-presentation";
}
