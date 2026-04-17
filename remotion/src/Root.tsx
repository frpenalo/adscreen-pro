import "./index.css";
import { Composition } from "remotion";
import { SalesAd } from "./SalesAd";
import { AdvertiserAd } from "./AdvertiserAd";

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
    </>
  );
};
