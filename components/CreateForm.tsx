"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";

type IntakeMode = "upload" | "paste" | "write";
type UploadKind = "pdf" | "subtitle" | "video";

export default function CreateForm({
  defaultGenerationMode = "flashcards",
  lockedGenerationMode,
}: {
  defaultGenerationMode?: "flashcards" | "notes";
  lockedGenerationMode?: "flashcards" | "notes";
}) {
  const API_BODY_LIMIT = 4 * 1024 * 1024; // ~4MB body limit for serverless; larger videos will be uploaded to Blob
  const [pending, setPending] = useState(false);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("paste");
  const [pasteContent, setPasteContent] = useState("");
  const [writtenContent, setWrittenContent] = useState("");
  const [uploadKind, setUploadKind] = useState<UploadKind>("pdf");
  const [uploadName, setUploadName] = useState("");
  const [cardCount, setCardCount] = useState(20); // Default 20 cards
  const [generationMode, setGenerationMode] = useState<"flashcards" | "notes">(lockedGenerationMode || defaultGenerationMode);

  // Refs to clear file inputs programmatically
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const writeRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function removeHidden(form: HTMLFormElement, name: string) {
    form.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`).forEach((el) => el.remove());
  }

  const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB limit for PDF/PPTX

  async function uploadViaBlob(file: File, kind: "doc" | "video" | "audio") {
    const safeName = (file.name || `${kind}.bin`).replace(/[^a-zA-Z0-9._-]+/g, "_");
    const pathname = `uploads/${kind}/${Date.now()}-${safeName}`;
    return upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      multipart: file.size > 10 * 1024 * 1024,
    });
  }

  function looksLikeAudioFile(file: File) {
    const t = (file.type || "").toLowerCase();
    if (t.startsWith("audio/")) return true;
    const nm = (file.name || "").toLowerCase();
    return nm.endsWith(".mp3") || nm.endsWith(".m4a") || nm.endsWith(".wav") || nm.endsWith(".ogg") || nm.endsWith(".webm");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const form = e.currentTarget;

    setPending(true);

    try {
      // Check file sizes for document uploads only (videos can be any size via Blob upload)
      const uploadInput = form.querySelector<HTMLInputElement>('input[name="upload"]');
      const uploadFile = uploadInput?.files?.[0];
      const pdfOrPptx = uploadKind === "pdf" ? uploadFile : null;
      if (pdfOrPptx && pdfOrPptx.size > MAX_FILE_SIZE) {
        throw new Error(`That file is too large (${(pdfOrPptx.size / 1024 / 1024).toFixed(1)}MB). Keep it under 200MB so your workspace can be prepared reliably.`);
      }

      // Clear stale hidden fields from older attempts
      ["videoUrl", "videoName", "videoSize", "docUrl", "docName", "audioUrl"].forEach((n) => removeHidden(form, n));

      // Build FormData fresh with only the normalized active input
      const original = new FormData(form);
      const fd = new FormData();
      for (const [k, v] of original.entries()) {
        if (k === "upload" || k === "pasteContent" || k === "writeContent") continue;
        fd.append(k, v);
      }

      // Add card count to form data
      fd.append("cardCount", String(cardCount));

      if (intakeMode === "paste") {
        const normalizedPaste = pasteContent.trim();
        if (normalizedPaste) {
          if (looksLikeUrlInput(normalizedPaste)) {
            fd.append("url", normalizedPaste);
          } else {
            fd.append("source", normalizedPaste);
          }
        }
      }

      if (intakeMode === "write") {
        const normalizedWriting = writtenContent.trim();
        if (normalizedWriting) {
          fd.append("source", normalizedWriting);
        }
      }

      if (intakeMode === "upload" && uploadKind === "pdf") {
        const f = original.get("upload") as File | null;
        if (f && f.size > 0) {
          const sizeMB = f.size / (1024 * 1024);
          const sizeDisplay = sizeMB >= 1 ? `${sizeMB.toFixed(1)}MB` : `${(f.size / 1024).toFixed(0)}KB`;
          toast.info(`Preparing your workspace material (${sizeDisplay})...`);
          try {
            const blob = await uploadViaBlob(f, "doc");
            fd.append("docUrl", blob.url);
            fd.append("docName", f.name || "document");
            toast.success("Source ready. Building your workspace...");
          } catch (err: any) {
            console.warn("[Client] Blob doc upload failed:", err?.message || err);
            if (f.size > API_BODY_LIMIT) {
              throw new Error("We couldn't prepare that document. Please retry; large files need the upload step to finish first.");
            }
            fd.append("upload", f);
          }
        }
      } else if (intakeMode === "upload" && uploadKind === "subtitle") {
        const s = original.get("upload");
        if (s) fd.append("subtitle", s);
      }

      // Video/audio handling: upload large files to Blob and send URL instead of raw file
      const videoFile = intakeMode === "upload" && uploadKind === "video"
        ? ((original.get("upload") as File | null) ?? null)
        : null;
      if (videoFile) {
        const actualSize = videoFile.size;
        const sizeMB = actualSize / (1024 * 1024);
        const sizeKB = actualSize / 1024;

        console.log("[Client] Video file detected:", {
          name: videoFile.name,
          type: videoFile.type,
          sizeBytes: actualSize,
          sizeKB: sizeKB.toFixed(2),
          sizeMB: sizeMB.toFixed(2),
          limit: `${(API_BODY_LIMIT / (1024 * 1024)).toFixed(2)}MB`,
          needsBlobUpload: actualSize > API_BODY_LIMIT
        });
        
        const isAudio = looksLikeAudioFile(videoFile);

        if (isAudio) {
          const sizeMB = videoFile.size / (1024 * 1024);
          const sizeKB = videoFile.size / 1024;
          const sizeDisplay = sizeMB >= 1 ? `${sizeMB.toFixed(1)}MB` : `${sizeKB.toFixed(0)}KB`;
          toast.info(`Preparing your audio source (${sizeDisplay})...`);
          const blob = await uploadViaBlob(videoFile, "audio");
          fd.append("audioUrl", blob.url);
          toast.success("Audio ready. Turning it into workspace guidance...");
        } else if (actualSize > API_BODY_LIMIT) {
          // Upload to Blob for large videos (direct client upload)
          const sizeMB = videoFile.size / (1024 * 1024);
          const sizeKB = videoFile.size / 1024;
          const sizeDisplay = sizeMB >= 1 
            ? `${sizeMB.toFixed(1)}MB` 
            : `${sizeKB.toFixed(0)}KB`;

          console.log("[Client] File size check:", {
            bytes: videoFile.size,
            KB: sizeKB.toFixed(2),
            MB: sizeMB.toFixed(2),
            display: sizeDisplay
          });

          toast.info(`Preparing your video source (${sizeDisplay})...`);

          const blob = await uploadViaBlob(videoFile, "video");

          fd.append("videoUrl", blob.url);
          fd.append("videoName", videoFile.name || "video.mp4");
          toast.success("Video ready. Building workspace guidance may take a few minutes.");
        } else {
          console.log("[Client] Video small enough, sending directly in request");
          fd.append("video", videoFile);
          toast.info("Reviewing your video and building your workspace...");
        }
      }

      if (!(intakeMode === "upload" && uploadKind === "video")) {
        toast.info("Preparing your workspace material...");
      }

      // Route to the appropriate API based on mode
      const apiEndpoint = generationMode === "flashcards" ? "/api/flashcards" : "/api/study-notes";
      const controller = new AbortController();
      // Vercel functions can run for minutes; still cap client-side waits to avoid “frozen forever”.
      const timeoutMs = 330_000; // 5.5 minutes
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(apiEndpoint, { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) {
        const traceId = res.headers.get("x-quickstud-trace") || null;
        let msg = `Failed to generate (HTTP ${res.status})`;
        let j: any = null;
        try {
          j = await res.json();
          const bodyTrace = j?.traceId ? String(j.traceId) : null;
          const tid = traceId || bodyTrace;
          if (j?.error) msg = `${j.error}${j?.code ? ` [${j.code}]` : ""}${tid ? ` (traceId: ${tid})` : ""}`;
        } catch {}

        const tid = traceId || (j?.traceId ? String(j.traceId) : null);

        // RunPod serverless can queue jobs; when it doesn't start within our route timeout,
        // the API returns a retryable 503 instead of silently creating fallback content.
        if (res.status === 503 && j?.code === "RUNPOD_IN_QUEUE") {
          toast.error(`Workspace generation is briefly queued. Please retry in about 30 to 60 seconds.${tid ? ` (traceId: ${tid})` : ""}`);
          return;
        }

        if (j?.code === "YT_URL_DISABLED") {
          toast.error(
            `YouTube links are not supported right now. Upload the audio or video file directly, or add captions instead.${tid ? ` (traceId: ${tid})` : ""}`
          );
          return;
        }

        if (j?.code === "SUPADATA_FAILED" || String(j?.code || "").startsWith("SUPADATA_")) {
          toast.error(
            `We couldn't fetch a transcript for that YouTube link. Try uploading the audio, video, or captions directly instead.${tid ? ` (traceId: ${tid})` : ""}`
          );
          return;
        }

        if (res.status === 504) {
          toast.error(`Preparing this workspace took too long. Please retry in a moment.${tid ? ` (traceId: ${tid})` : ""}`);
          return;
        }

        throw new Error(msg);
      }

      if (generationMode === "notes") {
        // For workspace briefings, show the result in a viewer
        const data = await res.json();
        if (data.success && data.notes) {
          // Store briefing content in sessionStorage and redirect to a viewer page
          sessionStorage.setItem("latestStudyNotes", JSON.stringify(data));
          toast.success("Your workspace briefing is ready.");
          window.location.href = "/app/study-notes/view";
        } else {
          throw new Error("We couldn't prepare the workspace briefing.");
        }
      } else {
        // For AI checkpoints, use the existing redirect logic
        const location = res.headers.get("Location");
        if (location) {
          toast.success("Your AI checkpoints are ready.");
          window.location.href = location;
        } else {
          toast.success("Your workspace is ready.");
          window.location.reload();
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast.error("This is taking longer than expected. Please retry, or use a smaller file or direct audio upload.");
      } else {
        toast.error(err?.message || "We couldn't prepare your workspace material right now.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Generation mode selector */}
      {lockedGenerationMode ? null : (
        <div>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setGenerationMode("flashcards")}
              className={`flex-1 px-4 py-3 rounded border text-sm font-medium transition-colors ${
                generationMode === "flashcards"
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              AI Checkpoints
            </button>
            <button
              type="button"
              onClick={() => setGenerationMode("notes")}
              className={`flex-1 px-4 py-3 rounded border text-sm font-medium transition-colors ${
                generationMode === "notes"
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              Workspace Briefing
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
        <input 
          name="title" 
          placeholder="Mate-E workspace redesign" 
          className="w-full border rounded p-2" 
          required 
          minLength={3}
          maxLength={120}
        />
      </div>

      {/* AI checkpoint count selector */}
      {generationMode === "flashcards" && (
        <div>
          <label className="text-sm font-medium">AI checkpoints</label>
          <select
            className="mt-1 w-full border rounded p-2 bg-white"
            value={cardCount}
            onChange={(e) => setCardCount(Number(e.target.value))}
          >
            <option value={10}>10 checkpoints</option>
            <option value={15}>15 checkpoints</option>
            <option value={20}>20 checkpoints (recommended)</option>
            <option value={30}>30 checkpoints</option>
            <option value={50}>50 checkpoints</option>
            <option value={75}>75 checkpoints</option>
            <option value={100}>100 checkpoints (slower)</option>
          </select>
        </div>
      )}

      <div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ["upload", "Upload"],
            ["paste", "Paste"],
            ["write", "Write"],
          ] as const).map(([value, label]) => {
            const active = intakeMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setIntakeMode(value)}
                className={active
                  ? "rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-left text-white"
                  : "rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-50"
                }
              >
                <div className="text-sm font-medium">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={intakeMode === "paste" ? "" : "hidden"}>
        <div className="space-y-2">
          <textarea
            ref={pasteRef}
            name="pasteContent"
            rows={6}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="Paste"
            className="w-full border rounded p-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 border rounded"
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (clip) setPasteContent(clip);
                  else toast.message("Clipboard is empty");
                } catch {
                  toast.error("Couldn't read clipboard");
                }
              }}
            >
              Paste
            </button>
            <button
              type="button"
              className="px-3 border rounded"
              onClick={() => setPasteContent("")}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className={intakeMode === "write" ? "" : "hidden"}>
        <div className="space-y-2">
          <textarea
            ref={writeRef}
            name="writeContent"
            rows={8}
            value={writtenContent}
            onChange={(e) => setWrittenContent(e.target.value)}
            placeholder="Write"
            className="w-full border rounded p-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 border rounded"
              onClick={() => setWrittenContent("")}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className={intakeMode === "upload" ? "" : "hidden"}>
        <div className="flex items-center gap-2">
          <input
            ref={uploadRef}
            id="upload-input"
            type="file"
            name="upload"
            accept=".pptx,.pdf,.srt,.vtt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/vtt,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setUploadName(f ? f.name : "");
              setUploadKind(classifyUploadKind(f));
            }}
          />
          <button
            type="button"
            className="px-3 py-2 border rounded bg-white"
            onClick={() => uploadRef.current?.click()}
          >
            Choose file
          </button>
          <span
            className="max-w-[50%] inline-flex items-center px-3 py-1 rounded-full border bg-gray-50 text-gray-700 text-xs truncate"
            title={uploadName || "No file chosen"}
            aria-live="polite"
          >
            {uploadName || "No file chosen"}
          </span>
          <button
            type="button"
            className="px-3 py-2 border rounded"
            onClick={() => {
              if (uploadRef.current) uploadRef.current.value = "";
              setUploadName("");
              setUploadKind("pdf");
            }}
          >
            Clear
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">{describeUploadKind(uploadKind)}</div>
      </div>

      <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-60" type="submit" disabled={pending}>
        {pending 
          ? "Preparing..." 
          : generationMode === "flashcards" 
            ? "Build AI checkpoints" 
            : "Build workspace briefing"}
      </button>
    </form>
  );
}

function looksLikeUrlInput(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
}

function classifyUploadKind(file: File | undefined) {
  if (!file) return "pdf" as const;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  if (type.startsWith("video/") || type.startsWith("audio/") || /\.(mp4|mov|m4v|webm|mp3|m4a|wav|ogg)$/i.test(name)) {
    return "video" as const;
  }

  if (/\.(srt|vtt)$/i.test(name) || type.includes("vtt")) {
    return "subtitle" as const;
  }

  return "pdf" as const;
}

function describeUploadKind(kind: UploadKind) {
  if (kind === "subtitle") return "subtitle file";
  if (kind === "video") return "audio or video";
  return "document or slides";
}