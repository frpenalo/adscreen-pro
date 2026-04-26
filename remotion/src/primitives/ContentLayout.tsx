/**
 * ContentLayout — bottom-aligned content area for AdvertiserAd-style
 * compositions. Stacks children with the chosen horizontal alignment
 * and applies the spec-driven padding (which differs between
 * horizontal and vertical formats).
 *
 * The accent line, headline, tagline and CTA are children of this
 * wrapper. Each child controls its own bottom margin so this
 * primitive stays purely structural.
 */

import React from "react";
import { AbsoluteFill } from "remotion";

export interface ContentLayoutProps {
  alignment: "left" | "center" | "right";
  padding: string;
  children: React.ReactNode;
  textAlign?: "left" | "center" | "right";
}

const ITEM_ALIGN: Record<string, "flex-start" | "center" | "flex-end"> = {
  left:   "flex-start",
  center: "center",
  right:  "flex-end",
};

export const ContentLayout: React.FC<ContentLayoutProps> = ({
  alignment,
  padding,
  children,
  textAlign,
}) => (
  <AbsoluteFill
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      alignItems: ITEM_ALIGN[alignment],
      padding,
      textAlign: textAlign ?? alignment,
    }}
  >
    {children}
  </AbsoluteFill>
);
