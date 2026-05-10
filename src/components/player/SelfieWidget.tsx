import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

// Rotating examples that animate behind the QR — gives the customer
// a hint of what they could become without committing to specific
// preview images that might not match what gpt-image-2 actually
// produces. Pure emoji = zero image deps.
const EXAMPLES = [
  { emoji: "🧸", label: "PELUCHE" },
  { emoji: "📦", label: "ACTION FIGURE" },
  { emoji: "🎨", label: "ANIME" },
  { emoji: "😂", label: "CARICATURA" },
  { emoji: "🗿", label: "ESTATUA" },
  { emoji: "🎬", label: "PÓSTER" },
  { emoji: "👾", label: "PIXEL" },
  { emoji: "🦸", label: "HÉROE" },
];

interface SelfieWidgetProps {
  screenId: string;
}

export default function SelfieWidget({ screenId }: SelfieWidgetProps) {
  const [exampleIdx, setExampleIdx] = useState(0);

  // Cycle examples every 1.2s — fast enough to feel alive on a TV
  // showing this widget for ~10s, slow enough that each example
  // registers as a distinct possibility.
  useEffect(() => {
    const id = setInterval(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLES.length);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  // The URL the QR points to. Lives at /selfie/:screenId — the
  // capture flow handles validation, style picking, etc. Using the
  // current origin means dev/staging/prod all work without config.
  const selfieUrl = `${window.location.origin}/selfie/${screenId}`;

  const example = EXAMPLES[exampleIdx];

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6"
      style={{
        background:
          "linear-gradient(135deg, #1e1b4b 0%, #581c87 50%, #831843 100%)",
      }}
    >
      {/* Animated emoji headline */}
      <div className="flex flex-col items-center">
        <div
          key={exampleIdx /* re-render to retrigger animation */}
          className="text-[18vw] leading-none animate-[fadeIn_0.5s_ease]"
          style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.5))" }}
          aria-hidden
        >
          {example.emoji}
        </div>
        <div
          key={`label-${exampleIdx}`}
          className="text-white/90 font-bold tracking-[0.4em] mt-2 animate-[fadeIn_0.5s_ease]"
          style={{ fontSize: "2.5vw" }}
        >
          {example.label}
        </div>
      </div>

      {/* Headline + QR */}
      <div className="flex items-center gap-8 mt-4">
        <div className="text-right">
          <p className="text-white font-extrabold leading-none" style={{ fontSize: "5vw" }}>
            ¡Sale en pantalla!
          </p>
          <p className="text-white/70 mt-3" style={{ fontSize: "1.8vw" }}>
            Escanea, toma una selfie
          </p>
          <p className="text-white/70" style={{ fontSize: "1.8vw" }}>
            y aparece aquí transformado
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-2xl">
          <QRCodeCanvas value={selfieUrl} size={180} />
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
