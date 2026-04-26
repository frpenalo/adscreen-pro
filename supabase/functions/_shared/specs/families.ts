/**
 * 15 curated visual families for AdvertiserAd.
 *
 * THIS FILE IS A DENO-COMPATIBLE MIRROR OF
 *   remotion/src/specs/families.ts
 *
 * Edge functions run on Deno (which requires .ts extensions on
 * relative imports); the Remotion module runs on Node (which
 * does not). Both files must stay byte-equivalent apart from this
 * header block and the .ts suffix on the relative import below.
 *
 * Each family is a self-contained record:
 *   - Where it fits (affinity / incompatible categories)
 *   - What photo vibes it pairs with
 *   - Variation pools per dimension (palette, fonts, motions, entries, etc.)
 *
 * Adding a new family = adding a new record here. No other file needs to
 * change. The spec generator and SpecAd composition consume this list
 * generically through the FamilyDefinition contract.
 */

import type { FamilyDefinition } from "./types.ts";

// ── 1. dark-gold ─────────────────────────────────────────────────────────────
// Legacy "dark-gold" style. Classic, masculine, premium.
const darkGold: FamilyDefinition = {
  name: "dark-gold",
  displayName: "Dark Gold",
  affinity: ["barber", "salon", "jewelry", "boutique"],
  incompatible: ["balloon", "kids", "daycare"],
  photoVibes: ["dark", "moody", "indoor", "studio", "warm-light"],
  palette: ["#C9A84C", "#B8860B", "#D4AF37", "#A07F2C"],
  textColors: ["#ffffff", "#fef9e7"],
  fonts: [
    "Georgia, 'Times New Roman', serif",
    "'Playfair Display', Georgia, serif",
    "'Cormorant Garamond', serif",
    "'EB Garamond', serif",
  ],
  motions: ["zoom-in", "subtle-zoom", "pan-x"],
  entries: ["slide-up", "fade-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
  intro: null,
};

// ── 2. warm-amber ────────────────────────────────────────────────────────────
// Legacy "warm-amber". Restaurants and food. Warm tones, inviting.
const warmAmber: FamilyDefinition = {
  name: "warm-amber",
  displayName: "Warm Amber",
  affinity: ["restaurant", "cafe", "bakery", "icecream"],
  incompatible: ["legal", "medical", "tech", "kids-soft" as any],
  photoVibes: ["warm", "warm-light", "indoor", "food", "rustic"],
  palette: ["#E8943A", "#C77B2E", "#F4A04C", "#B86C1E"],
  textColors: ["#ffffff", "#fff5e6"],
  fonts: [
    "Arial, Helvetica, sans-serif",
    "'Lora', Georgia, serif",
    "'Merriweather', serif",
    "'Source Sans Pro', sans-serif",
  ],
  motions: ["zoom-in", "pan-x", "subtle-zoom"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["center", "left"],
  ctaStyles: ["outlined", "filled"],
  overlayGradient: "linear-gradient(to top, rgba(50,18,0,0.90) 0%, rgba(80,30,0,0.35) 55%, transparent 100%)",
  intro: null,
};

// ── 3. rose-elegant ──────────────────────────────────────────────────────────
// Legacy "rose-elegant". Beauty, nails, spa. Soft, feminine.
const roseElegant: FamilyDefinition = {
  name: "rose-elegant",
  displayName: "Rose Elegant",
  affinity: ["nail", "beauty", "spa", "boutique"],
  incompatible: ["gym", "automotive", "esports", "tech"],
  photoVibes: ["soft", "elegant", "natural-light", "studio", "pastel"],
  palette: ["#C9878F", "#D8A0A8", "#B26C76", "#E5B5BC"],
  textColors: ["#fff8f8", "#ffffff"],
  fonts: [
    "Georgia, serif",
    "'Cormorant Garamond', serif",
    "'Playfair Display', serif",
    "'Italiana', serif",
  ],
  motions: ["pan-y", "subtle-zoom", "zoom-in"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(55,10,20,0.88) 0%, rgba(90,20,35,0.30) 55%, transparent 100%)",
  intro: null,
};

// ── 4. bold-energy ───────────────────────────────────────────────────────────
// Legacy "bold-energy". Gym, fitness, automotive, esports. Strong contrast.
const boldEnergy: FamilyDefinition = {
  name: "bold-energy",
  displayName: "Bold Energy",
  affinity: ["gym", "fitness", "automotive", "esports", "gaming"],
  incompatible: ["spa", "beauty", "kids", "daycare"],
  photoVibes: ["high-contrast", "high-energy", "action", "saturated", "urban"],
  palette: ["#3B82F6", "#2563EB", "#EF4444", "#F59E0B"],
  textColors: ["#ffffff"],
  fonts: [
    "'Arial Black', Arial, sans-serif",
    "'Bebas Neue', Impact, sans-serif",
    "'Oswald', sans-serif",
    "'Anton', Impact, sans-serif",
  ],
  motions: ["zoom-in", "subtle-zoom"],
  entries: ["slide-from-left", "slide-up"],
  linePositions: ["left"],
  ctaStyles: ["filled", "outlined", "badge"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,10,40,0.55) 50%, transparent 100%)",
  intro: { type: "flash", color: "#000000", duration: 14 },
};

// ── 5. clean-pro ─────────────────────────────────────────────────────────────
// Legacy "clean-pro". Health, education, retail-tech. Neutral, trustworthy.
const cleanPro: FamilyDefinition = {
  name: "clean-pro",
  displayName: "Clean Professional",
  affinity: ["medical", "dental", "education", "retail", "real-estate", "legal"],
  incompatible: ["nightclub", "tattoo", "streetwear"],
  photoVibes: ["bright", "clean", "professional", "natural-light", "studio"],
  palette: ["#4A90D9", "#2563EB", "#0EA5E9", "#1E40AF"],
  textColors: ["#ffffff"],
  fonts: [
    "Arial, Helvetica, sans-serif",
    "'Inter', sans-serif",
    "'Helvetica Neue', sans-serif",
    "'Source Sans Pro', sans-serif",
  ],
  motions: ["subtle-zoom", "pan-x", "none"],
  entries: ["slide-from-left", "fade-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["filled", "outlined"],
  overlayGradient: "linear-gradient(to top, rgba(0,20,55,0.90) 0%, rgba(0,30,70,0.35) 55%, transparent 100%)",
  intro: null,
};

// ── 6. minimalist-bw ─────────────────────────────────────────────────────────
// Premium clean. White/black/grays. Jewelry, architects, photo studios.
const minimalistBw: FamilyDefinition = {
  name: "minimalist-bw",
  displayName: "Minimalist B/W",
  affinity: ["jewelry", "boutique", "real-estate", "tech", "wellness"],
  incompatible: ["balloon", "kids", "daycare", "nightclub"],
  photoVibes: ["clean", "high-contrast", "studio", "professional", "elegant"],
  palette: ["#000000", "#1F1F1F", "#525252", "#FFFFFF"],
  textColors: ["#ffffff", "#FAFAFA"],
  fonts: [
    "'Inter', sans-serif",
    "'Helvetica Neue', sans-serif",
    "'IBM Plex Sans', sans-serif",
    "'Work Sans', sans-serif",
  ],
  motions: ["none", "subtle-zoom"],
  entries: ["fade-up", "slide-from-left"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)",
  intro: null,
};

// ── 7. tropical ──────────────────────────────────────────────────────────────
// Vibrant, kids, balloons, beach. Coral / turquoise / yellow.
const tropical: FamilyDefinition = {
  name: "tropical",
  displayName: "Tropical",
  affinity: ["balloon", "events", "kids", "icecream", "tourism", "cafe"],
  incompatible: ["legal", "medical", "religious", "antique"],
  photoVibes: ["bright", "vibrant", "outdoor", "saturated", "natural-light"],
  palette: ["#FF6F61", "#06B6D4", "#FBBF24", "#22C55E"],
  textColors: ["#ffffff", "#FFF7ED"],
  fonts: [
    "'Nunito', sans-serif",
    "'Quicksand', sans-serif",
    "'Poppins', sans-serif",
    "'Fredoka', sans-serif",
  ],
  motions: ["pan-x", "zoom-in", "pan-y"],
  entries: ["slide-up", "fade-up"],
  linePositions: ["center", "left"],
  ctaStyles: ["filled", "badge"],
  overlayGradient: "linear-gradient(to top, rgba(20,80,120,0.55) 0%, rgba(255,180,140,0.20) 55%, transparent 100%)",
  intro: null,
};

// ── 8. luxury-noir ───────────────────────────────────────────────────────────
// Black + champagne. High-end restaurants, premium spas, watches.
const luxuryNoir: FamilyDefinition = {
  name: "luxury-noir",
  displayName: "Luxury Noir",
  affinity: ["jewelry", "spa", "restaurant", "wine", "boutique"],
  incompatible: ["balloon", "kids", "daycare", "fitness"],
  photoVibes: ["dark", "elegant", "high-contrast", "studio", "moody"],
  palette: ["#D4AF37", "#C0C0C0", "#FFD700", "#B8860B"],
  textColors: ["#ffffff", "#F5F0E1"],
  fonts: [
    "'Playfair Display', Georgia, serif",
    "'Cormorant Garamond', serif",
    "'EB Garamond', serif",
    "'Italiana', serif",
  ],
  motions: ["subtle-zoom", "pan-y", "zoom-in"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["center", "left"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.15) 100%)",
  intro: null,
};

// ── 9. modern-tech ───────────────────────────────────────────────────────────
// Cyan / violet / dark navy. Tech, startups, software.
const modernTech: FamilyDefinition = {
  name: "modern-tech",
  displayName: "Modern Tech",
  affinity: ["tech", "startup", "gaming", "esports", "education"],
  incompatible: ["antique", "bakery", "religious"],
  photoVibes: ["geometric", "clean", "high-contrast", "neon", "studio"],
  palette: ["#06B6D4", "#8B5CF6", "#3B82F6", "#10B981"],
  textColors: ["#ffffff"],
  fonts: [
    "'Space Grotesk', sans-serif",
    "'JetBrains Mono', monospace",
    "'Inter', sans-serif",
    "'IBM Plex Sans', sans-serif",
  ],
  motions: ["zoom-in", "subtle-zoom", "none"],
  entries: ["slide-from-left", "fade-up", "type-on"],
  linePositions: ["left"],
  ctaStyles: ["filled", "outlined", "badge"],
  overlayGradient: "linear-gradient(to top, rgba(10,15,40,0.92) 0%, rgba(20,30,80,0.45) 50%, transparent 100%)",
  intro: null,
};

// ── 10. artisan-warm ─────────────────────────────────────────────────────────
// Earth tones + olive greens. Bakeries, crafts, artisan-anything.
const artisanWarm: FamilyDefinition = {
  name: "artisan-warm",
  displayName: "Artisan Warm",
  affinity: ["bakery", "cafe", "boutique", "wellness", "organic"],
  incompatible: ["tech", "esports", "nightclub"],
  photoVibes: ["warm", "warm-light", "natural-light", "indoor", "rustic"],
  palette: ["#A0522D", "#8B6914", "#6B8E23", "#D2691E"],
  textColors: ["#ffffff", "#FFF8DC"],
  fonts: [
    "'Lora', Georgia, serif",
    "'Merriweather', serif",
    "'EB Garamond', serif",
    "'Caveat', cursive",
  ],
  motions: ["pan-x", "subtle-zoom", "pan-y"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(60,30,10,0.88) 0%, rgba(120,80,40,0.30) 55%, transparent 100%)",
  intro: null,
};

// ── 11. urban-graffiti ───────────────────────────────────────────────────────
// Black + neon yellow + spray. Streetwear, sneakers, tattoo, hip-hop.
const urbanGraffiti: FamilyDefinition = {
  name: "urban-graffiti",
  displayName: "Urban Graffiti",
  affinity: ["streetwear", "sneaker", "tattoo", "barber", "gaming"],
  incompatible: ["luxury-noir" as any, "spa", "kids", "religious", "real-estate"],
  photoVibes: ["high-contrast", "urban", "saturated", "high-energy"],
  palette: ["#FACC15", "#EF4444", "#22D3EE", "#A3E635"],
  textColors: ["#ffffff"],
  fonts: [
    "'Bebas Neue', Impact, sans-serif",
    "'Anton', Impact, sans-serif",
    "'Oswald', sans-serif",
    "'Permanent Marker', cursive",
  ],
  motions: ["zoom-in", "pan-x"],
  entries: ["slide-from-left", "slide-up"],
  linePositions: ["left"],
  ctaStyles: ["filled", "badge"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.40) 50%, transparent 100%)",
  intro: { type: "flash", color: "#000000", duration: 10 },
};

// ── 12. pastel-soft ──────────────────────────────────────────────────────────
// Pastels (rosa, lila, menta). Kids, daycare, cute cafes.
const pastelSoft: FamilyDefinition = {
  name: "pastel-soft",
  displayName: "Pastel Soft",
  affinity: ["kids", "daycare", "icecream", "cafe", "boutique"],
  incompatible: ["gym", "automotive", "tattoo", "nightclub", "luxury-noir" as any],
  photoVibes: ["soft", "pastel", "bright", "natural-light"],
  palette: ["#F9A8D4", "#C4B5FD", "#A7F3D0", "#FDE68A"],
  textColors: ["#ffffff", "#fff5fa"],
  fonts: [
    "'Quicksand', sans-serif",
    "'Nunito', sans-serif",
    "'Poppins', sans-serif",
    "'Fredoka', sans-serif",
  ],
  motions: ["subtle-zoom", "pan-y", "pan-x"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["center", "left"],
  ctaStyles: ["filled", "outlined"],
  overlayGradient: "linear-gradient(to top, rgba(120,60,90,0.55) 0%, rgba(255,200,220,0.25) 55%, transparent 100%)",
  intro: null,
};

// ── 13. vintage-retro ────────────────────────────────────────────────────────
// Sepia + browns + cream. Bars, antique shops, vinyl, bookstores.
const vintageRetro: FamilyDefinition = {
  name: "vintage-retro",
  displayName: "Vintage Retro",
  affinity: ["bar", "antique", "bookstore", "wine", "cafe"],
  incompatible: ["balloon", "kids", "daycare", "tech", "esports"],
  photoVibes: ["warm", "moody", "low-saturation", "indoor", "rustic"],
  palette: ["#92400E", "#A16207", "#78350F", "#D97706"],
  textColors: ["#FFF8DC", "#ffffff"],
  fonts: [
    "'Playfair Display', serif",
    "'EB Garamond', serif",
    "'Lora', serif",
    "'Caveat', cursive",
  ],
  motions: ["pan-x", "subtle-zoom"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "underlined"],
  overlayGradient: "linear-gradient(to top, rgba(40,20,5,0.92) 0%, rgba(80,40,10,0.40) 55%, transparent 100%)",
  intro: null,
};

// ── 14. nature-organic ───────────────────────────────────────────────────────
// Greens + earth + cream. Wellness, yoga, vegan, garden centers.
const natureOrganic: FamilyDefinition = {
  name: "nature-organic",
  displayName: "Nature Organic",
  affinity: ["wellness", "yoga", "vegan", "organic", "spa"],
  incompatible: ["gym", "automotive", "esports", "nightclub", "fast-food" as any],
  photoVibes: ["natural-light", "outdoor", "soft", "clean", "warm-light"],
  palette: ["#16A34A", "#65A30D", "#84CC16", "#15803D"],
  textColors: ["#ffffff", "#F0FDF4"],
  fonts: [
    "'Lora', serif",
    "'Source Sans Pro', sans-serif",
    "'Merriweather', serif",
    "'Inter', sans-serif",
  ],
  motions: ["pan-y", "subtle-zoom", "pan-x"],
  entries: ["fade-up", "slide-up"],
  linePositions: ["left", "center"],
  ctaStyles: ["outlined", "filled"],
  overlayGradient: "linear-gradient(to top, rgba(20,60,30,0.85) 0%, rgba(40,80,40,0.30) 55%, transparent 100%)",
  intro: null,
};

// ── 15. glow-neon ────────────────────────────────────────────────────────────
// Black + neons (cyan, magenta, lime). Nightclubs, gaming, esports.
const glowNeon: FamilyDefinition = {
  name: "glow-neon",
  displayName: "Glow Neon",
  affinity: ["nightclub", "bar", "gaming", "esports", "events"],
  incompatible: ["medical", "religious", "kids", "daycare", "real-estate"],
  photoVibes: ["dark", "neon", "night", "high-contrast", "saturated"],
  palette: ["#22D3EE", "#F472B6", "#A3E635", "#FB923C"],
  textColors: ["#ffffff"],
  fonts: [
    "'Orbitron', sans-serif",
    "'Audiowide', sans-serif",
    "'Bebas Neue', sans-serif",
    "'Space Grotesk', sans-serif",
  ],
  motions: ["zoom-in", "subtle-zoom"],
  entries: ["slide-from-left", "fade-up", "type-on"],
  linePositions: ["left", "center"],
  ctaStyles: ["badge", "filled", "outlined"],
  overlayGradient: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(20,0,40,0.55) 50%, transparent 100%)",
  intro: { type: "flash", color: "#000000", duration: 12 },
};

// ── Registry ─────────────────────────────────────────────────────────────────
// Order matters only as a tie-breaker when scoring picks. Otherwise families
// are looked up by name.
export const FAMILIES: FamilyDefinition[] = [
  darkGold, warmAmber, roseElegant, boldEnergy, cleanPro,
  minimalistBw, tropical, luxuryNoir, modernTech, artisanWarm,
  urbanGraffiti, pastelSoft, vintageRetro, natureOrganic, glowNeon,
];

export const FAMILY_BY_NAME: Record<string, FamilyDefinition> = Object.fromEntries(
  FAMILIES.map((f) => [f.name, f])
);

// Default fallback when no family scores high enough — visually neutral and
// works for almost any business.
export const DEFAULT_FAMILY = cleanPro;
