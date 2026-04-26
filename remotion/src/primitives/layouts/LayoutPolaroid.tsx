/**
 * Layout: polaroid (handcrafted / framed photo).
 *
 * Photo sits in a Polaroid-style framed card centered in the upper
 * 60% of the canvas, with a decorative dark background filling the
 * rest. The text stack lives below the photo. Reads intimate,
 * artisanal, scrapbook-y.
 *
 * Strong fit for vintage-retro, artisan-warm, pastel-soft and
 * rose-elegant. Photo motion is constrained to subtle-zoom inside
 * the frame (no aggressive zoom — would feel jarring inside a
 * polaroid card).
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

export const LayoutPolaroid: React.FC<LayoutProps> = ({ spec }) => {
  const { width, height } = useVideoConfig();
  const isHorizontal = width >= height;

  // Photo card sized as a percentage of the canvas so it scales between
  // formats. Slightly taller-than-wide to evoke the actual Polaroid ratio.
  const cardW = isHorizontal ? width * 0.42 : width * 0.78;
  const cardH = isHorizontal ? height * 0.62 : height * 0.45;
  const cardPadding = 28;
  const cardLeft = (width - cardW) / 2;
  const cardTop = isHorizontal ? height * 0.10 : height * 0.08;

  // Headline scales DOWN — it sits below the prominent photo card.
  const headlineFontSize = Math.round(spec.headline.fontSize * 0.62);
  const taglineFontSize = Math.round((spec.tagline?.fontSize ?? 64) * 0.78);

  // Use the family's gradient as the page-background so the polaroid
  // floats over a coherent color even though the photo is windowed.
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a1a", overflow: "hidden" }}>
      <GradientOverlay gradient={spec.tokens.overlay} />

      {/* Polaroid card — outer white frame, inner photo window */}
      <div
        style={{
          position: "absolute",
          left: cardLeft,
          top: cardTop,
          width: cardW,
          height: cardH,
          backgroundColor: "#fafafa",
          padding: cardPadding,
          paddingBottom: cardPadding * 2.5, // classic polaroid bottom margin
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          // very subtle rotation (deterministic per format) gives a hand-placed
          // feel without making the layout look unstable.
          transform: isHorizontal ? "rotate(-1.2deg)" : "rotate(1deg)",
        }}
      >
        <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
          <PhotoBackground
            url={spec.photo.url}
            motion={spec.photo.motion === "zoom-in" ? "subtle-zoom" : spec.photo.motion}
            zoomTo={Math.min(spec.photo.zoomTo, 1.05)}
          />
        </div>
      </div>

      {/* Text stack below the polaroid */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          textAlign: "center",
          padding: isHorizontal ? "0 80px 60px" : "0 60px 100px",
        }}
      >
        <AccentLine
          color={spec.tokens.accentColor}
          width={spec.accentLine.width * 0.7}
          height={spec.accentLine.height}
          delay={spec.accentLine.delay}
          position="center"
          marginBottom={18}
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
          marginBottom={14}
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
            marginBottom={28}
          />
        )}
        <CTABox
          text={spec.cta.text}
          accentColor={spec.cta.accentColor}
          style={spec.cta.style}
          borderRadius={spec.cta.borderRadius}
          bgAlpha={spec.cta.bgAlpha}
          delay={spec.cta.delay}
          fontSize={Math.round(spec.cta.fontSize * 0.85)}
          alignSelf="center"
        />
      </AbsoluteFill>

      {spec.intro && <EntryFlash color={spec.intro.color} duration={spec.intro.duration} />}
    </AbsoluteFill>
  );
};
