export type Region =
  | {
      type: "box";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "none";
      x?: 0;
      y?: 0;
      width?: 0;
      height?: 0;
    };

export type VisionObservationResult = {
  image_summary: string;
  image_quality: {
    lighting: "poor" | "fair" | "good";
    angle: "front" | "side" | "mirror" | "unclear";
    occlusion: "none" | "partial" | "significant";
    confidence: number;
  };
  detected_subjects: Array<{
    subject_id: string;
    type: string;
    visibility: string;
    region: Region;
    confidence: number;
  }>;
  visible_items: Array<{
    item_id: string;
    category: string;
    description: string;
    color: string;
    shape_or_fit: string;
    material_or_texture: string;
    region: Region;
    confidence: number;
  }>;
  visual_observations: Array<{
    observation_id: string;
    text: string;
    observation_type: string;
    evidence_item_ids: string[];
    region: Region;
    confidence: number;
  }>;
  image_limitations: string[];
};

const regionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "x", "y", "width", "height"],
  properties: {
    type: { type: "string", enum: ["box", "none"] },
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    width: { type: "number", minimum: 0, maximum: 1 },
    height: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

export function buildVisionSchema(
  itemCategories: string[],
  subjectTypes: string[],
  observationCategories: string[],
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "image_summary",
      "image_quality",
      "detected_subjects",
      "visible_items",
      "visual_observations",
      "image_limitations",
    ],
    properties: {
      image_summary: { type: "string" },
      image_quality: {
        type: "object",
        additionalProperties: false,
        required: ["lighting", "angle", "occlusion", "confidence"],
        properties: {
          lighting: { type: "string", enum: ["poor", "fair", "good"] },
          angle: { type: "string", enum: ["front", "side", "mirror", "unclear"] },
          occlusion: { type: "string", enum: ["none", "partial", "significant"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      detected_subjects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["subject_id", "type", "visibility", "region", "confidence"],
          properties: {
            subject_id: { type: "string" },
            type: { type: "string", enum: subjectTypes },
            visibility: { type: "string" },
            region: { $ref: "#/$defs/region" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      visible_items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "item_id",
            "category",
            "description",
            "color",
            "shape_or_fit",
            "material_or_texture",
            "region",
            "confidence",
          ],
          properties: {
            item_id: { type: "string" },
            category: { type: "string", enum: itemCategories },
            description: { type: "string" },
            color: { type: "string" },
            shape_or_fit: { type: "string" },
            material_or_texture: { type: "string" },
            region: { $ref: "#/$defs/region" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      visual_observations: {
        type: "array",
        minItems: 3,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "observation_id",
            "text",
            "observation_type",
            "evidence_item_ids",
            "region",
            "confidence",
          ],
          properties: {
            observation_id: { type: "string" },
            text: { type: "string" },
            observation_type: { type: "string", enum: observationCategories },
            evidence_item_ids: { type: "array", items: { type: "string" } },
            region: { $ref: "#/$defs/region" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      image_limitations: {
        type: "array",
        items: { type: "string" },
      },
    },
    $defs: {
      region: regionJsonSchema,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNumberBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function parseRegion(value: unknown): Region {
  if (!isObject(value)) {
    throw new Error("Invalid region.");
  }

  const { type, x, y, width, height } = value;

  if (type === "none") {
    return { type: "none", x: 0, y: 0, width: 0, height: 0 };
  }

  if (
    type === "box" &&
    isNumberBetween(x, 0, 1) &&
    isNumberBetween(y, 0, 1) &&
    isNumberBetween(width, 0, 1) &&
    isNumberBetween(height, 0, 1)
  ) {
    return { type, x, y, width, height };
  }

  throw new Error("Invalid region coordinates.");
}

const lightingValues = new Set(["poor", "fair", "good"]);
const angleValues = new Set(["front", "side", "mirror", "unclear"]);
const occlusionValues = new Set(["none", "partial", "significant"]);

export function parseVisionObservationResult(value: unknown): VisionObservationResult {
  if (!isObject(value)) {
    throw new Error("Vision observation result must be an object.");
  }

  const imageQuality = value.image_quality;

  if (!isObject(imageQuality)) {
    throw new Error("Missing image_quality object.");
  }

  if (
    !isString(value.image_summary) ||
    !lightingValues.has(imageQuality.lighting as string) ||
    !angleValues.has(imageQuality.angle as string) ||
    !occlusionValues.has(imageQuality.occlusion as string) ||
    !isNumberBetween(imageQuality.confidence, 0, 1)
  ) {
    throw new Error("Invalid top-level vision observation fields.");
  }

  if (!Array.isArray(value.detected_subjects) || !Array.isArray(value.visible_items)) {
    throw new Error("Detected subjects and visible items must be arrays.");
  }

  if (
    !Array.isArray(value.visual_observations) ||
    value.visual_observations.length < 3 ||
    value.visual_observations.length > 12
  ) {
    throw new Error("Visual observations must contain between 3 and 12 items.");
  }

  if (!isStringArray(value.image_limitations)) {
    throw new Error("Image limitations must be a string array.");
  }

  const detectedSubjects = value.detected_subjects.map((subject) => {
    if (!isObject(subject)) throw new Error("Invalid detected subject.");

    if (
      !isString(subject.subject_id) ||
      !isString(subject.type) ||
      !isString(subject.visibility) ||
      !isNumberBetween(subject.confidence, 0, 1)
    ) {
      throw new Error("Invalid detected subject fields.");
    }

    return {
      subject_id: subject.subject_id,
      type: subject.type,
      visibility: subject.visibility,
      region: parseRegion(subject.region),
      confidence: subject.confidence,
    };
  });

  const visibleItems = value.visible_items.map((item) => {
    if (!isObject(item)) throw new Error("Invalid visible item.");

    if (
      !isString(item.item_id) ||
      !isString(item.category) ||
      !isString(item.description) ||
      !isString(item.color) ||
      !isString(item.shape_or_fit) ||
      !isString(item.material_or_texture) ||
      !isNumberBetween(item.confidence, 0, 1)
    ) {
      throw new Error("Invalid visible item fields.");
    }

    return {
      item_id: item.item_id,
      category: item.category,
      description: item.description,
      color: item.color,
      shape_or_fit: item.shape_or_fit,
      material_or_texture: item.material_or_texture,
      region: parseRegion(item.region),
      confidence: item.confidence,
    };
  });

  const visualObservations = value.visual_observations.map((observation) => {
    if (!isObject(observation)) throw new Error("Invalid visual observation.");

    if (
      !isString(observation.observation_id) ||
      !isString(observation.text) ||
      !isString(observation.observation_type) ||
      !isStringArray(observation.evidence_item_ids) ||
      !isNumberBetween(observation.confidence, 0, 1)
    ) {
      throw new Error("Invalid visual observation fields.");
    }

    return {
      observation_id: observation.observation_id,
      text: observation.text,
      observation_type: observation.observation_type,
      evidence_item_ids: observation.evidence_item_ids,
      region: parseRegion(observation.region),
      confidence: observation.confidence,
    };
  });

  return {
    image_summary: value.image_summary,
    image_quality: {
      lighting: imageQuality.lighting as VisionObservationResult["image_quality"]["lighting"],
      angle: imageQuality.angle as VisionObservationResult["image_quality"]["angle"],
      occlusion: imageQuality.occlusion as VisionObservationResult["image_quality"]["occlusion"],
      confidence: imageQuality.confidence as number,
    },
    detected_subjects: detectedSubjects,
    visible_items: visibleItems,
    visual_observations: visualObservations,
    image_limitations: value.image_limitations,
  };
}
