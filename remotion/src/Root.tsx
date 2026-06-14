import "./index.css";
import { Composition } from "remotion";
import { AdvertiserAd } from "./AdvertiserAd";
import { SpecAd } from "./SpecAd";
import { SalesAdV3Outro } from "./SalesAdV3Outro";
import { TeaserOutro } from "./TeaserOutro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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

      {/* ── Spec-driven AdvertiserAd ── */}
      {/* Default props produce a Studio preview without arguments — */}
      {/* production renders pass an explicit `spec` from generateSpec(). */}
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

      {/* ── SalesAd v3 Outro — QR per-partner + invitación ── */}
      {/* Va DESPUÉS del clip de Gemini Omni (recorrido + 3 anuncios + texto */}
      {/* ya quemado por Omni). El build concatena clip Omni RAW + este outro */}
      {/* — sin overlay encima del video. 6s @ 30fps = 180 frames. */}
      <Composition
        id="SalesAdV3Outro"
        component={SalesAdV3Outro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          qrUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://adscreenpro.com",
          businessName: "Tu Barbería",
        }}
      />

      {/* ── Teaser Outro v2 (español) — cierre del teaser de Gemini Omni ── */}
      {/* Va DESPUÉS del clip de Omni (silla-trono + transformaciones). QR de */}
      {/* selfie per-partner. 6s @ 30fps = 180 frames. */}
      <Composition
        id="TeaserOutro"
        component={TeaserOutro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          qrUrl:
            "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://adscreenpro.com/selfie/demo",
        }}
      />
    </>
  );
};
