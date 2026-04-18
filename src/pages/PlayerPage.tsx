import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import ProductAdSlide from "@/components/player/ProductAdSlide";
import ClockWidget from "@/components/player/ClockWidget";
import WeatherWidget from "@/components/player/WeatherWidget";
import JokeWidget from "@/components/player/JokeWidget";
import SportsWidget from "@/components/player/SportsWidget";
import NewsWidget from "@/components/player/NewsWidget";

interface Ad {
  id: string;
  type: "image" | "video" | "product";
  final_media_path: string;
  qr_url?: string | null;
  metadata?: any;
}

type WidgetType = "clock" | "weather" | "joke" | "sports" | "news";
const WIDGETS: WidgetType[] = ["clock", "weather", "joke", "sports", "news"];
const WIDGET_DURATION = 10000;
const IMAGE_DURATION = 10000;
const DEFAULT_WIDGET_FREQUENCY = 3;

const CACHE_KEY = "adscreenpro-player-cache";
const loadCache = (): Ad[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]"); } catch { return []; }
};
const saveCache = (ads: Ad[]) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(ads)); } catch {}
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

export default function PlayerPage() {
  const { screenId } = useParams<{ screenId?: string }>();
  const [ads, setAds] = useState<Ad[]>(loadCache);
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

  const clearImageTimer = () => {
    if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
  };
  const clearWidgetTimer = () => {
    if (widgetTimerRef.current) clearTimeout(widgetTimerRef.current);
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
    if (ad?.type === "image" || ad?.type === "product") {
      clearImageTimer();
      imageTimerRef.current = setTimeout(next, IMAGE_DURATION);
    }
    return clearImageTimer;
  }, [tick, current, loaded, ads, next, activeWidget]);

  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    const ad = ads[current];
    if (ad?.type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => next());
    }
  }, [current, loaded, ads, next, activeWidget]);

  const fetchAds = useCallback(async () => {
    try {
      // Query 1: general ads (screen_id IS NULL)
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

      const merged = [...(generalAds ?? []), ...localAds];
      const list: Ad[] = merged.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: row.qr_url ?? null,
        metadata: row.metadata ?? null,
      }));
      setAds(list);
      saveCache(list);
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
          {ad.type === "product" ? (
            <ProductAdSlide
              imageUrl={ad.metadata?.image_url ?? null}
              title={ad.metadata?.title ?? ""}
              price={ad.metadata?.price ?? "0.00"}
              qrUrl={ad.qr_url ?? ""}
            />
          ) : ad.type === "image" ? (
            <img src={ad.final_media_path} alt="" className="w-full h-full object-contain" draggable={false} />
          ) : (
            <video
              ref={index === current ? videoRef : undefined}
              src={ad.final_media_path}
              className="w-full h-full object-contain"
              preload="auto"
              muted playsInline
              onEnded={next}
              onError={next}
            />
          )}

          {/* QR code overlay — only for image ads */}
          {ad.type === "image" && ad.qr_url && (
            <div className="absolute bottom-8 right-8 z-10 bg-white p-2 rounded-lg shadow-lg">
              <QRCodeSVG
                value={ad.qr_url}
                size={80}
              />
            </div>
          )}
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
