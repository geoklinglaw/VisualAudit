import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { fashionPack } from "../../../../lib/domainPacks/fashion";
import type { DomainPack } from "../../../../lib/domainPacks/types";
import { buildObservationPrompt } from "../../../../lib/visualAudit/buildObservationPrompt";
import { buildVisionSchema, parseVisionObservationResult } from "../../../../lib/visualAudit/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const VISION_OBSERVATION_MODEL = "gpt-5.5";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 4;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractOpenAiErrorMessage(payload: unknown) {
  if (
    !isObject(payload) ||
    !isObject(payload.error) ||
    typeof payload.error.message !== "string"
  ) {
    return "OpenAI request failed.";
  }

  return payload.error.message;
}

function extractOutputText(payload: unknown): string | null {
  if (
    isObject(payload) &&
    typeof payload.output_text === "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text;
  }

  if (!isObject(payload) || !Array.isArray(payload.output)) {
    return null;
  }

  for (const outputItem of payload.output) {
    if (!isObject(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isObject(contentItem) &&
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string" &&
        contentItem.text.trim()
      ) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function extractRefusal(payload: unknown): string | null {
  if (!isObject(payload) || !Array.isArray(payload.output)) {
    return null;
  }

  for (const outputItem of payload.output) {
    if (!isObject(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isObject(contentItem) &&
        contentItem.type === "refusal" &&
        typeof contentItem.refusal === "string" &&
        contentItem.refusal.trim()
      ) {
        return contentItem.refusal;
      }
    }
  }

  return null;
}

async function fileToDataUrl(file: File) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  return `data:${contentType};base64,${fileBuffer.toString("base64")}`;
}

function parseDomainPack(raw: string): DomainPack {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      !isObject(parsed) ||
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.item_categories) ||
      !Array.isArray(parsed.subject_types) ||
      !Array.isArray(parsed.observation_categories)
    ) {
      return fashionPack;
    }

    return parsed as DomainPack;
  } catch {
    return fashionPack;
  }
}

async function analyzeImages(
  dataUrls: string[],
  focusPrompt: string | null,
  pack: DomainPack,
  apiKey: string,
) {
  const schema = buildVisionSchema(
    pack.item_categories,
    pack.subject_types,
    pack.observation_categories,
  );

  const systemPrompt = buildObservationPrompt(pack);

  const userContent = [
    {
      type: "input_text" as const,
      text: `Analyze these images using the "${pack.name}" domain pack and return the VisionObservationResult JSON. Use the first image as the primary frame for any localized regions or bounding boxes. Use additional images only as supporting context.`,
    },
    ...(focusPrompt
      ? [
          {
            type: "input_text" as const,
            text: `User visual focus: ${focusPrompt}

Use this only to prioritize directly observable evidence in the image. Do not answer the question, give advice, or infer non-visible traits in this vision observation call.`,
          },
        ]
      : []),
    ...dataUrls.map((dataUrl) => ({
      type: "input_image" as const,
      image_url: dataUrl,
    })),
  ];

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_OBSERVATION_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "vision_observation_result",
          strict: true,
          schema,
        },
      },
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(extractOpenAiErrorMessage(payload));
  }

  const refusal = extractRefusal(payload);

  if (refusal) {
    throw new Error(`The model refused the request: ${refusal}`);
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI did not return structured output text.");
  }

  return parseVisionObservationResult(JSON.parse(outputText) as unknown);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const legacyFile = formData.get("file");
    const focusPromptValue = formData.get("focusPrompt");
    const packValue = formData.get("pack");

    const focusPrompt =
      typeof focusPromptValue === "string" && focusPromptValue.trim().length > 0
        ? focusPromptValue.trim()
        : null;

    const pack =
      typeof packValue === "string" && packValue.trim().length > 0
        ? parseDomainPack(packValue.trim())
        : fashionPack;

    const normalizedFiles =
      files.length > 0
        ? files
        : legacyFile instanceof File
          ? [legacyFile]
          : [];

    if (normalizedFiles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Please upload at least one image file." },
        { status: 400 },
      );
    }

    if (normalizedFiles.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        { ok: false, error: `Upload up to ${MAX_FILE_COUNT} images at a time.` },
        { status: 400 },
      );
    }

    for (const file of normalizedFiles) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "Only image uploads are supported." },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Each image must be 10MB or smaller." },
          { status: 400 },
        );
      }
    }

    const dataUrls = await Promise.all(normalizedFiles.map(fileToDataUrl));
    const result = await analyzeImages(dataUrls, focusPrompt, pack, apiKey);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
