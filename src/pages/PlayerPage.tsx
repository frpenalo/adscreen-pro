import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Canvas en vez de SVG — Android WebView (Fully Kiosk) tiene
// problemas renderizando SVGs inline. El canvas es universal.
import { QRCodeCanvas } from "qrcode.react";
import ClockWidget from "@/components/player/ClockWidget";
import WeatherWidget from "@/components/player/WeatherWidget";
import JokeWidget from "@/components/player/JokeWidget";
import SportsWidget from "@/components/player/SportsWidget";
import NewsWidget from "@/components/player/NewsWidget";

interface Ad {
  id: string;
  type: "image" | "video";
  final_media_path: string;
  qr_url?: string | null;
  metadata?: any;
}

type WidgetType = "clock" | "weather" | "joke" | "sports" | "news";
const WIDGETS: WidgetType[] = ["clock", "weather", "joke", "sports", "news"];
const WIDGET_DURATION = 10000;
const IMAGE_DURATION = 10000;
const DEFAULT_WIDGET_FREQUENCY = 3;

// Cache key is per-screen to prevent bleed-over between partner TVs
// (e.g. QRs from a previously-viewed partner showing on a new panel).
const LEGACY_GLOBAL_CACHE_KEY = "adscreenpro-player-cache";
const cacheKeyFor = (screenId: string | undefined) =>
  `adscreenpro-player-cache:${screenId ?? "global"}`;

const loadCache = (screenId: string | undefined): Ad[] => {
  try {
    // One-time purge of the old global cache key (pre-fix).
    if (localStorage.getItem(LEGACY_GLOBAL_CACHE_KEY)) {
      localStorage.removeItem(LEGACY_GLOBAL_CACHE_KEY);
    }
    return JSON.parse(localStorage.getItem(cacheKeyFor(screenId)) ?? "[]");
  } catch { return []; }
};
const saveCache = (screenId: string | undefined, ads: Ad[]) => {
  try { localStorage.setItem(cacheKeyFor(screenId), JSON.stringify(ads)); } catch {}
};

// ── Offline emergency screen ──────────────────────────────────────────────────
const EMERGENCY_JOKES = [
  { setup: "¿Por qué los pájaros vuelan hacia el sur en invierno?", delivery: "¡Porque caminar sería demasiado lejos!" },
  { setup: "¿Qué le dice un semáforo a otro?", delivery: "¡No me mires, me estoy cambiando!" },
  { setup: "¿Por qué el libro de matemáticas estaba triste?", delivery: "¡Porque tenía demasiados problemas!" },
  { setup: "¿Qué hace una abeja en el gimnasio?", delivery: "¡Zum-ba!" },
  { setup: "¿Cómo se llama el campeón de buceo de Japón?", delivery: "Tokofondo." },
  { setup: "¿Qué le dijo el océano a la playa?", delivery: "Nada — solo saludó." },
  { setup: "¿Por qué los esqueletos no pelean entre ellos?", delivery: "¡Porque no tienen agallas!" },
];

function OfflineScreen() {
  const [idx, setIdx] = useState(0);
  const [showPunchline, setShowPunchline] = useState(false);
  const [visible, setVisible] = useState(true);
  const joke = EMERGENCY_JOKES[idx];

  useEffect(() => {
    // Show punchline after 6s, then advance to next joke after 12s
    const t1 = setTimeout(() => setShowPunchline(true), 6000);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % EMERGENCY_JOKES.length);
        setShowPunchline(false);
        setVisible(true);
      }, 600);
    }, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [idx]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-10 px-16"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      <div style={{ fontSize: "5vw" }}>😄</div>

      <div
        className="text-center space-y-10 max-w-4xl transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-white font-light leading-tight" style={{ fontSize: "3.5vw" }}>
          {joke.setup}
        </p>
        <div className="transition-all duration-700" style={{ opacity: showPunchline ? 1 : 0 }}>
          <p className="text-yellow-300 font-semibold leading-tight" style={{ fontSize: "3.5vw" }}>
            {joke.delivery}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-white/15 text-xs tracking-widest uppercase">
        AdScreenPro
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── AdFrame ───────────────────────────────────────────────────────────────────
// Renders a single ad (image or video) and, if the ad has a qr_url, overlays
// the QR INSIDE the content's bounding box — not the viewport. This keeps the
// QR anchored to the bottom-right of the media itself so designs with
// "escanea aquí" arrows pointing to a specific spot still line up even if the
// media aspect ratio doesn't match the screen (letterbox/pillarbox case).
interface AdFrameProps {
  ad: Ad;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onVideoEnded: () => void;
  onVideoError: () => void;
}

function AdFrame({ ad, videoRef, onVideoEnded, onVideoError }: AdFrameProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number; left: number; top: number } | null>(null);

  const compute = useCallback(() => {
    const wrap = wrapperRef.current;
    const media = mediaRef.current;
    if (!wrap || !media) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    // Natural media dimensions
    const nw = (media as HTMLImageElement).naturalWidth || (media as HTMLVideoElement).videoWidth || 0;
    const nh = (media as HTMLImageElement).naturalHeight || (media as HTMLVideoElement).videoHeight || 0;
    if (!nw || !nh || !cw || !ch) return;
    // object-contain: fit into wrapper while preserving aspect
    const scale = Math.min(cw / nw, ch / nh);
    const w = nw * scale;
    const h = nh * scale;
    const left = (cw - w) / 2;
    const top = (ch - h) / 2;
    setBox({ width: w, height: h, left, top });
  }, []);

  useEffect(() => {
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [compute, ad.id]);

  // QR placement — reads per-product overrides stored in ad.metadata.qr_x/y/size_pct
  // (set by admin via QrPositionPicker). Falls back to the legacy bottom-right
  // 12% placement so older ads without those fields keep rendering the same.
  const metaX = typeof ad.metadata?.qr_x === "number" ? ad.metadata.qr_x : null;
  const metaY = typeof ad.metadata?.qr_y === "number" ? ad.metadata.qr_y : null;
  const metaSize = typeof ad.metadata?.qr_size_pct === "number" ? ad.metadata.qr_size_pct : null;

  const sizePct = metaSize ?? 0.12;
  const qrSize = box ? Math.max(60, Math.min(320, Math.min(box.width, box.height) * sizePct)) : 120;
  const padding = box ? Math.max(8, qrSize * 0.06) : 12;

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      {ad.type === "image" ? (
        <img
          ref={(el) => { mediaRef.current = el; }}
          src={ad.final_media_path}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
          onLoad={compute}
        />
      ) : (
        <video
          ref={(el) => {
            mediaRef.current = el;
            if (videoRef) videoRef.current = el;
          }}
          src={ad.final_media_path}
          className="w-full h-full object-contain"
          preload="auto"
          muted
          playsInline
          onEnded={onVideoEnded}
          onError={onVideoError}
          onLoadedMetadata={compute}
        />
      )}

      {ad.qr_url && box && (() => {
        // If admin picked a position (metaX/metaY), center the QR box on that
        // fraction of the media. Otherwise use legacy bottom-right anchor.
        const boxSide = qrSize + padding * 2;
        let left: number;
        let top: number;
        if (metaX !== null && metaY !== null) {
          left = box.left + metaX * box.width - boxSide / 2;
          top = box.top + metaY * box.height - boxSide / 2;
          // Clamp to stay fully inside the media rect
          left = Math.max(box.left, Math.min(box.left + box.width - boxSide, left));
          top = Math.max(box.top, Math.min(box.top + box.height - boxSide, top));
        } else {
          left = box.left + box.width - boxSide;
          top = box.top + box.height - boxSide;
        }
        return (
          <div
            className="absolute bg-white rounded-lg shadow-lg"
            style={{ left, top, padding, zIndex: 10 }}
          >
            <QRCodeCanvas value={ad.qr_url} size={qrSize} />
          </div>
        );
      })()}
    </div>
  );
}

export default function PlayerPage() {
  const { screenId } = useParams<{ screenId?: string }>();
  const [ads, setAds] = useState<Ad[]>(() => loadCache(screenId));
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null); // crossfade: keeps old content visible
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeWidget, setActiveWidget] = useState<WidgetType | null>(null);
  const [widgetFrequency, setWidgetFrequency] = useState(DEFAULT_WIDGET_FREQUENCY);
  const [tick, setTick] = useState(0);
  const imageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Safety-net timer for videos: some kiosk browsers (Fully Kiosk on Android
  // WebView, certain Smart TV browsers) don't reliably fire `onEnded` after
  // an H.264 video finishes. Without this timer the carousel gets stuck on
  // the same ad forever. We force-advance after the video's known duration
  // (or a 15s fallback if the metadata isn't loaded yet).
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adsSinceWidgetRef = useRef(0);
  const widgetIndexRef = useRef(0);

  // Track online/offline status
  useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Explicit heartbeat — ping backend every 60s so Fleet Health can
  // distinguish "TV on, no ads" from "TV off". Independent from
  // ad_logs which only fire when there are ads to play.
  useEffect(() => {
    if (!screenId) return;
    const ping = () => {
      if (!navigator.onLine) return;
      supabase.rpc("ping_screen", { screen_id: screenId });
    };
    ping(); // immediate on mount
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [screenId]);

  // Auto-reload every 6h — prevents longevity bugs (memory leaks,
  // stale service worker, abandoned websockets, video decoder state).
  // Jittered by ±5 min to avoid a thundering-herd reload across the
  // whole fleet if many screens were opened at the same time.
  useEffect(() => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const jitter = Math.floor((Math.random() - 0.5) * 10 * 60 * 1000); // ±5 min
    const timeout = setTimeout(() => {
      window.location.reload();
    }, SIX_HOURS + jitter);
    return () => clearTimeout(timeout);
  }, []);

  const clearImageTimer = () => {
    if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
  };
  const clearWidgetTimer = () => {
    if (widgetTimerRef.current) clearTimeout(widgetTimerRef.current);
  };
  const clearVideoTimer = () => {
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
  };

  const logImpression = useCallback((ad: Ad) => {
    if (!ad || !online) return;
    supabase.from("ad_logs").insert({ ad_id: ad.id, location_id: screenId ?? "unknown" });
  }, [screenId, online]);

  const showNextWidget = useCallback(() => {
    const wType = WIDGETS[widgetIndexRef.current % WIDGETS.length];
    widgetIndexRef.current += 1;
    adsSinceWidgetRef.current = 0;
    setActiveWidget(wType);
    clearWidgetTimer();
    widgetTimerRef.current = setTimeout(() => setActiveWidget(null), WIDGET_DURATION);
  }, []);

  const next = useCallback(() => {
    if (ads[current]) logImpression(ads[current]);
    const nextIdx = (current + 1) % Math.max(ads.length, 1);
    setPrev(current);                          // keep current visible behind new content
    setCurrent(nextIdx);
    setTick((t) => t + 1);
    adsSinceWidgetRef.current += 1;
    if (adsSinceWidgetRef.current >= widgetFrequency) {
      showNextWidget();
    }
    // Clear prev after crossfade completes (300ms)
    if (prevTimerRef.current) clearTimeout(prevTimerRef.current);
    prevTimerRef.current = setTimeout(() => setPrev(null), 300);
  }, [ads, current, logImpression, widgetFrequency, showNextWidget]);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("widget_frequency")
      .eq("id", "singleton")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.widget_frequency) setWidgetFrequency(data.widget_frequency);
      });
  }, []);

  // No ads — cycle widgets continuously
  useEffect(() => {
    if (!loaded || ads.length > 0 || activeWidget) return;
    const t = setTimeout(showNextWidget, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ads.length, activeWidget]);

  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    const ad = ads[current];
    if (ad?.type === "image") {
      clearImageTimer();
      imageTimerRef.current = setTimeout(next, IMAGE_DURATION);
    }
    return clearImageTimer;
  }, [tick, current, loaded, ads, next, activeWidget]);

  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    const ad = ads[current];
    if (ad?.type === "video" && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.play().catch(() => next());

      // Safety-net: force-advance if onEnded never fires (Fully Kiosk /
      // Android WebView / Smart TV browser quirk). Use the video's own
      // duration + 2s buffer when available; otherwise 15s fallback.
      clearVideoTimer();
      const armTimer = () => {
        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 13;
        clearVideoTimer();
        videoTimerRef.current = setTimeout(next, (dur + 2) * 1000);
      };
      if (v.readyState >= 1 /* HAVE_METADATA */) {
        armTimer();
      } else {
        v.addEventListener("loadedmetadata", armTimer, { once: true });
      }
    }
    return clearVideoTimer;
    // `tick` is required so this effect re-fires when next() advances
    // from the only ad back to itself (current stays the same when
    // ads.length === 1). Without it, the video plays once and freezes.
  }, [tick, current, loaded, ads, next, activeWidget]);

  const fetchAds = useCallback(async () => {
    try {
      // Query 1: general ads (screen_id IS NULL).
      // By definition these are NOT tied to any specific partner, so we
      // strip any qr_url they may carry — only per-screen ads (query 2)
      // are allowed to render a partner QR overlay.
      const { data: generalAds, error: err1 } = await supabase
        .from("ads")
        .select("id, type, final_media_path, qr_url, metadata")
        .eq("status", "published")
        .is("screen_id" as any, null)
        .limit(50);
      if (err1) throw err1;

      // Query 2: local ads for this screen (only if screenId exists)
      let localAds: any[] = [];
      if (screenId) {
        const { data: local, error: err2 } = await supabase
          .from("ads")
          .select("id, type, final_media_path, qr_url, metadata")
          .eq("status", "published")
          .eq("screen_id" as any, screenId)
          .limit(10);
        if (!err2) localAds = local ?? [];
      }

      const generalList: Ad[] = (generalAds ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: null, // never render a partner QR on a non-scoped ad
        metadata: row.metadata ?? null,
      }));
      const localList: Ad[] = localAds.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: row.qr_url ?? null,
        metadata: row.metadata ?? null,
      }));
      const list: Ad[] = [...generalList, ...localList];
      setAds(list);
      saveCache(screenId, list);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [screenId]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  useEffect(() => {
    const channel = supabase
      .channel("player-ads")
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, () => fetchAds())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAds]);

  useEffect(() => {
    if (current >= ads.length && ads.length > 0) setCurrent(0);
  }, [ads.length, current]);

  // Offline + no cached ads → show emergency jokes screen
  if (!online && ads.length === 0) return <OfflineScreen />;

  if (loaded && ads.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white/20 text-6xl">📺</div>
        <p className="text-white/30 text-sm tracking-widest uppercase">AdScreenPro</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-white/20 text-sm tracking-widest uppercase animate-pulse">AdScreenPro</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Persistent background — keeps TV signal alive, prevents auto-off on black screen */}
      <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 100%)" }} />
      {/* Pixel activity element — 1px animated dot keeps signal active during transitions */}
      <div className="absolute bottom-0 left-0 z-0 w-px h-px animate-pulse" style={{ backgroundColor: "#111" }} />
      {/* Ads */}
      {ads.map((ad, index) => {
        const isActive = !activeWidget && index === current;
        const isPrev  = !activeWidget && index === prev;
        // Active: z=2 (on top, fades in). Prev: z=1 (stays visible underneath). Others: z=0 hidden.
        const zIdx   = isActive ? 2 : isPrev ? 1 : 0;
        const opacity = isActive ? 1 : isPrev ? 1 : 0;
        return (
        <div
          key={ad.id}
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity, zIndex: zIdx }}
        >
          <AdFrame
            ad={ad}
            videoRef={index === current ? videoRef : undefined}
            onVideoEnded={next}
            onVideoError={next}
          />
        </div>
        );
      })}

      {/* Widgets */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: activeWidget ? 1 : 0, zIndex: activeWidget ? 2 : 0 }}
      >
        {activeWidget === "clock"   && <ClockWidget />}
        {activeWidget === "weather" && <WeatherWidget />}
        {activeWidget === "joke"    && <JokeWidget />}
        {activeWidget === "sports"  && <SportsWidget />}
        {activeWidget === "news"    && <NewsWidget />}
      </div>

      {/* Watermark */}
      <div className="absolute bottom-3 right-4 z-10 pointer-events-none">
        <span className="text-white/15 text-xs tracking-widest uppercase select-none">AdScreenPro</span>
      </div>
    </div>
  );
}
