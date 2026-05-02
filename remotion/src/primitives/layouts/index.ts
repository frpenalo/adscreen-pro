/**
 * Layout primitives — public surface.
 *
 * Each layout consumes a full AdSpec and renders the entire ad inside
 * its own structural template. The SpecAd composition picks the right
 * one by reading `spec.layout.template`.
 */

export { LayoutPhotoFullTextBottom } from "./LayoutPhotoFullTextBottom";
export { LayoutPhotoOverlayTextCenter } from "./LayoutPhotoOverlayTextCenter";
export { LayoutSplitVertical } from "./LayoutSplitVertical";
export { LayoutPolaroid } from "./LayoutPolaroid";
export type { LayoutProps } from "./LayoutPhotoFullTextBottom";
