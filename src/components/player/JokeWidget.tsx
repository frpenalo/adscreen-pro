import { useState, useEffect } from "react";

interface Joke {
  setup: string;
  delivery: string;
}

// Module-level pool so jokes don't repeat between widget appearances
let jokePool: Joke[] = [];

async function fetchJokePool() {
  const lang = Math.random() > 0.5 ? "es" : "en";
  const res = await fetch(
    `https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart&lang=${lang}&amount=5`
  );
  const data = await res.json();
  const jokes = Array.isArray(data.jokes) ? data.jokes : [data];
  jokePool = jokes
    .filter((d: any) => d.type === "twopart")
    .map((d: any) => ({ setup: d.setup, delivery: d.delivery }));
}

async function nextJoke(): Promise<Joke | null> {
  if (jokePool.length === 0) await fetchJokePool();
  return jokePool.shift() ?? null;
}

export default function JokeWidget() {
  const [joke, setJoke] = useState<Joke | null>(null);
  const [showPunchline, setShowPunchline] = useState(false);
  const [error, setError] = useState(false);

  const loadNext = async () => {
    setShowPunchline(false);
    setJoke(null);
    try {
      const j = await nextJoke();
      if (j) setJoke(j);
      else setError(true);
    } catch {
      setError(true);
    }
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

      {error && (
        <div className="text-white/40 text-center tracking-widest uppercase text-2xl">
          Joke unavailable
        </div>
      )}

      {!joke && !error && (
        <div className="text-white/40 tracking-widest uppercase animate-pulse text-2xl">
          Loading...
        </div>
      )}

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
