import { forwardRef } from "react";

interface BrandedCardProps {
  imageUrl: string;        // AI-transformed selfie URL
  name: string | null;     // Customer first name (optional)
  title: string | null;    // Dramatic title like "MAIN CHARACTER" (optional)
  businessName: string;    // Partner business name
  style: string;           // Style ID (peluche, anime, etc) — drives accent color
}

// Style-specific accent colors. Picked to complement the look of each
// AI-generated style without competing with it. Used for the bottom
// strip + title text glow on the card.
const STYLE_THEMES: Record<string, { from: string; to: string; accent: string }> = {
  peluche:         { from: "#f9a8d4", to: "#fbcfe8", accent: "#be185d" },
  "action-figure": { from: "#fb923c", to: "#fbbf24", accent: "#ea580c" },
  anime:           { from: "#a78bfa", to: "#22d3ee", accent: "#7c3aed" },
  caricatura:      { from: "#facc15", to: "#fb923c", accent: "#ca8a04" },
  estatua:         { from: "#cbd5e1", to: "#e2e8f0", accent: "#475569" },
  poster:          { from: "#fbbf24", to: "#ef4444", accent: "#b91c1c" },
  "pixel-art":     { from: "#22d3ee", to: "#a78bfa", accent: "#06b6d4" },
  superheroe:      { from: "#3b82f6", to: "#ef4444", accent: "#1d4ed8" },
  "trading-card":  { from: "#fbbf24", to: "#a78bfa", accent: "#7c3aed" },
  wanted:          { from: "#a16207", to: "#451a03", accent: "#78350f" },
};

const DEFAULT_THEME = { from: "#a78bfa", to: "#ec4899", accent: "#7c3aed" };

/**
 * The 9:16 vertical card the customer downloads/shares.
 *
 * Designed to be rendered HIDDEN in the DOM (off-screen) so
 * html-to-image can rasterize it into a PNG for download/share.
 * The visible "preview" on the result screen is a CSS-scaled
 * version of this same component — single source of truth, the
 * downloaded PNG matches what the customer sees on screen.
 *
 * Dimensions: 1080x1920 (Instagram Stories / Reels / TikTok native).
 *
 * Uses forwardRef so the parent can pass the ref to html-to-image.
 */
export const BrandedCard = forwardRef<HTMLDivElement, BrandedCardProps>(
  ({ imageUrl, name, title, businessName, style }, ref) => {
    const theme = STYLE_THEMES[style] ?? DEFAULT_THEME;
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: "#000",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Hero image — fills the upper 75% with full-bleed AI photo */}
        <img
          src={imageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "75%",
            objectFit: "cover",
          }}
        />

        {/* Bottom gradient overlay — fades the photo bottom into the
            text strip cleanly so no harsh hairline cut */}
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: 0,
            right: 0,
            height: "20%",
            background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 100%)`,
          }}
        />

        {/* Bottom info strip */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "30%",
            background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
            padding: "60px 80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Name + title block */}
          <div>
            {name && (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: 900,
                  color: "#fff",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  textShadow: "0 4px 24px rgba(0,0,0,0.4)",
                }}
              >
                {name}
              </div>
            )}
            {title && (
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 800,
                  color: "#fff",
                  marginTop: 16,
                  letterSpacing: "0.08em",
                  textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                  opacity: 0.95,
                }}
              >
                {title}
              </div>
            )}
          </div>

          {/* Footer: partner + watermark */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  marginBottom: 6,
                }}
              >
                Captured at
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                {businessName}
              </div>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.3em",
                textAlign: "right",
              }}
            >
              Made with
              <br />
              <span style={{ color: "#fff", fontSize: 24 }}>AdScreenPro</span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

BrandedCard.displayName = "BrandedCard";
