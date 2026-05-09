import { NextResponse } from "next/server";

import { fashionPack } from "../../../../lib/domainPacks/fashion";
import type { DomainPack } from "../../../../lib/domainPacks/types";
import type { AuditReport } from "../../../../lib/visualAudit/analysisTypes";
import { matchPrinciples, type MatchedPrinciple } from "../../../../lib/visualAudit/matchPrinciples";
import { parseVisionObservationResult, type VisionObservationResult } from "../../../../lib/visualAudit/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const ANALYSIS_MODEL = "gpt-5.5";
const MAX_COMPLETION_TOKENS = 4096;

type SynthesizeRequest = {
  observation: VisionObservationResult;
  userQuestion: string | null;
  pack: DomainPack;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) return text.slice(first, last + 1);
  return text.trim();
}

function parseAuditReportJson(text: string): AuditReport {
  const raw = extractJsonFromText(text);

  if (!raw) {
    throw new Error("OpenAI returned an empty audit response.");
  }

  try {
    return JSON.parse(raw) as AuditReport;
  } catch {
    throw new Error("OpenAI returned malformed audit JSON.");
  }
}

function parseDomainPack(value: unknown): DomainPack {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    !Array.isArray(value.item_categories) ||
    !Array.isArray(value.subject_types) ||
    !Array.isArray(value.observation_categories) ||
    !Array.isArray(value.observable_entities) ||
    !Array.isArray(value.principles) ||
    !Array.isArray(value.forbidden_claims)
  ) {
    return fashionPack;
  }

  return value as DomainPack;
}

function parseRequestBody(value: unknown): SynthesizeRequest {
  if (isObject(value) && "observation" in value) {
    const userQuestion =
      typeof value.userQuestion === "string" && value.userQuestion.trim()
        ? value.userQuestion.trim()
        : null;

    return {
      observation: parseVisionObservationResult(value.observation),
      userQuestion,
      pack: parseDomainPack(value.pack),
    };
  }

  return {
    observation: parseVisionObservationResult(value),
    userQuestion: null,
    pack: fashionPack,
  };
}

function buildPrompt(
  userQuestion: string | null,
  obs: VisionObservationResult,
  pack: DomainPack,
  principles: MatchedPrinciple[],
): string {
  const items = obs.visible_items
    .map((i) => `- ${i.item_id}: ${i.description} | color: ${i.color} | fit: ${i.shape_or_fit} | material: ${i.material_or_texture}`)
    .join("\n");

  const observations = obs.visual_observations
    .map((o) => `- [${o.observation_id}] [${o.observation_type}] ${o.text} (confidence ${Math.round(o.confidence * 100)}%)`)
    .join("\n");

  const knowledgeBlock = principles
    .map(
      (p) =>
        `ID: ${p.id}
Category: ${p.category}
Principle: ${p.principle}
Observable patterns: ${p.observable_patterns.join("; ")}
Possible effects: ${p.possible_effects.join("; ")}`,
    )
    .join("\n\n");

  const domainPrinciples = pack.principles.map((p) => `- ${p}`).join("\n");
  const forbiddenClaims = pack.forbidden_claims.map((f) => `- ${f}`).join("\n");

  return `You are a visual claim evaluator. Your job is to determine whether claims about an image are supported, unsupported, or inconclusive based only on extracted visual observations. You do not generate advice. You evaluate evidence.

USER INPUT (Question from User and Answer from AI):
${userQuestion ?? "No specific claim provided. Identify what the observations can and cannot confirm about the visible content."}

DOMAIN: ${pack.name}
${pack.description}

DOMAIN PRINCIPLES:
${domainPrinciples}

FORBIDDEN CLAIMS (never produce these):
${forbiddenClaims}

IMAGE SUMMARY:
${obs.image_summary}

VISIBLE ITEMS:
${items}

VISUAL OBSERVATIONS (these are the only facts available — cite by observation_id):
${observations}

APPLICABLE KNOWLEDGE PRINCIPLES:
${knowledgeBlock}

═══════════════════════════════════════
EVALUATION PIPELINE — follow in order
═══════════════════════════════════════

STEP 1 — PARSE THE INPUT
Break the user's input into one or more specific, verifiable claims.
If the input is a question, restate it as a testable claim.
Example: "Does this look cohesive?" → "The visible items share a consistent visual identity."

STEP 2 — EVIDENCE SEARCH
For each claim:
- List observation IDs that directly support it
- List observation IDs that directly contradict it
- Note what evidence is needed but absent from the observations

STEP 3 — VERDICT
For each claim, assign:
- "supported": observations clearly confirm it, no significant contradictions
- "unsupported": observations clearly contradict it, or required evidence is absent
- "inconclusive": mixed or insufficient evidence — never guess when evidence is weak

STEP 4 — PRINCIPLE ASSESSMENT
For each matched knowledge principle, state whether the observations support or contradict it, and what that reveals about the user's claim.

STEP 5 — SUMMARIZE
State what the image evidence confirms, what it contradicts, and what it cannot determine. Always name the specific image limitations constraining this audit.

═══════════════════════════════════════
RULES
═══════════════════════════════════════
- Cite only observation IDs that appear in the VISUAL OBSERVATIONS list above.
- Never invent evidence not present in the observations.
- Prefer "inconclusive" over "supported" when evidence is weak or ambiguous.
- Never make body judgments.
- confidence must reflect the quality and completeness of observable evidence, not subjective certainty.

Return valid JSON only — no markdown fences, no explanation outside JSON:
{
  "question_answer": "direct answer to the user's input, grounded in observations only",
  "claim_verdicts": [
    {
      "claim": "specific claim being evaluated",
      "verdict": "supported",
      "supporting_observation_ids": ["obs_id_1", "obs_id_2"],
      "contradicting_observation_ids": [],
      "evidence_summary": "1–2 sentences explaining the verdict with specific evidence",
      "confidence": 0.85
    }
  ],
  "principle_assessments": [
    {
      "principle_id": "exact_id_from_list",
      "category": "category_name",
      "assessment": "what this principle reveals about the observable evidence",
      "verdict": "supported"
    }
  ],
  "audit_summary": "2–3 sentence neutral summary of what the audit found and what it cannot confirm",
  "confidence_note": "specific image limitations that reduce certainty in this audit"
}`;
}

async function callOpenAI(prompt: string, apiKey: string): Promise<AuditReport> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON that matches the requested shape. Do not include markdown or prose outside JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const msg =
      isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : "OpenAI API request failed.";
    throw new Error(msg);
  }

  if (!isObject(payload) || !Array.isArray(payload.choices) || !isObject(payload.choices[0])) {
    throw new Error("Unexpected OpenAI response shape.");
  }

  const choice = payload.choices[0];

  if (choice.finish_reason === "length") {
    throw new Error("OpenAI audit response was truncated before valid JSON was produced.");
  }

  if (!isObject(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("Unexpected OpenAI response shape.");
  }

  return parseAuditReportJson(choice.message.content);
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
    const body = parseRequestBody((await request.json()) as unknown);

    const observationTypes = body.observation.visual_observations.map((o) => o.observation_type);
    const itemCategories = body.observation.visible_items.map((i) => i.category);
    const principles = matchPrinciples(observationTypes, itemCategories, 20, body.pack.knowledge_principles);

    const prompt = buildPrompt(body.userQuestion, body.observation, body.pack, principles);
    const analysis = await callOpenAI(prompt, apiKey);

    return NextResponse.json({ ok: true, analysis, knowledgeLayer: principles });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
