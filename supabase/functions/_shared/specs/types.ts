/**
 * Spec module — types.
 *
 * THIS FILE IS A DENO-COMPATIBLE MIRROR OF
 *   remotion/src/specs/types.ts
 *
 * Edge functions run on Deno; the Remotion module runs on Node.
 * Deno can't reach across the supabase/ ↔ remotion/ directory
 * boundary at deploy time, so we keep a synchronized copy here.
 *
 * If you change the Remotion-side file, mirror the change here
 * (and vice-versa). Both files should always be byte-equivalent
 * apart from this header.
 */

export type BusinessCategory =
  | "barber" | "salon" | "nail" | "beauty" | "spa" | "tattoo"
  | "restaurant" | "cafe" | "bakery" | "bar" | "wine" | "icecream"
  | "balloon" | "events" | "kids" | "daycare" | "tourism"
  | "gym" | "fitness" | "automotive" | "esports" | "gaming"
  | "medical" | "dental" | "education" | "wellness" | "yoga"
  | "legal" | "real-estate" | "religious"
  | "retail" | "jewelry" | "boutique" | "streetwear" | "sneaker"
  | "antique" | "bookstore" | "vegan" | "organic"
  | "tech" | "startup"
  | "nightclub"
  | "other";

export type PhotoVibe =
  | "dark" | "moody" | "warm" | "bright" | "vibrant"
  | "soft" | "elegant" | "high-contrast" | "saturated"
  | "natural-light" | "outdoor" | "indoor" | "studio"
  | "geometric" | "urban" | "neon" | "low-saturation"
  | "pastel" | "high-energy" | "professional"
  | "warm-light" | "cool-light" | "night" | "food"
  | "action" | "clean" | "rustic";

export type PhotoMotion = "zoom-in" | "subtle-zoom" | "pan-x" | "pan-y" | "none";
export type EntryAnimation = "slide-up" | "slide-from-left" | "fade-up" | "type-on";
export type LinePosition = "left" | "center" | "right";
export type CTAStyle = "outlined" | "filled" | "underlined" | "badge";

export interface FamilyDefinition {
  name: string;
  displayName: string;
  affinity: BusinessCategory[];
  incompatible: BusinessCategory[];
  photoVibes: PhotoVibe[];
  palette: string[];
  textColors: string[];
  fonts: string[];
  motions: PhotoMotion[];
  entries: EntryAnimation[];
  linePositions: LinePosition[];
  ctaStyles: CTAStyle[];
  overlayGradient: string;
  intro: { type: "flash"; color: string; duration: number } | null;
}

export interface AdSpec {
  version: 1;
  format: "horizontal" | "vertical";
  duration: number;
  fps: number;

  meta?: {
    family: string;
    advertiserId?: string;
    seed?: string;
    generatedAt?: string;
    photoVibes?: PhotoVibe[];
  };

  tokens: {
    accentColor: string;
    textColor: string;
    fontFamily: string;
    overlay: string;
  };

  layout: {
    alignment: "left" | "center" | "right";
    padding: string;
  };

  photo: {
    url: string;
    motion: PhotoMotion;
    zoomTo: number;
  };

  intro: { type: "flash"; color: string; duration: number } | null;

  accentLine: {
    delay: number;
    width: number;
    height: number;
    position: LinePosition;
  };

  headline: {
    text: string;
    fontSize: number;
    fontWeight: number;
    fontStyle: "normal" | "italic";
    textTransform: "none" | "uppercase";
    letterSpacing: number;
    entry: EntryAnimation;
    delay: number;
    springConfig: { damping: number; stiffness: number };
  };

  tagline: {
    text: string;
    fontSize: number;
    fontWeight: number;
    fontStyle: "normal" | "italic";
    textTransform: "none" | "uppercase";
    letterSpacing: number;
    entry: EntryAnimation;
    delay: number;
  } | null;

  cta: {
    text: string;
    fontSize: number;
    style: CTAStyle;
    accentColor: string;
    borderRadius: number;
    bgAlpha: number;
    delay: number;
  };
}

export interface AdInputs {
  advertiserId: string;
  businessName: string;
  category: BusinessCategory | string;
  tagline?: string;
  cta?: string;
  photoUrl: string;
  photoVibes?: PhotoVibe[];
  format?: "horizontal" | "vertical";
}
