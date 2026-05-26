import "./index.css";
import { Composition } from "remotion";
import { SalesAd } from "./SalesAd";
import { AdvertiserAd } from "./AdvertiserAd";
import { SpecAd } from "./SpecAd";
import { AwakeningOutro } from "./AwakeningOutro";
import { SalesAdV2 } from "./SalesAdV2";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1920x1080 horizontal — para TVs landscape */}
      <Composition
        id="SalesAdHorizontal"
        component={SalesAd}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          headline: "ANÚNCIATE",
          subtitle: "EN ESTA PANTALLA",
          cta: "Escanea el código",
          qrUrl: "",
        }}
      />

      {/* 1080x1920 vertical — para TVs portrait */}
      <Composition
        id="SalesAdVertical"
        component={SalesAd}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "ANÚNCIATE",
          subtitle: "EN ESTA PANTALLA",
          cta: "Escanea el código",
          qrUrl: "",
        }}
      />

      {/* Advertiser animated ad — 1920x1080, 10s @ 30fps */}
      <Composition
        id="AdvertiserAd"
        component={AdvertiserAd}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          photoUrl: "",
          businessName: "Mi Negocio",
          tagline: "El mejor servicio de la ciudad",
          cta: "Visítanos",
          adStyle: "dark-gold",
        }}
      />

      {/* ── Spec-driven AdvertiserAd (Phase 3 of migration) ── */}
      {/* Lives alongside the legacy AdvertiserAd above. The render */}
      {/* script can target either composition until A/B testing in   */}
      {/* Phase 5 confirms parity. Default props produce a Studio    */}
      {/* preview without arguments — production renders pass an    */}
      {/* explicit `spec` from generateSpec(). */}
      <Composition
        id="SpecAdHorizontal"
        component={SpecAd}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="SpecAdVertical"
        component={SpecAd}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* ── SalesAd v2 — Kling clip + per-partner QR overlay ── */}
      {/* 1920x1080, 24fps, 10s = 240 frames. Match exacto del Kling clip   */}
      {/* (que debe estar en remotion/public/sales-ad-clip.mp4). El Video    */}
      {/* component lo carga via staticFile. Per-partner: el QR (data URL)  */}
      {/* y el businessName vienen via inputProps del build script.         */}
      <Composition
        id="SalesAdV2"
        component={SalesAdV2}
        durationInFrames={240}
        fps={24}
        width={1920}
        height={1080}
        defaultProps={{
          klingClipPath: "sales-ad-clip.mp4",
          qrUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://adscreenpro.com",
          businessName: "Tu Barbería",
        }}
      />

      {/* ── Awakening Outro (Segment D del teaser cinemático) ── */}
      {/* 1920x1080, 30fps, 6s = 180 frames. fps matchea exacto el de    */}
      {/* SalesAd (que SÍ funciona en TV de Softmedia). Cambiado de 24fps */}
      {/* porque el concat de 24fps (Kling) → 30fps confunde algunos     */}
      {/* hardware decoders. El concat ffmpeg unifica todo a 30fps al    */}
      {/* re-encodear. Animaciones del outro se ajustan automáticamente  */}
      {/* porque usan spring/interpolate de Remotion (frame-rate aware). */}
      <Composition
        id="AwakeningOutro"
        component={AwakeningOutro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          qrUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://adscreenpro.com",
        }}
      />
    </>
  );
};
