/**
 * Layout: photo-full-text-bottom (legacy default).
 *
 * Mirrors the original SpecAd composition exactly — full-bleed photo,
 * gradient overlay, optional intro flash, content stack pinned at the
 * bottom with the spec's chosen alignment. Kept as a separate primitive
 * so it can be selected by `spec.layout.template` alongside the new
 * structural layouts.
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
import { ContentLayout } from "../ContentLayout";

const ALIGN_SELF: Record<"left" | "center" | "right", "flex-start" | "center" | "flex-end"> = {
  left:   "flex-start",
  center: "center",
  right:  "flex-end",
};

function safeTaglineEntry(entry: EntryAnimation): Exclude<EntryAnimation, "type-on"> {
  return entry === "type-on" ? "fade-up" : entry;
}

export interface LayoutProps {
  spec: AdSpec;
}

export const LayoutPhotoFullTextBottom: React.FC<LayoutProps> = ({ spec }) => (
  <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
    <PhotoBackground url={spec.photo.url} motion={spec.photo.motion} zoomTo={spec.photo.zoomTo} />
    <GradientOverlay gradient={spec.tokens.overlay} />
    {spec.intro && <EntryFlash color={spec.intro.color} duration={spec.intro.duration} />}

    <ContentLayout alignment={spec.layout.alignment} padding={spec.layout.padding}>
      <AccentLine
        color={spec.tokens.accentColor}
        width={spec.accentLine.width}
        height={spec.accentLine.height}
        delay={spec.accentLine.delay}
        position={spec.accentLine.position}
      />
      <Headline
        text={spec.headline.text}
        fontFamily={spec.tokens.fontFamily}
        fontSize={spec.headline.fontSize}
        fontWeight={spec.headline.fontWeight}
        fontStyle={spec.headline.fontStyle}
        textTransform={spec.headline.textTransform}
        letterSpacing={spec.headline.letterSpacing}
        color={spec.tokens.textColor}
        entry={spec.headline.entry}
        delay={spec.headline.delay}
        springConfig={spec.headline.springConfig}
      />
      {spec.tagline && (
        <Tagline
          text={spec.tagline.text}
          fontFamily={spec.tokens.fontFamily}
          fontSize={spec.tagline.fontSize}
          fontWeight={spec.tagline.fontWeight}
          fontStyle={spec.tagline.fontStyle}
          textTransform={spec.tagline.textTransform}
          letterSpacing={spec.tagline.letterSpacing}
          color={spec.tokens.textColor}
          entry={safeTaglineEntry(spec.tagline.entry)}
          delay={spec.tagline.delay}
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
        alignSelf={ALIGN_SELF[spec.layout.alignment]}
      />
    </ContentLayout>
  </AbsoluteFill>
);
