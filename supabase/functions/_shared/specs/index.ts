/**
 * Spec module — public surface (Deno mirror).
 *
 * Mirrors remotion/src/specs/index.ts but with .ts extensions on
 * relative re-exports for Deno compatibility.
 */

export type {
  BusinessCategory,
  PhotoVibe,
  PhotoMotion,
  EntryAnimation,
  LinePosition,
  CTAStyle,
  LayoutTemplate,
  FamilyDefinition,
  AdSpec,
  AdInputs,
} from "./types.ts";

export {
  FAMILIES,
  FAMILY_BY_NAME,
  DEFAULT_FAMILY,
} from "./families.ts";

export { generateSpec } from "./specGenerator.ts";
