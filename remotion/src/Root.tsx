import "./index.css";
import { Composition } from "remotion";
import { SalesAd } from "./SalesAd";

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
          headline: "¿Quieres que tus clientes\nte vean aquí?",
          subtitle: "Anúnciate en esta pantalla",
          cta: "Escanea y reserva tu espacio",
          qrUrl: "",
          accentColor: "#7C3AED",
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
          headline: "¿Quieres que tus clientes\nte vean aquí?",
          subtitle: "Anúnciate en esta pantalla",
          cta: "Escanea y reserva tu espacio",
          qrUrl: "",
          accentColor: "#7C3AED",
        }}
      />
    </>
  );
};
