/**
 * Layout: split-vertical (50/50 editorial split).
 *
 * Horizontal format: photo on the left half, text panel on the right.
 * Vertical format: photo on the top half, text panel on the bottom
 * (the "vertical" in the name refers to the line that splits the
 * frame into two halves — orientation-aware).
 *
 * The text panel uses the family's overlay gradient as a solid-ish
 * background so colors stay coherent. Reads more editorial / corporate.
 * Strong for tech, real-estate, clean-pro, modern-tech.
 */

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
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

export interface LayoutProps {
  spec: AdSpec;
}

export const LayoutSplitVertical: React.FC<LayoutProps> = ({ spec }) => {
  const { width, height } = useVideoConfig();
  const isHorizontal = width >= height;

  // The photo takes one half; the text takes the other. We render the
  // photo as a full AbsoluteFill INSIDE a clipped container so the
  // existing PhotoBackground (full-bleed transform/scale) keeps working
  // — its motion just applies inside the half-screen viewport.
  const photoStyle: React.CSSProperties = isHorizontal
    ? { position: "absolute", inset: 0, width: "50%", height: "100%", overflow: "hidden" }
    : { position: "absolute", inset: 0, width: "100%", height: "50%", overflow: "hidden" };

  const textPanelStyle: React.CSSProperties = isHorizontal
    ? { position: "absolute", top: 0, right: 0, width: "50%", height: "100%" }
    : { position: "absolute", left: 0, bottom: 0, width: "100%", height: "50%" };

  // Headline scales down slightly because the text now lives in half the width.
  const headlineFontSize = Math.round(spec.headline.fontSize * 0.78);
  const taglineFontSize = Math.round((spec.tagline?.fontSize ?? 64) * 0.85);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", overflow: "hidden" }}>
      {/* ── Photo half ── */}
      <div style={photoStyle}>
        <PhotoBackground url={spec.photo.url} motion={spec.photo.motion} zoomTo={spec.photo.zoomTo} />
      </div>

      {/* ── Text half (with the family's gradient as the panel background) ── */}
      <div style={textPanelStyle}>
        <GradientOverlay gradient={spec.tokens.overlay} />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: isHorizontal ? "80px 70px" : "70px 80px",
          }}
        >
          <AccentLine
            color={spec.tokens.accentColor}
            width={spec.accentLine.width * 0.85}
            height={spec.accentLine.height}
            delay={spec.accentLine.delay}
            position="left"
            marginBottom={20}
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
            marginBottom={20}
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
              marginBottom={40}
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
            alignSelf="flex-start"
          />
        </AbsoluteFill>
      </div>

      {spec.intro && <EntryFlash color={spec.intro.color} duration={spec.intro.duration} />}
    </AbsoluteFill>
  );
};
