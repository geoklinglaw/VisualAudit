"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { useEffect, useId, useState } from "react";

import { builtInPacks } from "../lib/domainPacks/index";
import type { DomainPack } from "../lib/domainPacks/types";
import type { AuditReport } from "../lib/visualAudit/analysisTypes";
import type { Region, VisionObservationResult } from "../lib/visualAudit/schemas";
import { useAudit } from "./audit-context";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 4;

type AnalyzeState =
  | { kind: "idle" }
  | { kind: "observing" }
  | { kind: "synthesizing" }
  | { kind: "success" }
  | { kind: "error"; message: string };

type SynthesisState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const VERDICT_CONFIG = {
  supported: {
    chip: "bg-emerald-100 text-emerald-900 border-emerald-200 hover:bg-emerald-150",
    activeChip: "bg-emerald-200 text-emerald-900 border-emerald-300",
    drawer: "bg-emerald-50 border-emerald-200",
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    icon: "✓",
    label: "Supported",
  },
  unsupported: {
    chip: "bg-red-100 text-red-900 border-red-200 hover:bg-red-150",
    activeChip: "bg-red-200 text-red-900 border-red-300",
    drawer: "bg-red-50 border-red-200",
    pill: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    icon: "✗",
    label: "Unsupported",
  },
  inconclusive: {
    chip: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-150",
    activeChip: "bg-amber-200 text-amber-900 border-amber-300",
    drawer: "bg-amber-50 border-amber-200",
    pill: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-400",
    icon: "~",
    label: "Unclear",
  },
} as const;

type CanvasSegment = {
  text: string;
  key: string;
  claimIndex: number | null;
};

async function parseApiJson<T>(response: Response, label: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (!contentType.includes("application/json")) {
    const returnedHtml = rawBody.trimStart().startsWith("<");
    throw new Error(
      returnedHtml
        ? `${label} returned HTML instead of JSON. Restart the Next server so the latest API routes are loaded.`
        : `${label} returned ${contentType || "an unknown content type"} instead of JSON.`,
    );
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(`${label} returned malformed JSON.`);
  }
}

function getClaimTokens(value: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "its",
    "of",
    "or",
    "that",
    "the",
    "this",
    "to",
    "with",
  ]);

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function scoreClaimMatch(claim: string, segment: string) {
  const claimTokens = getClaimTokens(claim);
  const segmentTokens = new Set(getClaimTokens(segment));

  if (claimTokens.length === 0 || segmentTokens.size === 0) return 0;

  const overlap = claimTokens.filter((token) => segmentTokens.has(token)).length;
  return overlap / claimTokens.length;
}

function buildCanvasSegments(sourceText: string, analysis: AuditReport): CanvasSegment[] {
  const source = sourceText.trim();
  if (!source) {
    return analysis.claim_verdicts.map((claim, index) => ({
      text: claim.claim,
      key: `fallback-${index}`,
      claimIndex: index,
    }));
  }

  const rawSegments =
    source.match(/\s+|[^,.;!?\n]+[,.;!?]?|\n+/g)?.map((text, index) => ({
      text,
      key: `segment-${index}`,
      claimIndex: null as number | null,
    })) ?? [];

  const textSegmentIndexes = rawSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.text.trim().length > 0);

  const assignments = new Map<number, number>();
  const claimedSegments = new Set<number>();

  analysis.claim_verdicts.forEach((claim, claimIndex) => {
    let bestScore = 0;
    let bestSegmentIndex: number | null = null;

    for (const { segment, index } of textSegmentIndexes) {
      if (claimedSegments.has(index)) continue;
      const score = scoreClaimMatch(claim.claim, segment.text);
      if (score > bestScore) {
        bestScore = score;
        bestSegmentIndex = index;
      }
    }

    if (bestSegmentIndex !== null && bestScore >= 0.34) {
      assignments.set(bestSegmentIndex, claimIndex);
      claimedSegments.add(bestSegmentIndex);
    }
  });

  return rawSegments.map((segment, index) => ({
    ...segment,
    claimIndex: assignments.get(index) ?? null,
  }));
}

function InteractiveAuditReport({
  analysis,
  sourceText,
}: {
  analysis: AuditReport;
  sourceText: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activePrinciple, setActivePrinciple] = useState<string | null>(null);
  const activeClaim =
    activeIndex === null ? null : (analysis.claim_verdicts[activeIndex] ?? null);
  const activeClaimConfig = activeClaim
    ? (VERDICT_CONFIG[activeClaim.verdict] ?? VERDICT_CONFIG.inconclusive)
    : null;
  const canvasIntro = sourceText.trim()
    ? "Click highlighted text in your prompt"
    : "Detected claims from the audit";
  const canvasSegments = buildCanvasSegments(sourceText, analysis);

  return (
    <div className="grid gap-5">
      {analysis.claim_verdicts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.8fr)]">
          <div className="min-h-[420px] rounded-xl border border-black/[0.08] bg-[#fbfbfd] p-4 shadow-inner">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black/30">
                  Canvas
                </p>
                <p className="mt-1 text-sm text-black/45">{canvasIntro}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[0.72rem] font-medium text-black/38">
                {Object.entries(VERDICT_CONFIG).map(([verdict, cfg]) => (
                  <span key={verdict} className="inline-flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.06] bg-white p-5">
              <p className="whitespace-pre-wrap text-[0.95rem] leading-8 text-black/58">
                {canvasSegments.map((segment) => {
                  if (segment.claimIndex === null) {
                    return <span key={segment.key}>{segment.text}</span>;
                  }

                  const claim = analysis.claim_verdicts[segment.claimIndex];
                  const cfg = VERDICT_CONFIG[claim.verdict] ?? VERDICT_CONFIG.inconclusive;
                  const isActive = activeIndex === segment.claimIndex;

                  return (
                    <button
                      key={segment.key}
                      type="button"
                      onClick={() =>
                        setActiveIndex(isActive ? null : segment.claimIndex)
                      }
                      className={`inline rounded-md border px-1.5 py-0.5 text-left align-baseline leading-7 transition ${
                        isActive
                          ? `${cfg.activeChip} shadow-[0_0_0_3px_rgba(124,58,237,0.14)]`
                          : cfg.chip
                      }`}
                      aria-pressed={isActive}
                    >
                      {segment.text}
                    </button>
                  );
                })}
              </p>
            </div>

            <p className="mt-3 text-xs leading-5 text-black/35">
              Click a highlighted claim to inspect the audit evidence.
            </p>
          </div>

          <aside className="rounded-xl border border-black/[0.08] bg-white p-4">
            <div className="mb-4 border-b border-black/[0.06] pb-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black/30">
                Inspector
              </p>
              <p className="mt-1 text-sm text-black/45">
                {activeClaim ? "Selected claim analysis" : "Select a highlighted claim"}
              </p>
            </div>

            {activeClaim && activeClaimConfig ? (
              <div className="grid gap-4">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-wide ${activeClaimConfig.pill}`}
                  >
                    <span className={`size-1.5 rounded-full ${activeClaimConfig.dot}`} />
                    {activeClaimConfig.label}
                  </span>
                  <p className="mt-3 text-[1rem] font-semibold leading-6 text-black/75">
                    {activeClaim.claim}
                  </p>
                </div>

                <div className={`rounded-lg border px-3.5 py-3 ${activeClaimConfig.drawer}`}>
                  <p className="text-sm leading-6 text-black/65">{activeClaim.evidence_summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-black/[0.03] p-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-black/35">
                      Confidence
                    </p>
                    <p className="mt-1 text-lg font-semibold text-black/75">
                      {Math.round(activeClaim.confidence * 100)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/[0.03] p-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-black/35">
                      Evidence
                    </p>
                    <p className="mt-1 text-lg font-semibold text-black/75">
                      {activeClaim.supporting_observation_ids.length +
                        activeClaim.contradicting_observation_ids.length}
                    </p>
                  </div>
                </div>

                {activeClaim.supporting_observation_ids.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-black/35">
                      Supporting observations
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeClaim.supporting_observation_ids.map((id) => (
                        <span
                          key={id}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeClaim.contradicting_observation_ids.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-black/35">
                      Contradicting observations
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeClaim.contradicting_observation_ids.map((id) => (
                        <span
                          key={id}
                          className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-black/[0.1] bg-black/[0.015] p-6 text-center">
                <p className="max-w-[220px] text-sm leading-6 text-black/38">
                  The evidence summary, verdict, confidence, and observation IDs will appear here.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
        <p>{analysis.question_answer}</p>
        <p className="text-violet-800/70">{analysis.audit_summary}</p>
      </div>

      {/* Compact principle pills */}
      {analysis.principle_assessments.length > 0 && (
        <div>
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-black/30">
            Principles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.principle_assessments.map((pa) => {
              const cfg = VERDICT_CONFIG[pa.verdict] ?? VERDICT_CONFIG.inconclusive;
              const isOpen = activePrinciple === pa.principle_id;
              return (
                <div key={pa.principle_id} className="contents">
                  <button
                    type="button"
                    onClick={() => setActivePrinciple(isOpen ? null : pa.principle_id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-medium transition-colors ${cfg.pill}`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: "currentColor", opacity: 0.5 }} />
                    {pa.category.replace(/_/g, " ")}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Show assessment for active principle */}
          {activePrinciple && (() => {
            const pa = analysis.principle_assessments.find((p) => p.principle_id === activePrinciple);
            if (!pa) return null;
            const cfg = VERDICT_CONFIG[pa.verdict] ?? VERDICT_CONFIG.inconclusive;
            return (
              <div className={`mt-2 rounded-xl border px-3.5 py-3 text-sm leading-6 text-black/60 ${cfg.drawer}`}>
                {pa.assessment}
              </div>
            );
          })()}
        </div>
      )}

      {/* Confidence note */}
      {analysis.confidence_note && (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 text-[13px] leading-6 text-black/55">
          <span className="font-semibold text-amber-700">Note: </span>
          {analysis.confidence_note}
        </p>
      )}
    </div>
  );
}

function AnalysisLoadingPlaceholder() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="h-4 w-3/4 rounded-full bg-black/[0.06]" />
      <div className="h-4 w-full rounded-full bg-black/[0.06]" />
      <div className="h-4 w-5/6 rounded-full bg-black/[0.06]" />
      <div className="mt-2 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-violet-100/80" />
        <div className="h-6 w-24 rounded-full bg-violet-100/80" />
      </div>
    </div>
  );
}

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

function PackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CollapsibleSection({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count?: number;
  emptyLabel: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasData = count !== undefined && count > 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white/85 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] disabled:cursor-default"
        aria-expanded={isOpen}
        disabled={!hasData}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-black/35">
            {title}
          </h2>
          {hasData ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.68rem] font-semibold text-violet-600">
              {count}
            </span>
          ) : (
            <span className="text-[0.72rem] font-normal text-black/25">{emptyLabel}</span>
          )}
        </div>
        {hasData && (
          <ChevronDownIcon
            className={`size-4 shrink-0 text-black/25 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-black/[0.05] px-5 pb-5 pt-4">{children}</div>
        </div>
      </div>
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

function validateDomainPack(value: unknown): value is DomainPack {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.description === "string" &&
    Array.isArray(v.observable_entities) &&
    Array.isArray(v.observation_categories) &&
    Array.isArray(v.item_categories) &&
    Array.isArray(v.subject_types) &&
    Array.isArray(v.principles) &&
    Array.isArray(v.forbidden_claims)
  );
}

function DomainPackPicker() {
  const { selectedPack, setSelectedPack, customPacks, addCustomPack } = useAudit();
  const fileInputId = useId();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const allPacks = [...builtInPacks, ...customPacks];

  const handlePackFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string);
        if (validateDomainPack(parsed)) {
          addCustomPack(parsed);
          setUploadError(null);
        } else {
          setUploadError(
            "Invalid pack JSON — must include id, name, description, and arrays for observable_entities, observation_categories, item_categories, subject_types, principles, and forbidden_claims.",
          );
        }
      } catch {
        setUploadError("Could not parse file as JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="border-t border-black/[0.06] pt-4">
      <p className="mb-2.5 text-sm font-semibold uppercase tracking-[0.13em] text-black/35">
        Domain Pack
      </p>
      <div className="flex flex-wrap gap-2">
        {allPacks.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setSelectedPack(pack)}
            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${
              selectedPack.id === pack.id
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-black/[0.08] bg-white text-black/50 hover:border-black/20 hover:text-black/70"
            }`}
          >
            {pack.name}
          </button>
        ))}
        <label
          htmlFor={fileInputId}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-dashed border-black/[0.14] bg-transparent px-3 py-1.5 text-sm font-medium text-black/38 transition hover:border-violet-300 hover:text-violet-600"
        >
          + Upload pack JSON
        </label>
        <input
          id={fileInputId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={handlePackFile}
        />
      </div>
      {uploadError ? (
        <p className="mt-2 text-xs font-medium text-red-500">{uploadError}</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-black/35">{selectedPack.description}</p>
    </div>
  );
}

export function VisualAuditWorkbench() {
  const inputId = useId();
  const { files, setFiles, focusPrompt, setFocusPrompt, selectedPack } = useAudit();
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>(() =>
    files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>({ kind: "idle" });
  const [synthesisState, setSynthesisState] = useState<SynthesisState>({ kind: "idle" });
  const [result, setResult] = useState<VisionObservationResult | null>(null);
  const [analysis, setAnalysis] = useState<AuditReport | null>(null);

  useEffect(() => {
    return () => {
      for (const image of selectedImages) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, [selectedImages]);

  const replaceSelectedImages = (nextFiles: File[]) => {
    if (nextFiles.length === 0) return;

    if (nextFiles.length > MAX_FILE_COUNT) {
      setAnalyzeState({
        kind: "error",
        message: `Select up to ${MAX_FILE_COUNT} images.`,
      });
      return;
    }

    for (const nextFile of nextFiles) {
      if (!nextFile.type.startsWith("image/")) {
        setAnalyzeState({ kind: "error", message: "Select only image files." });
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
      for (const image of currentImages) URL.revokeObjectURL(image.previewUrl);
      return nextFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    });

    setFiles(nextFiles);
    setResult(null);
    setAnalysis(null);
    setSynthesisState({ kind: "idle" });
    setAnalyzeState({ kind: "idle" });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length > 0) replaceSelectedImages(nextFiles);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const nextFiles = Array.from(event.dataTransfer.files ?? []);
    if (nextFiles.length > 0) replaceSelectedImages(nextFiles);
  };

  const analyzeImage = async () => {
    if (selectedImages.length === 0) {
      setAnalyzeState({ kind: "error", message: "Select at least one image first." });
      return;
    }

    setAnalyzeState({ kind: "observing" });
    setResult(null);
    setAnalysis(null);
    setSynthesisState({ kind: "idle" });

    try {
      const formData = new FormData();
      for (const image of selectedImages) formData.append("files", image.file);
      if (focusPrompt.trim()) formData.append("focusPrompt", focusPrompt.trim());
      formData.append("pack", JSON.stringify(selectedPack));

      const obsResponse = await fetch("/api/visual-audit/analyze", {
        method: "POST",
        body: formData,
      });

      const obsPayload = await parseApiJson<
        | { ok: true; result: VisionObservationResult }
        | { ok: false; error: string }
      >(obsResponse, "Vision observation");

      if (!obsResponse.ok || !obsPayload.ok) {
        throw new Error(obsPayload.ok ? "Analyze request failed." : obsPayload.error);
      }

      setResult(obsPayload.result);
      setAnalyzeState({ kind: "synthesizing" });
      setSynthesisState({ kind: "loading" });

      try {
        const synResponse = await fetch("/api/visual-audit/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observation: obsPayload.result,
            userQuestion: focusPrompt.trim() || null,
            pack: selectedPack,
          }),
        });

        const synPayload = await parseApiJson<
          | { ok: true; analysis: AuditReport }
          | { ok: false; error: string }
        >(synResponse, "Audit synthesis");

        if (!synResponse.ok || !synPayload.ok) {
          setSynthesisState({
            kind: "error",
            message: synPayload.ok ? "Audit could not be completed." : synPayload.error,
          });
        } else {
          setAnalysis(synPayload.analysis);
          setSynthesisState({ kind: "success" });
        }
      } catch (error) {
        setSynthesisState({
          kind: "error",
          message: error instanceof Error ? error.message : "Audit could not be completed.",
        });
      }

      setAnalyzeState({ kind: "success" });
    } catch (error) {
      setResult(null);
      setAnalysis(null);
      setSynthesisState({ kind: "idle" });
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
              Visual Claim Inspector
            </h1>
            <p className="mt-3 max-w-[640px] text-base leading-7 text-black/45">
              Upload an image and paste what an AI told you about it.
              Each claim is checked against what is actually visible, with evidence cited for every verdict.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-violet-300/70 bg-violet-50 px-4 py-2.5">
              <span className="size-[15px] text-violet-500">
                <PackIcon />
              </span>
              <span className="text-sm font-semibold text-violet-700">{selectedPack.name}</span>
            </div>
            <div className="rounded-2xl border border-black/[0.07] bg-white/80 px-3 py-1.5 text-xs text-black/40">
              Vision: <span className="font-semibold">gpt-5.5</span> · Analysis:{" "}
              <span className="font-semibold">gpt-5.5</span>
            </div>
          </div>

        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-2">
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
                  Up to {MAX_FILE_COUNT} images, 10MB each.
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
                      className="block max-h-[440px] w-full object-contain"
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
                    Boxes show where the AI found visual evidence. Extra images are used as
                    supporting context.
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
                      {isDragging ? "Release to select images" : "Drop images here"}
                    </p>
                    <p className="mt-2 text-sm text-black/35">
                      Images stay client-side until you click Audit.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-4 rounded-[28px] border border-black/[0.07] bg-white/80 p-5 shadow-sm">
            <div>
              <label
                htmlFor="focusPrompt"
                className="mb-2 block text-sm font-semibold uppercase tracking-[0.13em] text-black/35"
              >
                Upload your question and the answer given by AI
              </label>
              <textarea
                id="focusPrompt"
                value={focusPrompt}
                onChange={(event) => setFocusPrompt(event.target.value)}
                rows={20}
                placeholder={`Paste what an AI told you about this image, or ask a question to verify.\nExample: "The AI said this outfit creates a slimming effect — is that visible?"`}
                className="min-h-[360px] w-full resize-y rounded-3xl border border-black/[0.08] bg-white px-4 py-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analyzeImage}
                disabled={
                  selectedImages.length === 0 ||
                  analyzeState.kind === "observing" ||
                  analyzeState.kind === "synthesizing"
                }
                className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(99,102,241,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                {analyzeState.kind === "observing"
                  ? "Observing..."
                  : analyzeState.kind === "synthesizing"
                    ? "Auditing..."
                    : "Audit the claim"}
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
                <span className="text-sm font-medium text-emerald-600">Successful.</span>
              ) : null}
            </div>

          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ResultSection title="Plain Summary">
            <p className="text-[15px] leading-7 text-black/65">
              {result?.image_summary ?? "No analysis yet."}
            </p>
          </ResultSection>

          <ResultSection title="Image Quality Check">
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
                  <p className="text-xs uppercase tracking-[0.13em] text-black/35">Occlusion</p>
                  <p className="mt-2 text-lg font-semibold capitalize">
                    {result.image_quality.occlusion}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.13em] text-black/35">Confidence</p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatConfidence(result.image_quality.confidence)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-black/40">
                Image trust notes will appear after analysis.
              </p>
            )}
          </ResultSection>
        </div>

        {synthesisState.kind !== "idle" || analysis ? (
          <div className="mt-6">
            <ResultSection title="Audit Report">
              {synthesisState.kind === "loading" ? (
                <AnalysisLoadingPlaceholder />
              ) : synthesisState.kind === "error" ? (
                <p className="text-sm font-medium text-red-500">{synthesisState.message}</p>
              ) : analysis ? (
                <InteractiveAuditReport analysis={analysis} sourceText={focusPrompt} />
              ) : null}
            </ResultSection>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <CollapsibleSection
            title="People or Main Subjects"
            count={result?.detected_subjects.length}
            emptyLabel="run audit to populate"
          >
            <div className="grid gap-3">
              {result?.detected_subjects.map((subject) => (
                <article key={subject.subject_id} className="rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-black/75">{subject.subject_id}</p>
                    <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs capitalize text-black/45">
                      {subject.type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/55">{subject.visibility}</p>
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.12em] text-black/30">
                    Confidence {formatConfidence(subject.confidence)}
                  </p>
                </article>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Visible Things"
            count={result?.visible_items.length}
            emptyLabel="run audit to populate"
          >
            <div className="grid gap-3">
              {result?.visible_items.map((item) => (
                <article key={item.item_id} className="rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-black/75">{item.item_id}</p>
                    <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs capitalize text-black/45">
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/55">{item.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
                    <span>
                      <span className="font-medium text-black/55">Color</span> {item.color}
                    </span>
                    <span>
                      <span className="font-medium text-black/55">Form</span> {item.shape_or_fit}
                    </span>
                    <span>
                      <span className="font-medium text-black/55">Texture</span>{" "}
                      {item.material_or_texture}
                    </span>
                  </div>
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.12em] text-black/30">
                    Confidence {formatConfidence(item.confidence)}
                  </p>
                </article>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="What the AI Noticed"
            count={result?.visual_observations.length}
            emptyLabel="run audit to populate"
          >
            <div className="grid gap-3">
              {result?.visual_observations.map((observation) => (
                <article
                  key={observation.observation_id}
                  className="rounded-2xl bg-black/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-black/75">{observation.observation_id}</p>
                    <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs capitalize text-black/45">
                      {observation.observation_type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/55">{observation.text}</p>
                  {observation.evidence_item_ids.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {observation.evidence_item_ids.map((id) => (
                        <span
                          key={id}
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-medium text-amber-700"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.12em] text-black/30">
                    Confidence {formatConfidence(observation.confidence)}
                  </p>
                </article>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="What May Be Uncertain"
            count={result?.image_limitations.length}
            emptyLabel="run audit to populate"
          >
            <ul className="grid gap-2.5 text-sm leading-6 text-black/55">
              {result?.image_limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="flex items-start gap-2.5 rounded-2xl bg-amber-50/70 px-4 py-3 text-amber-900/70"
                >
                  <span className="mt-0.5 shrink-0 text-amber-400">⚠</span>
                  {limitation}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        </div>
      </div>
    </main>
  );
}
