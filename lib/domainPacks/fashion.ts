import type { DomainPack } from "./types";

export const fashionPack: DomainPack = {
  id: "fashion",
  name: "Fashion Check",
  description:
    "Shows what the AI can see about clothing, contrast, shape, and fit in an outfit image.",

  observable_entities: [
    "clothes: tops, bottoms, dresses, outerwear",
    "shoes and footwear",
    "accessories and bags",
    "glasses and eyewear",
    "visible fabric texture and how it hangs",
    "layering and overlap between clothes",
  ],

  observation_categories: [
    "proportion",
    "silhouette",
    "contrast",
    "continuity",
    "visual_weight",
    "structure",
    "drape",
    "segmentation",
    "focal_point",
    "symmetry",
    "line_direction",
    "texture",
    "emphasis",
    "color",
    "fit",
    "other",
  ],

  item_categories: [
    "top",
    "bottom",
    "dress",
    "outerwear",
    "shoes",
    "accessory",
    "glasses",
    "bag",
    "other",
  ],

  subject_types: ["person", "outfit", "object", "other"],

  principles: [
    "Uninterrupted vertical lines across garment boundaries create visual elongation.",
    "High contrast between upper and lower garments draws attention to the boundary region.",
    "Wider or visually louder lower garments emphasize the lower half relative to the upper half.",
    "Structured fabrics with sharp edges create geometric reads; draped fabrics create fluid reads.",
    "Accessories positioned at high-contrast zones act as focal anchors.",
    "Monochromatic outfits with no tonal breaks create a unified continuous visual shape.",
    "Volume expansion in one region visually compresses adjacent regions by comparison.",
  ],

  forbidden_claims: [
    "Do not judge attractiveness.",
    "Do not say whether the outfit is flattering or unflattering.",
    "Do not classify the wearer's fixed body shape.",
    "Do not comment on weight, beauty, desirability, or gender expression.",
    "Do not make absolute body-type labels such as pear-shaped or apple-shaped.",
  ],

  confidence_reducers: [
    "mirror angle or unusual camera angle",
    "significant occlusion of garments",
    "poor lighting that obscures color or texture",
    "cropping that cuts off relevant garment regions",
    "motion blur",
  ],

  example_observations: [
    "The outfit creates a mostly uninterrupted dark vertical shape from shoulder to hem.",
    "The skirt region appears visually wider than the waist region due to outward flare.",
    "The structured collar and center placket create sharper geometric lines in the upper portion.",
    "The white socks create one of the brightest contrast points in the lower portion of the image.",
    "The fabric appears moderately stiff with limited visible drape around the torso.",
    "The waist area appears visually narrower relative to the upper bodice and lower skirt.",
  ],

  example_forbidden: [
    "The outfit makes the user look bottom-heavy.",
    "The user has a pear-shaped body.",
    "This is unflattering.",
  ],
};
