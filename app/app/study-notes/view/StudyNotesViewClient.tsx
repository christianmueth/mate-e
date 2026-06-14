"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InitialBriefing = {
  notes: string;
  title: string;
  source: string;
  deckId: string;
};

function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p class="my-3">');

  html = html.replace(/(<li>.*<\/li>(\s|\n)*)+/g, (match) => `<ul class="list-disc pl-6 space-y-1 my-3">${match}</ul>`);

  if (!html.startsWith("<")) {
    html = `<p class="my-3">${html}</p>`;
  }

  return html;
}

export default function StudyNotesViewClient({ initialBriefing }: { initialBriefing?: InitialBriefing | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialBriefing) {
      setNotes(initialBriefing.notes);
      setTitle(initialBriefing.title || "Workspace Briefing");
      setSource(initialBriefing.source || "");
      setLoading(false);
      return;
    }

    const storedData = sessionStorage.getItem("latestStudyNotes");
    if (!storedData) {
      router.push("/app");
      return;
    }

    try {
      const data = JSON.parse(storedData);
      setNotes(data.notes || "");
      setTitle(data.title || "Workspace Briefing");
      setSource(data.source || "");
    } catch (err) {
      console.error("Failed to parse workspace briefing:", err);
      router.push("/app");
    } finally {
      setLoading(false);
    }
  }, [initialBriefing, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Workspace Briefing</p>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">Workspace source: {source}</p>
        </div>
        <button
          onClick={() => router.push("/app")}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          ← Back to workspace
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(notes);
            alert("Workspace briefing copied to your clipboard.");
          }}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          📋 Copy workspace briefing
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          🖨️ Print
        </button>
      </div>

      <div className="prose prose-sm max-w-none border rounded-lg p-6 bg-white">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(notes) }}
        />
      </div>
    </div>
  );
}