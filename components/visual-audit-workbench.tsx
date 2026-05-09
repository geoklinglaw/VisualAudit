"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { useEffect, useId, useState } from "react";

import type { Region, VisionObservationResult } from "../lib/visualAudit/schemas";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 4;

type AnalyzeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

type SelectedImage = {
  file: File;
  previewUrl: string;
};

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRegionStyle(region: Extract<Region, { type: "box" }>) {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="m16 9-4-4-4 4" />
      <path d="M12 5v11" />
    </svg>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.07] bg-white/85 p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-black/35">
        {title}
      </h2>
      {children}
    </section>
  );
}

function OverlayBoxes({ result }: { result: VisionObservationResult }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {result.visible_items.map((item) =>
        item.region.type === "box" ? (
          <div
            key={item.item_id}
            className="absolute rounded-lg border-2 border-emerald-400 bg-emerald-400/10"
            style={formatRegionStyle(item.region)}
          >
            <span className="absolute left-0 top-0 -translate-y-full rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
              {item.item_id}
            </span>
          </div>
        ) : null,
      )}
      {result.visual_observations.map((observation) =>
        observation.region.type === "box" ? (
          <div
            key={observation.observation_id}
            className="absolute rounded-lg border border-amber-400/90 bg-amber-300/10"
            style={formatRegionStyle(observation.region)}
          >
            <span className="absolute right-0 top-0 -translate-y-full rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
              {observation.observation_id}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}

export function VisualAuditWorkbench() {
  const inputId = useId();
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [focusPrompt, setFocusPrompt] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>({ kind: "idle" });
  const [result, setResult] = useState<VisionObservationResult | null>(null);

  useEffect(() => {
    return () => {
      for (const image of selectedImages) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, [selectedImages]);

  const replaceSelectedImages = (nextFiles: File[]) => {
    if (nextFiles.length === 0) {
      return;
    }

    if (nextFiles.length > MAX_FILE_COUNT) {
      setAnalyzeState({
        kind: "error",
        message: `Select up to ${MAX_FILE_COUNT} JPG or PNG images.`,
      });
      return;
    }

    for (const nextFile of nextFiles) {
      if (!nextFile.type.startsWith("image/")) {
        setAnalyzeState({ kind: "error", message: "Select only JPG or PNG images." });
        return;
      }

      if (nextFile.size > MAX_FILE_SIZE_BYTES) {
        setAnalyzeState({
          kind: "error",
          message: "Each image must be 10MB or smaller.",
        });
        return;
      }
    }

    setSelectedImages((currentImages) => {
      for (const image of currentImages) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return nextFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    });

    setResult(null);
    setAnalyzeState({ kind: "idle" });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);

    if (nextFiles.length > 0) {
      replaceSelectedImages(nextFiles);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const nextFiles = Array.from(event.dataTransfer.files ?? []);

    if (nextFiles.length > 0) {
      replaceSelectedImages(nextFiles);
    }
  };

  const analyzeImage = async () => {
    if (selectedImages.length === 0) {
      setAnalyzeState({ kind: "error", message: "Select at least one image first." });
      return;
    }

    setAnalyzeState({ kind: "loading" });

    try {
      const formData = new FormData();

      for (const image of selectedImages) {
        formData.append("files", image.file);
      }

      if (focusPrompt.trim()) {
        formData.append("focusPrompt", focusPrompt.trim());
      }

      const response = await fetch("/api/visual-audit/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as
        | { ok: true; result: VisionObservationResult }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Analyze request failed." : payload.error);
      }

      setResult(payload.result);
      setAnalyzeState({ kind: "success" });
    } catch (error) {
      setResult(null);
      setAnalyzeState({
        kind: "error",
        message: error instanceof Error ? error.message : "Analyze request failed.",
      });
    }
  };

  const primaryImage = selectedImages[0] ?? null;

  return (
    <main className="min-h-screen bg-[#f6f6fa] px-5 py-8 text-[#0f0f14] md:px-8">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[260px] -top-[220px] h-[640px] w-[640px] rounded-full bg-violet-300/18 blur-[150px]" />
        <div className="absolute right-[-220px] top-[18%] h-[520px] w-[520px] rounded-full bg-indigo-300/14 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-violet-600 transition hover:text-violet-700"
            >
              Back to overview
            </Link>
            <h1 className="mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-bold tracking-[-0.05em]">
              Vision Observation MVP
            </h1>
            <p className="mt-3 max-w-[640px] text-base leading-7 text-black/45">
              Upload outfit images to extract structured visual observations only. This pass
              does not generate advice, attractiveness judgments, or body-shape classifications.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-300/70 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            Model: <span className="font-semibold">gpt-5.4-mini</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <section
            className={`rounded-[28px] border bg-white/80 p-5 shadow-sm transition ${
              isDragging ? "border-violet-400/60" : "border-black/[0.07]"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.13em] text-black/35">
                  Upload
                </p>
                <p className="mt-1 text-sm text-black/45">
                  Up to {MAX_FILE_COUNT} JPG or PNG images, 10MB each.
                </p>
              </div>
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-medium text-black/60 transition hover:bg-black/[0.03] hover:text-black/80"
              >
                <span className="size-[18px]">
                  <UploadIcon />
                </span>
                Choose images
              </label>
              <input
                id={inputId}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg"
                multiple
                onChange={handleFileChange}
              />
            </div>

            <div
              className={`relative overflow-hidden rounded-[24px] border-2 border-dashed transition ${
                isDragging
                  ? "border-violet-400/70 bg-violet-50/70"
                  : "border-black/[0.1] bg-black/[0.02]"
              }`}
            >
              {primaryImage ? (
                <div className="grid gap-4 p-4">
                  <div className="relative overflow-hidden rounded-[20px] bg-black/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryImage.previewUrl}
                      alt={primaryImage.file.name}
                      className="block max-h-[760px] w-full object-contain"
                    />
                    {result ? <OverlayBoxes result={result} /> : null}
                  </div>
                  {selectedImages.length > 1 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {selectedImages.slice(1).map((image, index) => (
                        <div
                          key={`${image.file.name}-${index}`}
                          className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="h-32 w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs leading-6 text-black/38">
                    Bounding boxes are drawn on the first image. Additional images are sent as
                    supporting context because the current schema does not include per-image region
                    references.
                  </p>
                </div>
              ) : (
                <div className="grid min-h-[360px] place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-black/[0.08] bg-white text-black/35">
                      <span className="size-7">
                        <UploadIcon />
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-black/65">
                      {isDragging ? "Release to select the images" : "Drop outfit images here"}
                    </p>
                    <p className="mt-2 text-sm text-black/35">
                      The images stay client-side until you click Analyze image.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="focusPrompt"
                className="mb-2 block text-sm font-semibold uppercase tracking-[0.13em] text-black/35"
              >
                Focus Question
              </label>
              <textarea
                id="focusPrompt"
                value={focusPrompt}
                onChange={(event) => setFocusPrompt(event.target.value)}
                rows={4}
                placeholder="Optional: tell VisualAudit what to focus on, for example: compare the top and bottom contrast, or describe what appears oversized in this image."
                className="w-full rounded-3xl border border-black/[0.08] bg-white px-4 py-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analyzeImage}
                disabled={selectedImages.length === 0 || analyzeState.kind === "loading"}
                className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(99,102,241,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                {analyzeState.kind === "loading" ? "Analyzing..." : "Analyze image"}
              </button>
              {selectedImages.length > 0 ? (
                <span className="text-sm text-black/40">
                  {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} selected
                </span>
              ) : null}
              {analyzeState.kind === "error" ? (
                <span className="text-sm font-medium text-red-500">{analyzeState.message}</span>
              ) : null}
              {analyzeState.kind === "success" ? (
                <span className="text-sm font-medium text-emerald-600">
                  Structured observations returned successfully.
                </span>
              ) : null}
            </div>
          </section>

          <div className="grid gap-6">
            <ResultSection title="Image Summary">
              <p className="text-[15px] leading-7 text-black/65">
                {result?.image_summary ?? "No analysis yet."}
              </p>
            </ResultSection>

            <ResultSection title="Image Quality">
              {result ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.13em] text-black/35">Lighting</p>
                    <p className="mt-2 text-lg font-semibold capitalize">
                      {result.image_quality.lighting}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.13em] text-black/35">Angle</p>
                    <p className="mt-2 text-lg font-semibold capitalize">
                      {result.image_quality.angle}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.13em] text-black/35">
                      Occlusion
                    </p>
                    <p className="mt-2 text-lg font-semibold capitalize">
                      {result.image_quality.occlusion}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.13em] text-black/35">
                      Confidence
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatConfidence(result.image_quality.confidence)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-black/40">
                  Quality metrics will appear after analysis.
                </p>
              )}
            </ResultSection>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ResultSection title="Detected Subjects">
            {result?.detected_subjects.length ? (
              <div className="grid gap-3">
                {result.detected_subjects.map((subject) => (
                  <article key={subject.subject_id} className="rounded-2xl bg-black/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-black/75">{subject.subject_id}</p>
                      <span className="text-sm capitalize text-black/45">{subject.type}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/55">
                      {subject.visibility}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-black/35">
                      Confidence {formatConfidence(subject.confidence)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-black/40">No subject data yet.</p>
            )}
          </ResultSection>

          <ResultSection title="Visible Items">
            {result?.visible_items.length ? (
              <div className="grid gap-3">
                {result.visible_items.map((item) => (
                  <article key={item.item_id} className="rounded-2xl bg-black/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-black/75">{item.item_id}</p>
                      <span className="text-sm capitalize text-black/45">{item.category}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/55">{item.description}</p>
                    <div className="mt-3 grid gap-2 text-sm text-black/50 sm:grid-cols-3">
                      <p>
                        <span className="font-medium text-black/65">Color:</span> {item.color}
                      </p>
                      <p>
                        <span className="font-medium text-black/65">Shape/Fit:</span>{" "}
                        {item.shape_or_fit}
                      </p>
                      <p>
                        <span className="font-medium text-black/65">Texture:</span>{" "}
                        {item.material_or_texture}
                      </p>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-black/35">
                      Confidence {formatConfidence(item.confidence)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-black/40">
                Visible garments and accessories will appear here.
              </p>
            )}
          </ResultSection>

          <ResultSection title="Visual Observations">
            {result?.visual_observations.length ? (
              <div className="grid gap-3">
                {result.visual_observations.map((observation) => (
                  <article
                    key={observation.observation_id}
                    className="rounded-2xl bg-black/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-black/75">
                        {observation.observation_id}
                      </p>
                      <span className="text-sm capitalize text-black/45">
                        {observation.observation_type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/55">
                      {observation.text}
                    </p>
                    <p className="mt-3 text-sm text-black/45">
                      Evidence:{" "}
                      {observation.evidence_item_ids.length
                        ? observation.evidence_item_ids.join(", ")
                        : "No linked items"}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-black/35">
                      Confidence {formatConfidence(observation.confidence)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-black/40">Structured observations will appear here.</p>
            )}
          </ResultSection>

          <ResultSection title="Image Limitations">
            {result?.image_limitations.length ? (
              <ul className="grid gap-3 text-sm leading-6 text-black/55">
                {result.image_limitations.map((limitation) => (
                  <li
                    key={limitation}
                    className="rounded-2xl bg-black/[0.03] px-4 py-3"
                  >
                    {limitation}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-black/40">
                Limitations will be listed after analysis.
              </p>
            )}
          </ResultSection>
        </div>

        <div className="mt-6">
          <ResultSection title="Raw JSON">
            <pre className="overflow-x-auto rounded-2xl bg-[#11131a] p-4 text-xs leading-6 text-[#d5dcff]">
              {result
                ? JSON.stringify(result, null, 2)
                : "{\n  \"ok\": false,\n  \"result\": null\n}"}
            </pre>
          </ResultSection>
        </div>
      </div>
    </main>
  );
}
