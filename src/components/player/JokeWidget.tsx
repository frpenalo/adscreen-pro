import { useState, useEffect } from "react";
import { pickNextJoke, type LocalJoke } from "@/lib/jokes-es";

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
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-16"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      <div style={{ fontSize: "5vw" }}>😄</div>

      {joke && (
        <div className="text-center space-y-10 max-w-4xl">
          <p
            className="text-white font-light leading-tight"
            style={{ fontSize: "3.5vw" }}
          >
            {joke.setup}
          </p>
          <div
            className="transition-all duration-700"
            style={{ opacity: showPunchline ? 1 : 0 }}
          >
            <p
              className="text-yellow-300 font-semibold leading-tight"
              style={{ fontSize: "3.5vw" }}
            >
              {joke.delivery}
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
