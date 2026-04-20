import { useState, useEffect } from "react";

interface NewsItem {
  title: string;
  pubDate: string;
  source?: string;
}

// ── Module-level state (persists across mount/unmount) ──────────────────────
// PlayerPage mounts NewsWidget for ~10s then unmounts. If slide index lived
// in component state it would reset to 0 every time — same bug SportsWidget
// had. Persist the index at module scope so each appearance advances.
let slidesCache: NewsItem[][] = [];
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let globalSlideIndex = 0;
let fetchInFlight: Promise<NewsItem[][]> | null = null;

function chunkPairs<T>(arr: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) pairs.push(arr.slice(i, i + 2));
  return pairs;
}

async function fetchNews(): Promise<NewsItem[][]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/fetch-news?lang=es&_t=${Date.now()}`, {
    headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("fetch-news failed");
  const data = await res.json();
  const items: NewsItem[] = data.items ?? [];
  return chunkPairs(items);
}

async function getSlides(): Promise<NewsItem[][]> {
  const fresh = Date.now() - cacheTime < CACHE_TTL && slidesCache.length > 0;
  if (fresh) return slidesCache;
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = fetchNews()
    .then((s) => {
      if (s.length > 0) {
        slidesCache = s;
        cacheTime = Date.now();
      }
      fetchInFlight = null;
      return s;
    })
    .catch((err) => {
      fetchInFlight = null;
      throw err;
    });
  return fetchInFlight;
}

export default function NewsWidget() {
  const [slides, setSlides] = useState<NewsItem[][]>(slidesCache);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSlides()
      .then((s) => {
        if (cancelled) return;
        setSlides(s);
        if (s.length > 0) {
          const idx = globalSlideIndex % s.length;
          globalSlideIndex = (globalSlideIndex + 1) % s.length;
          setCurrent(idx);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const slide = slides[current];

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-10 px-16"
      style={{ background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span style={{ fontSize: "3.5vw" }}>📰</span>
        <div>
          <div className="text-white font-semibold tracking-widest uppercase" style={{ fontSize: "1.8vw" }}>
            Noticias
          </div>
          <div className="text-white/40 tracking-widest uppercase" style={{ fontSize: "1.1vw" }}>
            Hoy
          </div>
        </div>
      </div>

      {/* Content */}
      {error && (
        <p className="text-white/40 tracking-widest uppercase" style={{ fontSize: "2vw" }}>
          Noticias no disponibles
        </p>
      )}

      {!error && slides.length === 0 && (
        <p className="text-white/40 tracking-widest uppercase animate-pulse" style={{ fontSize: "2vw" }}>
          Cargando...
        </p>
      )}

      {!error && slide && (
        <div className="w-full max-w-5xl space-y-6">
          {slide.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-3 flex-shrink-0" />
              <div>
                <p className="text-white font-light leading-snug" style={{ fontSize: "2.6vw" }}>
                  {item.title}
                </p>
                {(item.pubDate || item.source) && (
                  <p className="text-white/30 mt-1 tracking-widest" style={{ fontSize: "1.2vw" }}>
                    {[item.pubDate, item.source].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide counter (diagnostic) */}
      {!error && slides.length > 0 && (
        <div className="absolute bottom-4 left-4 text-white/30 text-xs tracking-widest tabular-nums">
          {current + 1} / {slides.length}
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
