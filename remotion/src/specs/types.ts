/**
 * Spec-driven AdvertiserAd — type definitions.
 *
 * Stage 1 of the migration: defines the contract between the spec
 * generator and the SpecAd composition. NOTHING in this file is
 * imported by the existing AdvertiserAd.tsx / SalesAd.tsx renders,
 * so production output is unaffected.
 */

// ── Business taxonomy ────────────────────────────────────────────────────────
// Categories the partner network actually serves in Raleigh NC plus a few
// expected expansions. Categories are used to filter compatible families.
export type BusinessCategory =
  // Barber / beauty
  | "barber" | "salon" | "nail" | "beauty" | "spa" | "tattoo"
  // Food & drink
  | "restaurant" | "cafe" | "bakery" | "bar" | "wine" | "icecream"
  // Events & kids
  | "balloon" | "events" | "kids" | "daycare" | "tourism"
  // Active / automotive
  | "gym" | "fitness" | "automotive" | "esports" | "gaming"
  // Health / education / professional
  | "medical" | "dental" | "education" | "wellness" | "yoga"
  | "legal" | "real-estate" | "religious"
  // Retail / lifestyle
  | "retail" | "jewelry" | "boutique" | "streetwear" | "sneaker"
  | "antique" | "bookstore" | "vegan" | "organic"
  // Tech
  | "tech" | "startup"
  // Nightlife
  | "nightclub"
  // Catch-all
  | "other";

// ── Photo vibes ──────────────────────────────────────────────────────────────
// Returned by the photo-analysis step (Gemini 2.5 Flash Image) and used
// to score family compatibility against the actual uploaded image.
export type PhotoVibe =
  | "dark" | "moody" | "warm" | "bright" | "vibrant"
  | "soft" | "elegant" | "high-contrast" | "saturated"
  | "natural-light" | "outdoor" | "indoor" | "studio"
  | "geometric" | "urban" | "neon" | "low-saturation"
  | "pastel" | "high-energy" | "professional"
  | "warm-light" | "cool-light" | "night" | "food"
  | "action" | "clean" | "rustic";

// ── Variation dimensions ─────────────────────────────────────────────────────
// Each family declares which options it allows along each dimension.
// The spec generator rolls one option per dimension using a deterministic
// seed (typically the advertiser_id) so the same advertiser always gets
// the same final spec but different advertisers in the same family land
// on different combinations.
export type PhotoMotion = "zoom-in" | "subtle-zoom" | "pan-x" | "pan-y" | "none";
export type EntryAnimation = "slide-up" | "slide-from-left" | "fade-up" | "type-on";
export type LinePosition = "left" | "center" | "right";
export type CTAStyle = "outlined" | "filled" | "underlined" | "badge";

// ── Layout templates ─────────────────────────────────────────────────────────
// Structural variations — different arrangements of the photo + text. This
// is what gives ads from the same family genuinely different LOOKS, not
// just different cosmetic skins. Each family declares which layouts it
// supports in its `layouts` field; the generator rolls one with the same
// seeded variation logic as every other dimension.
export type LayoutTemplate =
  // Default. Full-bleed photo, content stack at the bottom with the
  // family's chosen alignment. Mirrors the legacy AdvertiserAd structure.
  | "photo-full-text-bottom"
  // Cinematic / movie-poster. Photo fills the frame, content stack pulls
  // toward the visual center with bigger headline. High-impact for
  // luxury, gym, nightclub categories.
  | "photo-overlay-text-center"
  // 50/50 split. Photo on one side, text panel on the other. Editorial
  // / corporate feel. Strong fit for tech, real-estate, clean-pro.
  // Horizontal renders left/right; vertical renders top/bottom.
  | "split-vertical"
  // Photo framed in a Polaroid-style card on a decorative background,
  // text below. Intimate / handcrafted. Pairs with artisan, vintage,
  // pastel, rose-elegant.
  | "polaroid";

// ── Family definition ────────────────────────────────────────────────────────
// Curated visual family. The 15 families together cover the full range of
// businesses we expect to onboard.
export interface FamilyDefinition {
  name: string;
  displayName: string;

  // Categories where this family fits naturally.
  affinity: BusinessCategory[];

  // Categories where this family would clash hard. Used as a hard filter
  // (an incompatible family is never picked even if affinity matches).
  incompatible: BusinessCategory[];

  // Photo vibes the family pairs with — used by the photo-aware scoring
  // step to pick among multiple compatible families.
  photoVibes: PhotoVibe[];

  // Variation pools — the spec generator rolls one option per dimension
  // using the advertiser_id as seed.
  palette: string[];          // 4 accent-color shades within the family
  textColors: string[];       // 1-2 text colors that read well on overlay
  fonts: string[];            // 3-4 font-family CSS strings
  motions: PhotoMotion[];     // photo motion options
  entries: EntryAnimation[];  // headline entry animation options
  linePositions: LinePosition[];
  ctaStyles: CTAStyle[];

  // Layout templates this family looks good in. Each family declares 1-3
  // — the spec generator rolls one. Hard-required: at least one entry
  // (defaults to `["photo-full-text-bottom"]` if omitted, but the type
  // forces the family author to think about it).
  layouts: LayoutTemplate[];

  // Overlay gradient (CSS string). Static per family — the gradient is
  // identity-defining for the look, the variation happens above it.
  overlayGradient: string;

  // Optional intro effect. null means no intro.
  intro: { type: "flash"; color: string; duration: number } | null;
}

// ── Final ad spec ────────────────────────────────────────────────────────────
// Produced by the spec generator. Consumed by the SpecAd Remotion
// composition. Plain JSON-serializable so it can flow through edge
// functions and GitHub Actions inputs without translation.
export interface AdSpec {
  version: 1;
  format: "horizontal" | "vertical";
  duration: number;
  fps: number;

  // For debug / observability — does NOT affect render.
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
    template: LayoutTemplate;
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

  // null = render no tagline.
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
    accentColor: string;        // duplicated from tokens for primitive convenience
    borderRadius: number;
    bgAlpha: number;
    delay: number;
  };
}

// ── Inputs to the spec generator ─────────────────────────────────────────────
export interface AdInputs {
  advertiserId: string;
  businessName: string;
  category: BusinessCategory | string;   // string allowed for legacy values
  tagline?: string;
  cta?: string;
  photoUrl: string;
  photoVibes?: PhotoVibe[];              // from Gemini photo analysis
  format?: "horizontal" | "vertical";    // default "horizontal"
}
