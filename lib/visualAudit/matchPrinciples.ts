import type { KnowledgePrinciple } from "../domainPacks/types";
import fashionPrinciples from "../knowledge/fashion_principles.json";

export type MatchedPrinciple = {
  id: string;
  category: string;
  principle: string;
  observable_patterns: string[];
  possible_effects: string[];
  style_tags: string[];
  occasion_tags: string[];
};

// Always include these categories for archetype and occasion reads
const ALWAYS_INCLUDE_CATEGORIES = new Set(["style_archetype", "occasion", "wardrobe_logic"]);

// If the pack provides knowledge_principles, those are used instead of the built-in
// fashion knowledge so each domain gets its own principle matching.
export function matchPrinciples(
  observationTypes: string[],
  _itemCategories: string[],
  maxPrinciples = 20,
  customKnowledge?: KnowledgePrinciple[],
): MatchedPrinciple[] {
  const source = customKnowledge ?? (fashionPrinciples as KnowledgePrinciple[]);
  const obsTypesSet = new Set(observationTypes);

  const scored = source.map((p) => {
    let score = 0;
    if (obsTypesSet.has(p.category)) score += 3;
    if (ALWAYS_INCLUDE_CATEGORIES.has(p.category)) score += 1;
    return { p, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPrinciples)
    .map(({ p }) => ({
      id: p.id,
      category: p.category,
      principle: p.principle,
      observable_patterns: p.observable_patterns,
      possible_effects: p.possible_effects,
      style_tags: p.style_tags ?? [],
      occasion_tags: p.occasion_tags ?? [],
    }));
}
