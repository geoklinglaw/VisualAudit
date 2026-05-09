// Rich knowledge principle that can be embedded in a pack or stored in a knowledge file.
// Matches the shape used by matchPrinciples so custom packs get the same depth as built-ins.
export type KnowledgePrinciple = {
  id: string;
  category: string;
  principle: string;
  observable_patterns: string[];
  possible_effects: string[];
  style_tags?: string[];
  occasion_tags?: string[];
  source_refs?: string[];
  limitations?: string[];
  example_claims?: string[];
};

export type DomainPack = {
  id: string;
  name: string;
  description: string;

  // What the engine should detect in this domain
  observable_entities: string[];

  // Valid observation_type values for visual_observations
  observation_categories: string[];

  // Valid category values for visible_items
  item_categories: string[];

  // Valid type values for detected_subjects
  subject_types: string[];

  // Mechanics that transform observations into interpretations
  principles: string[];

  // Claims the engine must never make
  forbidden_claims: string[];

  // Conditions that should reduce confidence scores
  confidence_reducers: string[];

  // Few-shot examples of allowed observations
  example_observations: string[];

  // Few-shot examples of forbidden observations
  example_forbidden: string[];

  // Optional embedded knowledge; if absent, the built-in pack knowledge is used as fallback.
  // Upload a knowledge.json with this field populated to enable domain-specific principle matching.
  knowledge_principles?: KnowledgePrinciple[];
};
