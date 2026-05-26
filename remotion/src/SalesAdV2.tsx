import React from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── SalesAd v2 — Kling clip + text overlay + per-partner QR ─────────────────
//
// Reemplaza al SalesAd original (text-heavy Remotion solo) por una versión
// cinemática que combina:
//   - Background: clip de Kling (10s, escena de barbería con clientes mirando
//     una TV, camera dolly-in hasta que la pantalla llena el frame)
//   - Overlay temprano (2-5s): texto sutil "ESTA PANTALLA TIENE OJOS"
//   - Overlay reveal (5-10s): texto grande "ANÚNCIATE AQUÍ" + QR per-partner
//
// El Kling clip debe estar en remotion/public/sales-ad-clip.mp4 (cargado
// via staticFile). El build script lo deja ahí. Si más adelante queremos
// soportar múltiples clips, el klingClipPath puede ser parametrizable.
//
// Mismo pipeline de encoding que el Awakening teaser (que ya funciona en
// Fully Kiosk): Baseline + AAC silente + BT.709 + 30fps post-encode.
//
// Duración: 240 frames @ 24fps = 10s.
//
// Timeline:
//   0-48f    (0-2s):   Kling solo, sin texto. Que el viewer vea la escena.
//   48-120f  (2-5s):   Overlay sutil: "ESTA PANTALLA TIENE OJOS" arriba,
//                       "y muchas más en tu ciudad" abajo.
//   120-144f (5-6s):   Fade out de subtle, fade in de reveal H1.
//   144-180f (6-7.5s): Subtitle "y en otras pantallas..." y business name
//                       aparecen.
//   180-240f (7.5-10s): QR scale-in y todo estable hasta el final
//                       (2.5s ventana mínima de scan).

const AMBER = "#fbbf24";
const FUCHSIA = "#ec4899";
const CREAM = "#fef3c7";

interface SalesAdV2Props {
  /** Filename del Kling clip en remotion/public/ (ej: "sales-ad-clip.mp4"). */
  klingClipPath: string;
  /** Data URL del QR PNG (base64). Per-partner — apunta a la URL referral. */
  qrUrl: string;
  /** Nombre del negocio del partner (aparece en el reveal). */
  businessName: string;
}

export const SalesAdV2: React.FC<SalesAdV2Props> = ({
  klingClipPath,
  qrUrl,
  businessName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Fase 1: subtle headline durante el build-up (48-120 = 2-5s) ─────────
  const T_SUBTLE_IN = 48;
  const T_SUBTLE_OUT = 120;
  const subtleInProgress = interpolate(
    frame,
    [T_SUBTLE_IN, T_SUBTLE_IN + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtleOutProgress = interpolate(
    frame,
    [T_SUBTLE_OUT, T_SUBTLE_OUT + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtleOpacity = subtleInProgress * (1 - subtleOutProgress);
  const subtleY = interpolate(subtleInProgress, [0, 1], [12, 0]);

  // ─── Fase 2: reveal big text "ANÚNCIATE AQUÍ" (desde frame 132) ──────────
  const T_REVEAL_H1 = 132;
  const revealH1Progress = spring({
    frame: frame - T_REVEAL_H1,
    fps,
    config: { damping: 14, stiffness: 95 },
  });
  const revealH1Opacity = interpolate(revealH1Progress, [0, 1], [0, 1]);
  const revealH1Y = interpolate(revealH1Progress, [0, 1], [40, 0]);
  const revealH1Scale = interpolate(revealH1Progress, [0, 1], [0.85, 1]);

  // ─── Fase 3: subtitle "y en otras pantallas..." (desde frame 156) ────────
  const T_REVEAL_H2 = 156;
  const revealH2Progress = spring({
    frame: frame - T_REVEAL_H2,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const revealH2Opacity = interpolate(revealH2Progress, [0, 1], [0, 1]);
  const revealH2Y = interpolate(revealH2Progress, [0, 1], [20, 0]);

  // ─── Fase 4: QR scale-in (desde frame 180) ──────────────────────────────
  const T_QR = 180;
  const qrProgress = spring({
    frame: frame - T_QR,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const qrOpacity = interpolate(qrProgress, [0, 1], [0, 1]);
  const qrScale = interpolate(qrProgress, [0, 1], [0.7, 1]);
  // Pulse continuo sutil después del scale-in para invitar el escaneo.
  const qrPulse = 1 + Math.sin((frame - T_QR) * 0.12) * 0.015;

  // ─── Fase 5: business name + CTA bottom (desde frame 198) ────────────────
  const T_FOOTER = 198;
  const footerProgress = interpolate(
    frame,
    [T_FOOTER, T_FOOTER + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const footerOpacity = footerProgress;

  // ─── Overlay dark gradient durante el reveal — mejora contraste del texto
  // sobre el warm glow de Kling. Empieza sutil al frame 120, intensifica.
  const T_OVERLAY = 120;
  const overlayOpacity = interpolate(
    frame,
    [T_OVERLAY, T_OVERLAY + 36],
    [0, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── QR size: 360px (más grande que el del Awakening, este es la
  //     conversion principal del SalesAd).
  const QR_SIZE = 360;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* ── Background: Kling clip ────────────────────────────────────── */}
      <AbsoluteFill>
        <Video
          src={staticFile(klingClipPath)}
          // muted porque el SalesAd va en TVs muteadas; native audio off en
          // el Kling clip también. El render final agrega AAC silente.
          muted
          // No loop — el clip es exactamente 10s y la composition también.
        />
      </AbsoluteFill>

      {/* ── Dark gradient overlay para contraste del texto reveal ───── */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.5) 100%)",
          opacity: overlayOpacity,
        }}
      />

      {/* ── Fase 1: subtle headline (build-up 2-5s) ─────────────────── */}
      <AbsoluteFill
        style={{
          opacity: subtleOpacity,
          transform: `translateY(${subtleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "100px 80px",
          pointerEvents: "none",
        }}
      >
        {/* Headline top */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#fff",
            textShadow: "0 4px 30px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)",
            textAlign: "center",
          }}
        >
          Esta pantalla tiene ojos
        </div>

        {/* Subtitle bottom */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 34,
            fontWeight: 400,
            letterSpacing: "0.2em",
            color: CREAM,
            textShadow: "0 2px 20px rgba(0,0,0,0.9)",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          y muchas más en tu ciudad
        </div>
      </AbsoluteFill>

      {/* ── Fase 2-5: Reveal con H1, H2, QR, footer (5-10s) ─────────── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          pointerEvents: "none",
        }}
      >
        {/* H1: "ANÚNCIATE AQUÍ" */}
        <div
          style={{
            opacity: revealH1Opacity,
            transform: `translateY(${revealH1Y}px) scale(${revealH1Scale})`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
            color: "#fff",
            textShadow: `0 0 60px ${AMBER}99, 0 0 30px ${FUCHSIA}66, 0 6px 24px rgba(0,0,0,0.8)`,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Anúnciate Aquí
        </div>

        {/* H2: "y en otras pantallas alrededor de la ciudad"
            Texto OSCURO con peso 700 y stroke blanco para garantizar
            legibilidad sobre el fondo cream/warm del Kling final frame.
            Antes era CREAM (#fef3c7) que sobre cream = invisible. */}
        <div
          style={{
            opacity: revealH2Opacity,
            transform: `translateY(${revealH2Y}px)`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#1a0a0a",
            textShadow:
              "0 0 8px rgba(255,255,255,0.95), 0 0 16px rgba(255,255,255,0.85), 0 2px 4px rgba(0,0,0,0.4)",
            textAlign: "center",
            marginBottom: 40,
            maxWidth: "70%",
          }}
        >
          y en otras pantallas alrededor de la ciudad
        </div>

        {/* QR centrado en card blanca con corners decorativos */}
        <div
          style={{
            opacity: qrOpacity,
            transform: `scale(${qrScale * qrPulse})`,
            position: "relative",
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            boxShadow: `0 0 80px ${AMBER}77, 0 0 40px ${FUCHSIA}44, 0 8px 32px rgba(0,0,0,0.6)`,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: QR_SIZE,
              height: QR_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {qrUrl ? (
              <Img
                src={qrUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#ddd",
                }}
              />
            )}
          </div>
          {/* Corners targeting (igual estética que el Awakening) */}
          {[
            { top: -3, left: -3, borderTop: 3, borderLeft: 3 },
            { top: -3, right: -3, borderTop: 3, borderRight: 3 },
            { bottom: -3, left: -3, borderBottom: 3, borderLeft: 3 },
            { bottom: -3, right: -3, borderBottom: 3, borderRight: 3 },
          ].map((s, i) => {
            const { top, left, right, bottom, ...borders } = s as any;
            const borderStyle: React.CSSProperties = {};
            if (borders.borderTop)
              borderStyle.borderTop = `${borders.borderTop}px solid ${AMBER}`;
            if (borders.borderLeft)
              borderStyle.borderLeft = `${borders.borderLeft}px solid ${AMBER}`;
            if (borders.borderRight)
              borderStyle.borderRight = `${borders.borderRight}px solid ${AMBER}`;
            if (borders.borderBottom)
              borderStyle.borderBottom = `${borders.borderBottom}px solid ${AMBER}`;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 28,
                  height: 28,
                  top,
                  left,
                  right,
                  bottom,
                  ...borderStyle,
                }}
              />
            );
          })}
        </div>

        {/* Footer: business name + CTA pequeño
            Texto oscuro con stroke blanco igual que el H2 — garantiza
            legibilidad sobre el fondo cream/warm del frame final del
            Kling. Antes eran CREAM/white = invisibles. */}
        <div
          style={{
            opacity: footerOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: "#1a0a0a",
              textShadow:
                "0 0 6px rgba(255,255,255,0.95), 0 0 12px rgba(255,255,255,0.85), 0 2px 3px rgba(0,0,0,0.4)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            en {businessName}
          </div>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#1a0a0a",
              textShadow:
                "0 0 5px rgba(255,255,255,0.95), 0 0 10px rgba(255,255,255,0.85)",
              textTransform: "uppercase",
            }}
          >
            Escanea con tu teléfono
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
