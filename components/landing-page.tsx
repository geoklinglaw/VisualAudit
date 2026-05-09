"use client";

import Link from "next/link";
import type { ReactElement, SVGProps } from "react";
import { type ChangeEvent, useEffect, useId, useState } from "react";

type Domain = {
  id: string;
  label: string;
  icon: ReactElement;
  note: string;
  precision: string;
  latency: string;
};

type SampleCard = {
  id: string;
  label: string;
  art: ReactElement;
};

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const svgProps: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const domains: Domain[] = [
  {
    id: "fashion",
    label: "Fashion Module",
    note: "Garment tagging, fabric reads, and fit-check evidence.",
    precision: "99.2%",
    latency: "<200ms",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M5 9.5 9.4 5h5.2L19 9.5V19H5Z" />
        <path d="M9.4 5 12 8l2.6-3" />
      </svg>
    ),
  },
  {
    id: "interior",
    label: "Interior Module",
    note: "Fixture recognition, material QA, and layout anomalies.",
    precision: "98.7%",
    latency: "<280ms",
    icon: (
      <svg viewBox="0 0 24 24" {...svgProps}>
        <path d="M5 10h14v5H5z" />
        <path d="M7 10V7h10v3" />
        <path d="M7 15v3M17 15v3" />
      </svg>
    ),
  },
  // {
  //   id: "food",
  //   label: "Food Module",
  //   note: "Ingredient signals, plating claims, and freshness cues.",
  //   precision: "97.9%",
  //   latency: "<240ms",
  //   icon: (
  //     <svg viewBox="0 0 24 24" {...svgProps}>
  //       <path d="M6 4v8M9 4v8M6 8h3M15 4v15M18 4c0 4-3 4-3 0" />
  //     </svg>
  //   ),
  // },
  // {
  //   id: "product",
  //   label: "Product QA",
  //   note: "Packaging validation, defect triage, and compliance support.",
  //   precision: "99.4%",
  //   latency: "<160ms",
  //   icon: (
  //     <svg viewBox="0 0 24 24" {...svgProps}>
  //       <path d="M5 4h14v16H5z" />
  //       <path d="M8 8h8M8 12h4M8 16h5" />
  //       <path d="m15 11 2 2 3-3" />
  //     </svg>
  //   ),
  // },
];

function ShirtArt() {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-b from-violet-50 to-violet-100/60">
      <div
        className="absolute inset-x-[22%] bottom-[14%] top-[26%] bg-gradient-to-b from-violet-300/70 to-violet-400/50"
        style={{
          clipPath:
            "polygon(18% 0, 32% 0, 39% 12%, 61% 12%, 68% 0, 82% 0, 100% 17%, 85% 29%, 85% 100%, 15% 100%, 15% 29%, 0 17%)",
        }}
      />
      <div className="absolute left-1/2 top-[28%] h-[10%] w-[24%] -translate-x-1/2 rounded-b-full bg-violet-300/50" />
    </div>
  );
}

function ChairArt() {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-b from-amber-50 to-amber-100/60">
      <div className="absolute left-[34%] top-[18%] h-[28%] w-[32%] rounded-t-xl rounded-b-[10px] bg-gradient-to-b from-amber-300/80 to-amber-400/65" />
      <div className="absolute left-[28%] top-[48%] h-[16%] w-[44%] rounded-[18px] bg-gradient-to-b from-amber-300/75 to-amber-400/60" />
      <div className="absolute inset-x-0 bottom-[18%] top-[48%]">
        <div className="absolute bottom-0 left-[36%] h-[42%] w-[7px] rounded-sm bg-amber-500/55" />
        <div className="absolute bottom-0 right-[36%] h-[42%] w-[7px] rounded-sm bg-amber-500/55" />
      </div>
    </div>
  );
}

function BowlArt() {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-b from-green-50 to-green-100/50">
      <div
        className="absolute bottom-[24%] left-[18%] right-[18%] h-[46%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(134,239,172,0.8), rgba(34,197,94,0.55) 60%, rgba(21,128,61,0.3) 100%)",
          boxShadow: "inset 0 0 0 6px rgba(251,191,36,0.35)",
        }}
      />
      <div className="absolute bottom-[18%] left-[22%] right-[22%] h-[18%] rounded-b-full bg-gradient-to-b from-white/60 to-white/20" />
    </div>
  );
}

const samples: SampleCard[] = [
  { id: "shirt", label: "Tee sample", art: <ShirtArt /> },
  { id: "chair", label: "Chair sample", art: <ChairArt /> },
  { id: "bowl", label: "Bowl sample", art: <BowlArt /> },
];

const evidenceLegend = [
  {
    title: "Observed",
    body: "Direct pixel evidence identified with 99%+ confidence.",
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
    body: "Logical conclusions derived from context and metadata.",
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
    body: "Qualitative assessments prone to human-centric bias.",
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
    body: "Claims with insufficient or contradictory visual proof.",
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

const stats = [
  { value: "34K+", label: "Images audited" },
  { value: "99.2%", label: "Avg. precision" },
  { value: "<200ms", label: "Median latency" },
];

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => reject(new Error("Failed to read image dimensions."));
        image.src = objectUrl;
      },
    );

    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function LandingPage() {
  const inputId = useId();
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0].id);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) ?? domains[0];

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelectedFile = async (file: File) => {
    setFileName(file.name);
    setPreviewUrl((curr) => {
      if (curr) URL.revokeObjectURL(curr);
      return URL.createObjectURL(file);
    });

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

      if (!response.ok) {
        throw new Error("Upload request failed.");
      }

      const payload = (await response.json()) as {
        record?: { image_id?: string };
      };
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
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[280px] -top-[240px] h-[700px] w-[700px] rounded-full bg-violet-300/20 blur-[160px]" />
        <div className="absolute -right-[320px] top-[25%] h-[600px] w-[600px] rounded-full bg-indigo-300/15 blur-[140px]" />
        <div className="absolute bottom-[8%] left-[30%] h-[400px] w-[500px] rounded-full bg-violet-200/12 blur-[120px]" />
      </div>

      {/* Sticky top navbar */}
      <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-[#f6f6fa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1160px] items-center justify-between gap-8 px-5 md:px-8">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_14px_rgba(109,40,217,0.35)]">
              <span className="text-[9px] font-black tracking-tight text-white">VA</span>
            </div>
            <span className="text-[1.05rem] font-bold tracking-[-0.03em] text-[#0f0f14]">
              VisualAudit
            </span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {(["Audit", "Domains", "History", "Claims"] as const).map((item, i) => (
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

          {/* Account */}
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

      {/* Page content */}
      <main className="relative mx-auto max-w-[1160px] px-5 pb-32 pt-12 md:px-8 lg:pb-16">
        {/* ── Hero ── */}
        <div className="mb-11 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-50 px-3.5 py-1.5 text-xs font-medium tracking-wide text-violet-600">
            <span className="size-1.5 rounded-full bg-violet-500" />
            Visual Claim Intelligence Engine
          </div>

          <h1 className="mb-5 text-[clamp(2.9rem,7.5vw,5.6rem)] font-bold leading-[0.93] tracking-[-0.046em]">
            <span className="text-[#0f0f14]">Trust what </span>
            <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              visual AI
            </span>
            <br />
            <span className="text-[#0f0f14]">actually sees.</span>
          </h1>

          <p className="mx-auto max-w-[440px] text-[1.05rem] leading-relaxed text-black/40">
            Upload an image. We audit every AI claim—separating observed facts
            from inferences, subjective reads, and unsupported assertions.
          </p>

          {/* Stats row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[1.3rem] font-bold tracking-[-0.03em] text-[#0f0f14]">
                    {s.value}
                  </p>
                  <p className="text-[0.78rem] text-black/35">{s.label}</p>
                </div>
                {i < stats.length - 1 && (
                  <div className="h-8 w-px bg-black/[0.09]" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main grid ── */}
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
            {/* Dot grid texture */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(0,0,0,0.055) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            <div className="relative z-10 p-6 md:p-8">
              {/* Drop / preview area */}
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
                        {isDragging ? "Release to analyze" : "Drop your image here"}
                      </p>
                      <p className="mt-1 text-[0.82rem] text-black/30">
                        JPEG · PNG · TIFF &nbsp;·&nbsp; Max 25 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* File actions */}
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
                    Uploading and saving metadata...
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
            </div>
          </section>

          {/* Right panel */}
          <div className="grid gap-4">
            {/* Domain selector */}
            <section className="rounded-2xl border border-black/[0.07] bg-white/70 p-5 shadow-sm">
              <p className="mb-4 text-[0.7rem] font-bold uppercase tracking-[0.13em] text-black/30">
                Audit Domain
              </p>
              <div className="grid gap-1.5">
                {domains.map((domain) => {
                  const active = domain.id === selectedDomainId;
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => setSelectedDomainId(domain.id)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left transition ${
                        active
                          ? "border border-violet-300/70 bg-violet-50 text-[#0f0f14]"
                          : "border border-transparent text-black/45 hover:bg-black/[0.03] hover:text-black/70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 size-[18px] shrink-0 transition ${
                          active ? "text-violet-500" : "text-black/22"
                        }`}
                      >
                        {domain.icon}
                      </span>
                      <span>
                        <span className="block text-[0.9rem] font-medium leading-tight">
                          {domain.label}
                        </span>
                        <small
                          className={`text-[0.77rem] leading-[1.45] ${
                            active ? "text-black/45" : "text-black/28"
                          }`}
                        >
                          {domain.note}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Audit parameters */}
            <section className="rounded-2xl border border-black/[0.07] bg-white/70 p-5 shadow-sm">
              <p className="mb-4 text-[0.7rem] font-bold uppercase tracking-[0.13em] text-black/30">
                Parameters
              </p>
              <div className="grid gap-2.5">
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-[0.88rem] text-black/50">Precision Level</span>
                  <span className="rounded-lg border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-[0.8rem] font-bold text-emerald-700">
                    {selectedDomain.precision}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                  <span className="text-[0.88rem] text-black/50">Latency Target</span>
                  <span className="rounded-lg border border-blue-300/60 bg-blue-50 px-2.5 py-1 text-[0.8rem] font-bold text-blue-700">
                    {selectedDomain.latency}
                  </span>
                </div>
              </div>
            </section>

            {/* CTA */}
            <Link
              href="/visual-audit"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-[1rem] font-bold text-white shadow-[0_8px_28px_rgba(109,40,217,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(109,40,217,0.4)]"
            >
              <span>Audit this image</span>
              <span className="size-[18px]">
                <ArrowIcon />
              </span>
            </Link>
          </div>
        </div>

        {/* ── Evidence legend ── */}
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

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 gap-1 rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
      >
        {(
          [
            { kind: "audit" as const, label: "Audit", active: true },
            { kind: "domains" as const, label: "Domains", active: false },
            { kind: "history" as const, label: "History", active: false },
            { kind: "claims" as const, label: "Claims", active: false },
          ] as const
        ).map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition ${
              item.active
                ? "bg-violet-50 text-violet-600"
                : "text-black/32 hover:text-black/60"
            }`}
          >
            <span className="size-[20px]">
              <NavIcon kind={item.kind} />
            </span>
            <span className="text-[0.7rem] font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
