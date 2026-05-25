import "./index.css";
import { Composition } from "remotion";
import { SalesAd } from "./SalesAd";
import { AdvertiserAd } from "./AdvertiserAd";
import { SpecAd } from "./SpecAd";
import { AwakeningOutro } from "./AwakeningOutro";

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

      {/* ── Awakening Outro (Segment D del teaser cinemático) ── */}
      {/* 1920x1080, 24fps, 6s. fps matchea Kling output (24fps) para  */}
      {/* evitar re-interpolación al stitching. Duración larga (6s) para */}
      {/* que el QR esté visible y estable ~4s — suficiente para escanear */}
      {/* desde un teléfono. defaultProps usa un QR demo para preview en  */}
      {/* Studio; producción siempre pasa el qrUrl real per-partner.      */}
      <Composition
        id="AwakeningOutro"
        component={AwakeningOutro}
        durationInFrames={144}
        fps={24}
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
