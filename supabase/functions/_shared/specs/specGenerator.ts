/**
 * Spec generator — turns advertiser inputs into a renderable AdSpec.
 *
 * THIS FILE IS A DENO-COMPATIBLE MIRROR OF
 *   remotion/src/specs/specGenerator.ts
 *
 * Edge functions run on Deno (which requires .ts extensions on
 * relative imports); the Remotion module runs on Node (which
 * does not). Both files must stay byte-equivalent apart from this
 * header block and the .ts suffixes on the relative imports below.
 *
 * Three layers:
 *   1. Hard filter: drop families incompatible with the business category.
 *   2. Photo scoring: among compatible families, prefer the ones whose
 *      photoVibes overlap with the vibes returned by Gemini's photo
 *      analysis. Falls back to "first compatible" when no vibes given.
 *   3. Deterministic variation: roll one option per variation dimension
 *      using hash(advertiserId) as seed.
 */

import type {
  FamilyDefinition,
  AdSpec,
  AdInputs,
  PhotoVibe,
  PhotoMotion,
  EntryAnimation,
  LinePosition,
  CTAStyle,
  LayoutTemplate,
} from "./types.ts";
import { FAMILIES, DEFAULT_FAMILY } from "./families.ts";

// ── Tiny stable hash (djb2) ──────────────────────────────────────────────────
// Deterministic. No crypto needed — we just want a uniform-ish integer
// stream for variation rolls. Adding a per-dimension salt prevents
// correlated rolls (e.g. the same advertiser landing on motion[0] AND
// font[0] AND entry[0] all the time).
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  // Force unsigned.
  return h >>> 0;
}

function pick<T>(pool: T[], seed: string, salt: string): T {
  if (pool.length === 0) {
    throw new Error(`spec generator: empty pool for salt "${salt}"`);
  }
  const idx = hash(seed + ":" + salt) % pool.length;
  return pool[idx];
}

// ── Layer 1: category compatibility filter ───────────────────────────────────
function filterByCategory(category: string): FamilyDefinition[] {
  // A family is compatible if EITHER:
  //   (a) the category appears in family.affinity (positive match), OR
  //   (b) the category does NOT appear in family.incompatible AND family
  //       has no affinity overlap requirement (catch-all).
  //
  // We prefer (a). If (a) returns at least one family we use that set.
  // If (a) returns zero, we relax to (b) so a brand-new category like
  // "funeral" still gets a render (just less perfect).
  const positive = FAMILIES.filter((f) =>
    f.affinity.some((c) => c === category)
  );
  if (positive.length > 0) return positive;

  // Soft fallback: anything that's not explicitly incompatible.
  const soft = FAMILIES.filter((f) =>
    !f.incompatible.some((c) => c === category)
  );
  if (soft.length > 0) return soft;

  // Hard fallback: everything (shouldn't really happen).
  return FAMILIES;
}

// ── Layer 2: photo-vibe scoring ──────────────────────────────────────────────
// Score = number of overlapping vibes. Ties broken by registry order
// (so well-established families win over experimental ones).
function scoreFamily(family: FamilyDefinition, vibes: PhotoVibe[]): number {
  if (vibes.length === 0) return 0;
  let score = 0;
  for (const v of vibes) {
    if (family.photoVibes.includes(v)) score += 1;
  }
  return score;
}

function pickFamily(category: string, vibes: PhotoVibe[] | undefined, seed: string): FamilyDefinition {
  const candidates = filterByCategory(category);
  if (candidates.length === 1) return candidates[0];

  // No vibes available → pick deterministically by seed among candidates.
  if (!vibes || vibes.length === 0) {
    return pick(candidates, seed, "family");
  }

  // Score each, take highest. Ties resolved by seed-based pick among
  // tied families — keeps determinism even with ties.
  const scored = candidates.map((f) => ({ f, score: scoreFamily(f, vibes) }));
  const max = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === max).map((s) => s.f);
  if (top.length === 1) return top[0];
  return pick(top, seed, "family-tiebreak");
}

// ── Layer 3: variation rolls + spec assembly ─────────────────────────────────
function defaultsForFormat(format: "horizontal" | "vertical") {
  // Padding and font scale tweaked per aspect ratio. The composition will
  // also reflow internally — these are layout-level hints.
  if (format === "vertical") {
    return {
      padding: "120px 80px",
      headlineFontSize: 110,
      taglineFontSize: 52,
      ctaFontSize: 36,
      accentLineWidth: 100,
    };
  }
  return {
    padding: "80px 96px",
    headlineFontSize: 140,
    taglineFontSize: 64,
    ctaFontSize: 40,
    accentLineWidth: 120,
  };
}

const STYLE_BY_CTA: Record<CTAStyle, { borderRadius: number; bgAlpha: number }> = {
  outlined:    { borderRadius: 0,  bgAlpha: 0 },
  underlined:  { borderRadius: 0,  bgAlpha: 0 },   // primitive renders without border
  filled:      { borderRadius: 4,  bgAlpha: 0.95 },
  badge:       { borderRadius: 50, bgAlpha: 0.18 },
};

const ZOOM_BY_MOTION: Record<PhotoMotion, number> = {
  "zoom-in":     1.10,
  "subtle-zoom": 1.04,
  "pan-x":       1.02,
  "pan-y":       1.02,
  "none":        1.00,
};

/**
 * Generate a renderable AdSpec for the given inputs. Pure / deterministic
 * given the same inputs (including advertiserId).
 */
export function generateSpec(inputs: AdInputs): AdSpec {
  const format = inputs.format ?? "horizontal";
  const seed = inputs.advertiserId;
  const def = defaultsForFormat(format);

  // ── Pick family ────────────────────────────────────────────────────────────
  let family: FamilyDefinition;
  try {
    family = pickFamily(String(inputs.category), inputs.photoVibes, seed);
  } catch {
    family = DEFAULT_FAMILY;
  }

  // ── Roll variations ────────────────────────────────────────────────────────
  const accentColor: string  = pick(family.palette, seed, "accent");
  const textColor: string    = pick(family.textColors, seed, "text");
  const fontFamily: string   = pick(family.fonts, seed, "font");
  const motion: PhotoMotion  = pick(family.motions, seed, "motion");
  const entry: EntryAnimation = pick(family.entries, seed, "entry");
  const linePosition: LinePosition = pick(family.linePositions, seed, "line-pos");
  const ctaStyle: CTAStyle   = pick(family.ctaStyles, seed, "cta-style");
  // Layout pool can be missing on a hand-crafted spec — fall back gracefully
  // to the legacy default so the generator never explodes on incomplete data.
  const layoutPool = (family.layouts && family.layouts.length > 0)
    ? family.layouts
    : (["photo-full-text-bottom"] as LayoutTemplate[]);
  const layoutTemplate: LayoutTemplate = pick(layoutPool, seed, "layout");
  const ctaCfg = STYLE_BY_CTA[ctaStyle];
  const zoomTo = ZOOM_BY_MOTION[motion];

  // Tagline-bearing entries can differ from headline — we mirror unless
  // the headline rolls "type-on", which doesn't compose well for taglines.
  const taglineEntry: EntryAnimation = entry === "type-on" ? "fade-up" : entry;

  // ── Assemble spec ──────────────────────────────────────────────────────────
  return {
    version: 1,
    format,
    duration: 300,
    fps: 30,

    meta: {
      family: family.name,
      advertiserId: seed,
      seed,
      generatedAt: new Date().toISOString(),
      photoVibes: inputs.photoVibes,
    },

    tokens: {
      accentColor,
      textColor,
      fontFamily,
      overlay: family.overlayGradient,
    },

    layout: {
      template: layoutTemplate,
      alignment: linePosition,   // headline+content align with the line
      padding: def.padding,
    },

    photo: {
      url: inputs.photoUrl,
      motion,
      zoomTo,
    },

    intro: family.intro,

    accentLine: {
      delay: family.intro ? 15 : 25,
      width: def.accentLineWidth,
      height: 5,
      position: linePosition,
    },

    headline: {
      text: inputs.businessName,
      fontSize: def.headlineFontSize,
      fontWeight: 700,
      fontStyle: "normal",
      textTransform: "none",
      letterSpacing: 0,
      entry,
      delay: family.intro ? 22 : 38,
      springConfig: family.intro
        ? { damping: 18, stiffness: 150 }
        : { damping: 14, stiffness: 90 },
    },

    tagline: inputs.tagline
      ? {
          text: inputs.tagline,
          fontSize: def.taglineFontSize,
          fontWeight: 300,
          fontStyle: "normal",
          textTransform: "none",
          letterSpacing: 0,
          entry: taglineEntry,
          delay: family.intro ? 48 : 68,
        }
      : null,

    cta: {
      text: inputs.cta ?? "Visítanos",
      fontSize: def.ctaFontSize,
      style: ctaStyle,
      accentColor,
      borderRadius: ctaCfg.borderRadius,
      bgAlpha: ctaCfg.bgAlpha,
      delay: family.intro ? 68 : 98,
    },
  };
}
