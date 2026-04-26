/**
 * Primitives module — public surface.
 *
 * The SpecAd composition (Phase 3) imports from this index to
 * assemble an ad from a spec. No other code path depends on these
 * primitives, so the legacy AdvertiserAd.tsx and SalesAd.tsx renders
 * stay untouched.
 */

export { PhotoBackground } from "./PhotoBackground";
export type { PhotoBackgroundProps } from "./PhotoBackground";

export { GradientOverlay } from "./GradientOverlay";
export type { GradientOverlayProps } from "./GradientOverlay";

export { EntryFlash } from "./EntryFlash";
export type { EntryFlashProps } from "./EntryFlash";

export { AccentLine } from "./AccentLine";
export type { AccentLineProps } from "./AccentLine";

export { Headline } from "./Headline";
export type { HeadlineProps } from "./Headline";

export { Tagline } from "./Tagline";
export type { TaglineProps } from "./Tagline";

export { CTABox } from "./CTABox";
export type { CTABoxProps } from "./CTABox";

export { ContentLayout } from "./ContentLayout";
export type { ContentLayoutProps } from "./ContentLayout";
