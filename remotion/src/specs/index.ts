/**
 * Spec module — public surface.
 *
 * Other modules (the SpecAd composition, the render script, edge
 * functions) import from this index to avoid touching internal files.
 */

export type {
  BusinessCategory,
  PhotoVibe,
  PhotoMotion,
  EntryAnimation,
  LinePosition,
  CTAStyle,
  FamilyDefinition,
  AdSpec,
  AdInputs,
} from "./types";

export {
  FAMILIES,
  FAMILY_BY_NAME,
  DEFAULT_FAMILY,
} from "./families";

export { generateSpec } from "./specGenerator";
