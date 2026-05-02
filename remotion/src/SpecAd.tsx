/**
 * SpecAd — composition that turns an AdSpec into a rendered ad.
 *
 * Each AdSpec selects a LAYOUT TEMPLATE (`spec.layout.template`) plus
 * cosmetic variations (palette, font, motion, entry, CTA style). This
 * composition is now a thin dispatcher: it looks up the layout by
 * template name and hands the whole spec to that layout component.
 *
 * The layouts themselves are full Remotion compositions (they render
 * the photo, overlay, intro, accent line, headline, tagline and CTA
 * in their own structural arrangement). This is what gives ads from
 * the same family genuinely different LOOKS — not just different
 * cosmetic skins.
 *
 * Lives alongside the legacy AdvertiserAd composition. Production
 * traffic still flows through AdvertiserAd until Phase 7 switchover.
 */

import React from "react";
import type { AdSpec, LayoutTemplate } from "./specs";
import { generateSpec } from "./specs";
import {
  LayoutPhotoFullTextBottom,
  LayoutPhotoOverlayTextCenter,
  LayoutSplitVertical,
  LayoutPolaroid,
  LayoutProps,
} from "./primitives/layouts";

export interface SpecAdProps {
  spec?: AdSpec;
}

// ── Layout dispatch table ────────────────────────────────────────────────────
// Adding a new layout means: define a new LayoutTemplate value in
// specs/types.ts, build the layout component under primitives/layouts/,
// and register it here. SpecAd itself stays a one-line dispatcher.
const LAYOUTS: Record<LayoutTemplate, React.FC<LayoutProps>> = {
  "photo-full-text-bottom":     LayoutPhotoFullTextBottom,
  "photo-overlay-text-center":  LayoutPhotoOverlayTextCenter,
  "split-vertical":             LayoutSplitVertical,
  "polaroid":                   LayoutPolaroid,
};

// ── Default spec for Studio preview ──────────────────────────────────────────
// Generated from sample inputs so opening Remotion Studio always shows a
// representative ad (no blank canvas). Production renders override this
// with the real spec passed via inputProps.
const DEFAULT_SPEC: AdSpec = generateSpec({
  advertiserId: "studio-preview",
  businessName: "Mi Negocio",
  category: "barber",
  tagline: "Calidad y servicio",
  cta: "Visítanos",
  photoUrl: "",
  format: "horizontal",
});

export const SpecAd: React.FC<SpecAdProps> = ({ spec = DEFAULT_SPEC }) => {
  // Defensive lookup — older specs that predate the layout dimension
  // won't have a `template` field, in which case we fall back to the
  // legacy full-bleed layout. New specs always carry one.
  const template: LayoutTemplate = (spec.layout?.template ?? "photo-full-text-bottom") as LayoutTemplate;
  const Layout = LAYOUTS[template] ?? LayoutPhotoFullTextBottom;
  return <Layout spec={spec} />;
};
