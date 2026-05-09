"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";

import { builtInPacks } from "../lib/domainPacks";
import type { DomainPack } from "../lib/domainPacks/types";
import { useAudit } from "./audit-context";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type CreatePackForm = {
  name: string;
  description: string;
  entities: string;
  principles: string;
  forbidden: string;
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

const svgProps: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const evidenceLegend = [
  {
    title: "Observed",
    body: "What the AI can clearly see in the image.",
    iconColor: "text-emerald-600",
    cardBorder: "hover:border-emerald-300/60",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M1.5 12s4-6.5 10.5-6.5S22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    title: "Inferred",
    body: "What the AI thinks may be true based on what it sees.",
    iconColor: "text-blue-600",
    cardBorder: "hover:border-blue-300/60",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M12 3.5a7 7 0 0 0-4.8 12.1c.5.5.8 1.1.8 1.8V19h8v-1.6c0-.7.3-1.3.8-1.8A7 7 0 0 0 12 3.5Z" />
        <path d="M9 21h6M10.5 8.5c.2-1 1-1.7 2.1-1.7 1.2 0 2.1.8 2.1 1.9 0 2-2.7 1.8-2.7 4" />
        <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Subjective",
    body: "A judgment that can change depending on taste or context.",
    iconColor: "text-amber-600",
    cardBorder: "hover:border-amber-300/60",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9 10h.01M15 10h.01M9.5 15c.7-.6 1.6-.9 2.5-.9s1.8.3 2.5.9" />
      </svg>
    ),
  },
  {
    title: "Unsupported",
    body: "A statement the image does not clearly prove.",
    iconColor: "text-red-500",
    cardBorder: "hover:border-red-300/60",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4.8M12 17.2h.01" />
      </svg>
    ),
  },
];

const stats = [
  { value: "1", label: "See what the AI saw" },
  { value: "2", label: "Explain why it said it" },
  { value: "3", label: "Flag what may be uncertain" },
];

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="m16 9-4-4-4 4" />
      <path d="M12 5v11" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 19c1.7-3.5 4.4-5.2 7.5-5.2S17.8 15.5 19.5 19" />
    </svg>
  );
}

function NavIcon({ kind }: { kind: "audit" | "domains" | "history" | "claims" }) {
  if (kind === "audit") {
    return (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M5 4h14v16H5z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }
  if (kind === "domains") {
    return (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z" />
      </svg>
    );
  }
  if (kind === "history") {
    return (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M4.5 12A7.5 7.5 0 1 0 12 4.5" />
        <path d="M4.5 4.5v5h5" />
        <path d="M12 8v4.5l3 1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <path d="M4 5h16v14H4z" />
      <path d="M7.5 15.5 10 13l2 2 4-4 2.5 2.5" />
      <path d="M8 8h4" />
    </svg>
  );
}

function PackIcon() {
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" {...svgProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("Failed to read image dimensions."));
        image.src = objectUrl;
      },
    );
    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function PackCard({
  pack,
  active,
  isDemo,
  onClick,
}: {
  pack: DomainPack;
  active: boolean;
  isDemo?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
        active
          ? "border border-violet-400/60 bg-violet-100/70 text-[#0f0f14] shadow-[0_0_0_3px_rgba(139,92,246,0.12)] ring-1 ring-violet-400/30"
          : "border border-transparent text-black/45 hover:bg-black/[0.03] hover:text-black/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`mt-0.5 size-[18px] shrink-0 transition ${active ? "text-violet-600" : "text-black/22"}`}
          >
            <PackIcon />
          </span>
          <span>
            <span className={`block text-[0.9rem] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
              {pack.name}
            </span>
            <small
              className={`text-[0.77rem] leading-[1.45] ${active ? "text-black/50" : "text-black/28"}`}
            >
              {pack.description}
            </small>
          </span>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
          {isDemo && (
            <span className="rounded-full border border-violet-300/60 bg-violet-50 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-violet-600">
              Demo
            </span>
          )}
          {active && (
            <span className="flex size-[18px] items-center justify-center rounded-full bg-violet-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="size-[11px]">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          )}
        </div>
      </div>
      {active && (
        <div className="mt-2.5 flex flex-wrap gap-2 pl-[calc(18px+10px)]">
          <span className="rounded-lg bg-white px-2 py-1 text-[0.72rem] font-medium text-black/40">
            {pack.observable_entities.length} things to see
          </span>
          <span className="rounded-lg bg-white px-2 py-1 text-[0.72rem] font-medium text-black/40">
            {pack.principles.length} explanation rules
          </span>
          <span className="rounded-lg bg-white px-2 py-1 text-[0.72rem] font-medium text-red-400/70">
            {pack.forbidden_claims.length} limits
          </span>
        </div>
      )}
    </button>
  );
}

function CreatePackModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (pack: DomainPack) => void;
}) {
  const [form, setForm] = useState<CreatePackForm>({
    name: "",
    description: "",
    entities: "",
    principles: "",
    forbidden: "",
  });
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const parseLines = (text: string) =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError("Check name is required.");
      return;
    }

    const entities = parseLines(form.entities);
    const principles = parseLines(form.principles);
    const forbidden = parseLines(form.forbidden);

    if (entities.length === 0) {
      setError("Add at least one thing to look for.");
      return;
    }

    const pack: DomainPack = {
      id: `custom-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim() || "Custom image check.",
      observable_entities: entities,
      observation_categories: [
        "proportion", "contrast", "texture", "color",
        "shape", "position", "symmetry", "other",
      ],
      item_categories: ["entity", "region", "object", "other"],
      subject_types: ["subject", "object", "region", "other"],
      principles,
      forbidden_claims: forbidden,
      confidence_reducers: [
        "poor lighting",
        "significant occlusion",
        "unusual angle",
        "motion blur",
      ],
      example_observations: [],
      example_forbidden: [],
    };

    onSubmit(pack);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[520px] rounded-3xl border border-black/[0.08] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[1.1rem] font-bold tracking-tight text-[#0f0f14]">
              Create your check
            </h2>
            <p className="mt-0.5 text-[0.82rem] text-black/40">
              Tell the AI what to look for and what it should not claim.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-black/[0.08] text-black/35 transition hover:bg-black/[0.04] hover:text-black/60"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3.5">
          <div>
            <label className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-black/35">
              Check Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Food Quality, Product QA, Medical Imaging"
              className="w-full rounded-2xl border border-black/[0.09] bg-black/[0.02] px-4 py-2.5 text-[0.9rem] text-[#0f0f14] outline-none transition placeholder:text-black/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-black/35">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="One sentence describing what this check explains."
              className="w-full rounded-2xl border border-black/[0.09] bg-black/[0.02] px-4 py-2.5 text-[0.9rem] text-[#0f0f14] outline-none transition placeholder:text-black/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-black/35">
              What to detect{" "}
              <span className="normal-case font-normal text-black/30">(one per line)</span>
            </label>
            <textarea
              value={form.entities}
              onChange={(e) => setForm((f) => ({ ...f, entities: e.target.value }))}
              rows={3}
              placeholder={"cracks and surface defects\ncolor inconsistency\nmissing labels"}
              className="w-full rounded-2xl border border-black/[0.09] bg-black/[0.02] px-4 py-3 text-[0.88rem] leading-6 text-[#0f0f14] outline-none transition placeholder:text-black/20 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-black/35">
              How to explain it{" "}
              <span className="normal-case font-normal text-black/30">(one per line)</span>
            </label>
            <textarea
              value={form.principles}
              onChange={(e) => setForm((f) => ({ ...f, principles: e.target.value }))}
              rows={3}
              placeholder={"Dark tones across connected areas can suggest visual continuity.\nMissing label in expected region may indicate a product issue."}
              className="w-full rounded-2xl border border-black/[0.09] bg-black/[0.02] px-4 py-3 text-[0.88rem] leading-6 text-[#0f0f14] outline-none transition placeholder:text-black/20 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-red-400/80">
              Claims to avoid{" "}
              <span className="normal-case font-normal text-black/30">(one per line)</span>
            </label>
            <textarea
              value={form.forbidden}
              onChange={(e) => setForm((f) => ({ ...f, forbidden: e.target.value }))}
              rows={2}
              placeholder={"Do not claim personal taste as fact.\nDo not make safety diagnoses."}
              className="w-full rounded-2xl border border-red-200/60 bg-red-50/30 px-4 py-3 text-[0.88rem] leading-6 text-[#0f0f14] outline-none transition placeholder:text-black/20 focus:border-red-300/70 focus:ring-4 focus:ring-red-100/60"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[0.82rem] font-medium text-red-500">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-black/[0.09] px-4 py-2.5 text-[0.88rem] font-medium text-black/50 transition hover:bg-black/[0.03] hover:text-black/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-[0.88rem] font-semibold text-white shadow-[0_6px_18px_rgba(99,102,241,0.28)] transition hover:-translate-y-0.5"
          >
            Create Check
          </button>
        </div>
      </div>
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

export function LandingPage() {
  const inputId = useId();
  const packJsonInputId = useId();
  const { files, setFiles, focusPrompt, setFocusPrompt, selectedPack, setSelectedPack, customPacks, addCustomPack } =
    useAudit();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [packUploadError, setPackUploadError] = useState<string | null>(null);

  const handlePackJsonFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: unknown = JSON.parse(ev.target?.result as string);
        if (validateDomainPack(parsed)) {
          addCustomPack(parsed);
          setPackUploadError(null);
        } else {
          setPackUploadError(
            "Invalid pack JSON — must include id, name, description, and arrays for observable_entities, observation_categories, item_categories, subject_types, principles, and forbidden_claims.",
          );
        }
      } catch {
        setPackUploadError("Could not parse file as JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const fileName = files[0]?.name ?? null;

  useEffect(() => {
    if (files[0]) {
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [files]);

  const handleSelectedFile = async (file: File) => {
    setFiles([file]);
    setUploadState({ kind: "uploading" });

    try {
      const { width, height } = await readImageDimensions(file);
      const formData = new FormData();

      formData.append("file", file);
      formData.append("userId", "user_123");
      formData.append("widthPx", String(width));
      formData.append("heightPx", String(height));

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const payload = await parseApiJson<{ record?: { image_id?: string }; error?: string }>(
        response,
        "Upload",
      );

      if (!response.ok) throw new Error(payload.error ?? "Upload request failed.");

      const imageId = payload.record?.image_id;

      setUploadState({
        kind: "success",
        message: imageId ? `Saved metadata as ${imageId}.` : "Upload saved.",
      });
    } catch {
      setUploadState({
        kind: "error",
        message: "Upload failed. Preview is still available locally.",
      });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void handleSelectedFile(file);
  };

  return (
    <div className="min-h-screen bg-[#f6f6fa] text-[#0f0f14]">
      {/* Ambient glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[280px] -top-[240px] h-[700px] w-[700px] rounded-full bg-violet-300/20 blur-[160px]" />
        <div className="absolute -right-[320px] top-[25%] h-[600px] w-[600px] rounded-full bg-indigo-300/15 blur-[140px]" />
        <div className="absolute bottom-[8%] left-[30%] h-[400px] w-[500px] rounded-full bg-violet-200/12 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-[#f6f6fa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1160px] items-center justify-between gap-8 px-5 md:px-8">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_14px_rgba(109,40,217,0.35)]">
              <span className="text-[9px] font-black tracking-tight text-white">VA</span>
            </div>
            <span className="text-[1.05rem] font-bold tracking-[-0.03em] text-[#0f0f14]">
              VisualAudit
            </span>
          </div>

          <nav className="hidden items-center gap-0.5 md:flex">
            {(["Audit", "Checks", "History", "Claims"] as const).map((item, i) => (
              <button
                key={item}
                type="button"
                className={`rounded-lg px-3.5 py-1.5 text-[0.88rem] transition ${
                  i === 0
                    ? "bg-black/[0.07] font-semibold text-[#0f0f14]"
                    : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Account"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-black/[0.09] bg-black/[0.04] text-black/50 transition hover:bg-black/[0.08] hover:text-black/80"
          >
            <span className="size-[18px]">
              <AccountIcon />
            </span>
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1160px] px-5 pb-32 pt-12 md:px-8 lg:pb-16">
        {/* Hero */}
        <div className="mb-11 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-50 px-3.5 py-1.5 text-xs font-medium tracking-wide text-violet-600">
            <span className="size-1.5 rounded-full bg-violet-500" />
            Visual AI Reasoning Check
          </div>

          <h1 className="mb-5 text-[clamp(2.9rem,7.5vw,5.6rem)] font-bold leading-[1.2] tracking-[-0.046em]">
            <span className="text-[#0f0f14]">AI gave you advice.</span>
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              But why?
            </span>
          </h1>

          <p className="mx-auto max-w-[660px] text-[1.05rem] leading-relaxed text-black/45">
            VisualAudit shows what the AI saw, why it made a claim, and what it
            might be guessing. Fashion is the demo. The real product is clearer
            image-based AI reasoning.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[1.3rem] font-bold tracking-[-0.03em] text-[#0f0f14]">
                    {s.value}
                  </p>
                  <p className="max-w-[120px] text-[0.78rem] leading-snug text-black/35">
                    {s.label}
                  </p>
                </div>
                {i < stats.length - 1 && <div className="h-8 w-px bg-black/[0.09]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Concrete before / after */}
        <section className="mb-10 rounded-3xl border border-violet-100/80 bg-gradient-to-br from-violet-50/70 via-white/30 to-indigo-50/50 p-6 md:p-8">
          {/* Section header */}
          <div className="mb-6 text-center">
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-violet-500">
              The difference
            </span>
            <p className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.03em] text-[#0f0f14]">
              Same image. Completely different answer.
            </p>
          </div>

          <div className="relative grid gap-4 lg:grid-cols-2">
            {/* Left — Normal AI: sparse, incomplete */}
            <article className="rounded-2xl border border-black/[0.07] bg-white/40 p-5 backdrop-blur-sm">
              <div className="mb-4 inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-black/35">
                Normal AI Output
              </div>

              <p className="text-[clamp(1.25rem,2.6vw,1.9rem)] font-bold leading-tight tracking-[-0.04em] text-black/45">
                "This outfit flatters your proportions."
              </p>

              {/* Missing-feature rows — borrowed from pricing comparison tables */}
              <div className="mt-4 grid gap-2">
                <p className="mb-0.5 text-[0.67rem] font-bold uppercase tracking-[0.13em] text-black/25">
                  What's missing
                </p>
                {[
                  "What exactly it saw",
                  "Why it made that claim",
                  "How certain it is",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl border border-dashed border-black/[0.09] bg-white/30 px-3.5 py-2.5"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3.5 shrink-0 text-red-400/60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                    <span className="text-[0.84rem] text-black/32">{label}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* "vs" pill — centered in the column gap on desktop */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:flex"
            >
              <span className="rounded-full border border-violet-200/80 bg-white px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-violet-400 shadow-sm">
                vs
              </span>
            </div>

            {/* Right — VisualAudit: elevated, structured, rich */}
            <article className="rounded-2xl border border-violet-200/80 bg-white/85 p-5 shadow-[0_4px_28px_rgba(109,40,217,0.09)]">
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-violet-600">
                <span className="size-1.5 rounded-full bg-violet-500" />
                VisualAudit Output
              </div>

              <div className="mb-3.5">
                <p className="mb-0.5 text-[0.67rem] font-bold uppercase tracking-[0.14em] text-black/28">
                  Claim
                </p>
                <p className="text-[1.1rem] font-bold leading-snug tracking-[-0.025em] text-[#0f0f14]">
                  The outfit creates stronger vertical continuity.
                </p>
              </div>

              <div className="grid gap-2.5">
                {/* Evidence block — why it thinks this */}
                <div className="rounded-xl bg-emerald-50/80 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-emerald-700">
                      Observed
                    </span>
                    <p className="text-[0.7rem] font-semibold text-emerald-700/55">
                      Why the AI thinks this
                    </p>
                  </div>
                  <ul className="grid gap-1.5">
                    {[
                      "Similar dark tones from torso to legs",
                      "Few strong horizontal breaks",
                      "Silhouette edge stays mostly continuous",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-[0.86rem] leading-[1.5] text-black/55"
                      >
                        <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Uncertainty block */}
                <div className="rounded-xl bg-amber-50/80 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-amber-700">
                      Uncertain
                    </span>
                    <p className="text-[0.7rem] font-semibold text-amber-700/55">
                      What may be off
                    </p>
                  </div>
                  <ul className="grid gap-1.5">
                    {[
                      "Mirror angle hides part of the lower silhouette",
                      "Lighting may change how contrast appears",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-[0.86rem] leading-[1.5] text-black/55"
                      >
                        <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-amber-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Main grid */}
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_308px]">
          {/* Upload zone */}
          <section
            className={`relative overflow-hidden rounded-2xl border shadow-sm transition-colors ${
              isDragging
                ? "border-violet-400/50 bg-violet-50/60"
                : "border-black/[0.07] bg-white/70"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage: "radial-gradient(rgba(0,0,0,0.055) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            <div className="relative z-10 p-6 md:p-8">
              <div
                className={`flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors md:min-h-[300px] ${
                  isDragging
                    ? "border-violet-400/70 bg-violet-50/50"
                    : "border-black/[0.1] bg-black/[0.02]"
                }`}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={fileName ?? "Preview"}
                    className="max-h-[280px] w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="grid justify-items-center gap-3 p-8 text-center">
                    <div
                      className={`flex size-[60px] items-center justify-center rounded-2xl border transition-colors ${
                        isDragging
                          ? "border-violet-400/50 bg-violet-100 text-violet-500"
                          : "border-black/[0.09] bg-white text-black/30"
                      }`}
                    >
                      <span className="size-6">
                        <UploadIcon />
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-black/60">
                        {isDragging ? "Release to check it" : "Drop your image here"}
                      </p>
                      <p className="mt-1 text-[0.82rem] text-black/30">
                        JPEG · PNG · TIFF &nbsp;·&nbsp; Max 10 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <input
                  id={inputId}
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/tiff"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor={inputId}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-[0.88rem] font-medium text-black/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:bg-black/[0.03] hover:text-black/80"
                >
                  <span className="size-[17px]">
                    <UploadIcon />
                  </span>
                  Browse files
                </label>
                {fileName && (
                  <span className="max-w-[220px] truncate text-[0.82rem] text-black/35">
                    {fileName}
                  </span>
                )}
                {uploadState.kind === "uploading" && (
                  <span className="text-[0.82rem] font-medium text-violet-600">
                    Uploading...
                  </span>
                )}
                {uploadState.kind === "success" && (
                  <span className="text-[0.82rem] font-medium text-emerald-600">
                    {uploadState.message}
                  </span>
                )}
                {uploadState.kind === "error" && (
                  <span className="text-[0.82rem] font-medium text-red-500">
                    {uploadState.message}
                  </span>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="landing-focus-prompt"
                  className="mb-2 block text-[0.7rem] font-bold uppercase tracking-[0.13em] text-black/30"
                >
                  Upload your question and the answer given by AI
                </label>
                <textarea
                  id="landing-focus-prompt"
                  value={focusPrompt}
                  onChange={(e) => setFocusPrompt(e.target.value)}
                  rows={6}
                  placeholder={`Paste what an AI told you about this image, or ask a question to verify.\nExample: "The AI said this creates a slimming effect — is that visible?"`}
                  className="min-h-[168px] w-full resize-y rounded-2xl border border-black/[0.09] bg-white/80 px-4 py-3 text-[0.88rem] leading-6 text-black/70 outline-none transition placeholder:text-black/25 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-200/50"
                />
              </div>
            </div>
          </section>

          {/* Right panel */}
          <div className="grid gap-4">
            {/* Pack selector */}
            <section className="rounded-2xl border border-black/[0.07] bg-white/70 p-5 shadow-sm">
              <p className="mb-4 text-[0.7rem] font-bold uppercase tracking-[0.13em] text-black/30">
                What to Check
              </p>

              <div className="grid gap-1.5">
                {builtInPacks.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    active={selectedPack.id === pack.id}
                    isDemo
                    onClick={() => setSelectedPack(pack)}
                  />
                ))}

                {customPacks.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    active={selectedPack.id === pack.id}
                    onClick={() => setSelectedPack(pack)}
                  />
                ))}
              </div>

              <div className="mt-3">
                <label
                  htmlFor={packJsonInputId}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-black/[0.12] px-3 py-2.5 text-[0.84rem] text-black/35 transition hover:border-violet-300/70 hover:bg-violet-50/60 hover:text-violet-600"
                >
                  <span className="size-[15px] shrink-0">
                    <UploadIcon />
                  </span>
                  Upload JSON
                </label>
                <input
                  id={packJsonInputId}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={handlePackJsonFile}
                />
              </div>

              {packUploadError ? (
                <p className="mt-2 text-[0.78rem] font-medium text-red-500">{packUploadError}</p>
              ) : null}
            </section>

            {/* CTA */}
            <Link
              href="/visual-audit"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-[1rem] font-bold text-white shadow-[0_8px_28px_rgba(109,40,217,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(109,40,217,0.4)]"
            >
              <span>Audit a claim</span>
              <span className="size-[18px]">
                <ArrowIcon />
              </span>
            </Link>
          </div>
        </div>

        {/* Evidence legend */}
        <div className="mt-12 grid gap-4 border-t border-black/[0.07] pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {evidenceLegend.map((item) => (
            <article
              key={item.title}
              className={`rounded-2xl border border-black/[0.07] bg-white/70 p-5 shadow-sm transition ${item.cardBorder}`}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className={`size-[18px] shrink-0 ${item.iconColor}`}>
                  {item.icon}
                </span>
                <h3 className="text-[0.78rem] font-bold uppercase tracking-[0.1em] text-black/55">
                  {item.title}
                </h3>
              </div>
              <p className="text-[0.86rem] leading-[1.65] text-black/38">{item.body}</p>
            </article>
          ))}
        </div>
      </main>

      {/* Mobile nav */}
      <nav
        aria-label="Primary"
        className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 gap-1 rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
      >
        {(
          [
            { kind: "audit" as const, label: "Audit", active: true },
            { kind: "domains" as const, label: "Checks", active: false },
            { kind: "history" as const, label: "History", active: false }
          ] as const
        ).map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition ${
              item.active ? "bg-violet-50 text-violet-600" : "text-black/32 hover:text-black/60"
            }`}
          >
            <span className="size-[20px]">
              <NavIcon kind={item.kind} />
            </span>
            <span className="text-[0.7rem] font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Create Pack modal */}
      {showCreatePack && (
        <CreatePackModal
          onClose={() => setShowCreatePack(false)}
          onSubmit={(pack) => {
            addCustomPack(pack);
            setShowCreatePack(false);
          }}
        />
      )}
    </div>
  );
}
