import type { DomainPack } from "../domainPacks/types";
import { VISION_OBSERVATION_PROMPT } from "./visionObservationPrompt";

export function buildObservationPrompt(pack: DomainPack): string {
  return `${VISION_OBSERVATION_PROMPT}

The user has activated the "${pack.name}" domain pack.
${pack.description}

DOMAIN-SPECIFIC OBSERVATION CONTEXT:
Use the following domain pack to decide which visible entities and observation categories are valid for this request. Stay within the JSON schema provided by the API call.

WHAT TO DETECT in this domain:
${pack.observable_entities.map((e) => `- ${e}`).join("\n")}

ITEM CATEGORIES — use these as "category" values for visible_items:
${pack.item_categories.join(", ")}

OBSERVATION CATEGORIES — use these as "observation_type" values:
${pack.observation_categories.join(", ")}

DOMAIN PRINCIPLES — use these only to choose useful observable visual mechanics, not to produce advice:
${pack.principles.map((p) => `- ${p}`).join("\n")}

FORBIDDEN — you must never produce these claims:
${pack.forbidden_claims.map((f) => `- ${f}`).join("\n")}

CONDITIONS THAT REDUCE CONFIDENCE:
${pack.confidence_reducers.map((c) => `- ${c}`).join("\n")}

GENERAL OBSERVATION RULES:
- Say "appears" when uncertain.
- Say "in this image" for proportion observations.
- Prefer comparative observations: darker/lighter, wider/narrower, looser/tighter, longer/shorter.
- Prefer describing visual effects created by entities rather than absolute judgments.
- Describe how visible entities interact spatially.
- Identify where uninterrupted visual lines exist and where visual breaks occur.
- Identify where contrast draws attention within the image.
- Distinguish between raw visible observations and interpreted visual characteristics.
- Use cautious language ("appears," "suggests," "visually reads as") for higher-level interpretations.

EXAMPLES OF ALLOWED OBSERVATIONS:
${pack.example_observations.map((e) => `- "${e}"`).join("\n")}

EXAMPLES OF FORBIDDEN OBSERVATIONS:
${pack.example_forbidden.map((e) => `- "${e}"`).join("\n")}

Return only valid JSON that matches the supplied VisionObservationResult schema.`;
}
