/**
 * Layout: photo-overlay-text-center (cinematic / movie-poster).
 *
 * Photo fills the frame with a stronger gradient overlay so the entire
 * canvas reads as a darker / moodier surface. The text stack is pulled
 * to the visual center — both vertically and horizontally — with a
 * larger headline. Reads like a movie poster or hero ad.
 *
 * Best for high-contrast, dramatic categories: luxury, gym, nightclub,
 * urban, glow-neon. The accent line still anchors above the headline
 * but at center alignment regardless of the spec's linePosition.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import type { AdSpec, EntryAnimation } from "../../specs";
import { PhotoBackground } from "../PhotoBackground";
import { GradientOverlay } from "../GradientOverlay";
import { EntryFlash } from "../EntryFlash";
import { AccentLine } from "../AccentLine";
import { Headline } from "../Headline";
import { Tagline } from "../Tagline";
import { CTABox } from "../CTABox";

function safeTaglineEntry(entry: EntryAnimation): Exclude<EntryAnimation, "type-on"> {
  return entry === "type-on" ? "fade-up" : entry;
}

// A heavier overlay so the centered text reads cleanly even on busy
// photos. Layered on top of the family's own gradient (which still
// applies for color personality).
const HEAVY_OVERLAY =
  "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 30%, rgba(0,0,0,0.20) 70%, rgba(0,0,0,0.55) 100%)";

export interface LayoutProps {
  spec: AdSpec;
}

export const LayoutPhotoOverlayTextCenter: React.FC<LayoutProps> = ({ spec }) => {
  // Cinematic layout uses a slightly larger headline than the default —
  // the surrounding negative space allows the type to breathe.
  const headlineFontSize = Math.round(spec.headline.fontSize * 1.15);
  const taglineFontSize = Math.round((spec.tagline?.fontSize ?? 64) * 0.95);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <PhotoBackground url={spec.photo.url} motion={spec.photo.motion} zoomTo={spec.photo.zoomTo} />
      <GradientOverlay gradient={spec.tokens.overlay} />
      {/* extra dark wash for legibility of centered text */}
      <GradientOverlay gradient={HEAVY_OVERLAY} />
      {spec.intro && <EntryFlash color={spec.intro.color} duration={spec.intro.duration} />}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "60px",
        }}
      >
        <AccentLine
          color={spec.tokens.accentColor}
          width={spec.accentLine.width * 0.8}
          height={spec.accentLine.height}
          delay={spec.accentLine.delay}
          position="center"
          marginBottom={32}
        />
        <Headline
          text={spec.headline.text}
          fontFamily={spec.tokens.fontFamily}
          fontSize={headlineFontSize}
          fontWeight={spec.headline.fontWeight}
          fontStyle={spec.headline.fontStyle}
          textTransform={spec.headline.textTransform}
          letterSpacing={spec.headline.letterSpacing}
          color={spec.tokens.textColor}
          entry={spec.headline.entry}
          delay={spec.headline.delay}
          springConfig={spec.headline.springConfig}
          marginBottom={28}
        />
        {spec.tagline && (
          <Tagline
            text={spec.tagline.text}
            fontFamily={spec.tokens.fontFamily}
            fontSize={taglineFontSize}
            fontWeight={spec.tagline.fontWeight}
            fontStyle={spec.tagline.fontStyle}
            textTransform={spec.tagline.textTransform}
            letterSpacing={spec.tagline.letterSpacing}
            color={spec.tokens.textColor}
            entry={safeTaglineEntry(spec.tagline.entry)}
            delay={spec.tagline.delay}
            marginBottom={48}
          />
        )}
        <CTABox
          text={spec.cta.text}
          accentColor={spec.cta.accentColor}
          style={spec.cta.style}
          borderRadius={spec.cta.borderRadius}
          bgAlpha={spec.cta.bgAlpha}
          delay={spec.cta.delay}
          fontSize={spec.cta.fontSize}
          alignSelf="center"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
