import { useState, useEffect } from "react";
import { pickNextJoke, type LocalJoke } from "@/lib/jokes-es";
import { JokeBackground } from "./JokeBackground";

export default function JokeWidget() {
  const [joke, setJoke] = useState<LocalJoke | null>(null);
  const [showPunchline, setShowPunchline] = useState(false);

  const loadNext = () => {
    setShowPunchline(false);
    setJoke(pickNextJoke());
  };

  // Load first joke on mount
  useEffect(() => { loadNext(); }, []);

  // Rotate to next joke every 25 seconds
  useEffect(() => {
    const id = setInterval(() => loadNext(), 25000);
    return () => clearInterval(id);
  }, []);

  // Reveal punchline after 7 seconds
  useEffect(() => {
    if (!joke) return;
    setShowPunchline(false);
    const t = setTimeout(() => setShowPunchline(true), 7000);
    return () => clearTimeout(t);
  }, [joke]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background animado: warm gradient + blobs + confetti + sparkles */}
      <JokeBackground />

      {/* Contenido principal — emoji + setup + punchline */}
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-8 px-16">
        <div
          style={{
            fontSize: "5vw",
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))",
          }}
        >
          😄
        </div>

        {joke && (
          <div
            className="text-center space-y-10 max-w-4xl rounded-3xl px-12 py-10"
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <p
              className="text-white font-light leading-tight"
              style={{
                fontSize: "3.5vw",
                textShadow:
                  "0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)",
              }}
            >
              {joke.setup}
            </p>
            <div
              className="transition-all duration-700"
              style={{ opacity: showPunchline ? 1 : 0 }}
            >
              <p
                className="font-semibold leading-tight"
                style={{
                  fontSize: "3.5vw",
                  color: "#fde047",
                  textShadow:
                    "0 2px 16px rgba(0,0,0,0.95), 0 0 30px rgba(253,224,71,0.4)",
                }}
              >
                {joke.delivery}
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-4 right-4 text-white/40 text-xs tracking-widest uppercase"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
      >
        AdScreenPro
      </div>
    </div>
  );
}
