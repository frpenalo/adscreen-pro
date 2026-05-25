import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Bumped manually for now — when we have CI we'll inject the git SHA
// at build time. Heartbeat sends this so admins can spot which TVs
// are stuck on an old build (e.g. didn't reload after a deploy).
const APP_VERSION = "2026.05.05";

// Supabase Realtime broadcast channel name. Both player and admin
// must use this exact format for commands to land.
const COMMAND_CHANNEL = (screenId: string) => `screen-commands:${screenId}`;
// Canvas en vez de SVG — Android WebView (Fully Kiosk) tiene
// problemas renderizando SVGs inline. El canvas es universal.
import { QRCodeCanvas } from "qrcode.react";
import ClockWidget from "@/components/player/ClockWidget";
import WeatherWidget from "@/components/player/WeatherWidget";
import JokeWidget from "@/components/player/JokeWidget";
import SportsWidget from "@/components/player/SportsWidget";
import NewsWidget from "@/components/player/NewsWidget";
import SelfieWidget from "@/components/player/SelfieWidget";
import CinematicReveal from "@/components/selfie/CinematicReveal";
import { useWakeLock } from "@/hooks/useWakeLock";

interface Ad {
  id: string;
  type: "image" | "video";
  final_media_path: string;
  qr_url?: string | null;
  metadata?: any;
  // Selfies are stored in the same `ads` table with kind='selfie'.
  // The player uses these to render the customer-name overlay and
  // to avoid logging selfies as paid impressions.
  //
  // 'teaser' is a SYNTHETIC kind injected by the player (not from DB).
  // It's the global "Awakening" cinematic teaser MP4 that primes the
  // viewer for the selfie QR coming next in rotation. Not logged as
  // a paid impression. Same URL across all partners.
  kind?: "ad" | "selfie" | "teaser";
  customer_name?: string | null;
  customer_title?: string | null;
}

type WidgetType = "clock" | "weather" | "joke" | "sports" | "news" | "selfie-cta";
// selfie-cta repeated 3x so the QR call-to-action sits at ~33% of
// widget slots (vs 16% if it were just one entry). The QR is what
// drives new customers to scan and participate — making it more
// frequent than the ambient widgets (clock/weather) is the right
// trade-off for a conversion-focused screen.
const WIDGETS: WidgetType[] = [
  "clock",
  "weather",
  "joke",
  "sports",
  "news",
  "selfie-cta",
  "selfie-cta",
  "selfie-cta",
];

// Ratio for interleaving customer selfies into the ad rotation.
// Bumped 5 → 10 to keep paid-ad airtime closer to 90% even when the
// selfie pool is full. With ~50 ads in rotation, this yields 5 selfie
// slots per cycle. If there are more active selfies than slots, the
// extra ones wait for the next refetch (postgres_changes triggers
// re-shuffle so unseen ones get their turn).
const SELFIE_EVERY_N_ADS = 10;
const WIDGET_DURATION = 10000;
const IMAGE_DURATION = 10000;
const DEFAULT_WIDGET_FREQUENCY = 3;

// ── "Awakening" teaser ────────────────────────────────────────────────────────
// Cinematic ~21s teaser (A+B+C+D, ver remotion/scripts/build-awakening-teaser.mjs).
// Es PER-PARTNER porque el Segmento D contiene un QR REAL apuntando a la URL
// del selfie del partner (/selfie/:screenId). Cada partner se renderiza por
// separado vía el script y se sube a:
//   ad-media/partner-teasers/{screenId}.mp4
// Si el archivo no existe (partner sin teaser generado), el video falla en
// onError y next() avanza — safe-fail, no rompe la rotación.
//
// ⚠️  CACHE-BUSTER MANUAL (TEASER_VERSION) ⚠️
// Como el storage path es FIJO ({screenId}.mp4) y se re-usa entre renders,
// Android WebView / Fully Kiosk Browser sirven los bytes cacheados aunque
// Storage tenga bytes nuevos — exacto mismo bug que arreglamos para SalesAd
// en commit f8375d0. La diferencia: SalesAd tiene un row.id en DB que cambia
// con cada DELETE+INSERT del workflow → cache-buster automático. El teaser
// NO inserta en DB (player construye el URL solo), así que no hay row.id.
// Solución: bumpear TEASER_VERSION acá CADA VEZ que se re-renderice el
// teaser. La query string fuerza al WebView a tratar la URL como nueva.
const TEASER_STORAGE_BASE =
  "https://qrlzbveaoibyidpwlwmz.supabase.co/storage/v1/object/public/ad-media/partner-teasers";
const TEASER_VERSION = "20260525-6";
const teaserUrlFor = (screenId: string | undefined) =>
  screenId
    ? `${TEASER_STORAGE_BASE}/${screenId}.mp4?v=${TEASER_VERSION}`
    : null;
// Cada N slots de la rotación, inyectamos un teaser. Con ~12 slots entre
// teasers y ~10s por slot = un teaser cada ~2 minutos. Suficiente para
// generar hype sin canibalizar airtime pagado. Ajustable sin re-deploy via
// remote command si nos da feedback negativo.
const TEASER_EVERY_N_SLOTS = 12;
// Duración aproximada del teaser en segundos. Usada como fallback cuando el
// videoElement no logra cargar metadata a tiempo (Fully Kiosk a veces tarda).
// El timer real arma con v.duration + 2s si llega; este valor solo entra si
// metadata nunca llega. 24s > 21s del teaser real (con margen de seguridad).
const TEASER_FALLBACK_DURATION_S = 24;

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
  onVideoStalled?: () => void;
  onVideoWaiting?: () => void;
  onVideoPlaying?: () => void;
}

function AdFrame({ ad, videoRef, onVideoEnded, onVideoError, onVideoStalled, onVideoWaiting, onVideoPlaying }: AdFrameProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number; left: number; top: number } | null>(null);

  // Detección de videos que necesitan autoplay "agresivo" (preload="auto"
  // + autoPlay attribute) para que Fully Kiosk los reproduzca sin que el
  // browser bloquee el play() inicial:
  //
  //   - kind === "teaser": el Awakening teaser (confirmado por bisección,
  //     ver commit 267a147 y test-teaser.html).
  //   - URL bajo partner-sales-ads/: el SalesAd generado por render.mjs.
  //     Mismas características de encoding que el teaser (H.264 Baseline +
  //     AAC silente + Lavf58) que parecen disparar la heurística de
  //     autoplay-block de Fully Kiosk. Confirmed empíricamente.
  //
  // El resto (Shopify products, advertiser ads, selfies) NO entra aquí —
  // funcionan bien con preload="metadata" y sin autoPlay attribute, y
  // mantenerlos así evita decoder pressure en TVs viejos (commit cf8cd39).
  const needsAggressiveAutoplay =
    ad.kind === "teaser" ||
    ad.final_media_path.includes("/partner-sales-ads/");

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
    // Fondo negro al wrapper. Sin esto, mientras la <img> carga (o si
    // un <video> aún no decodifica frames), Fully Kiosk WebView muestra
    // BLANCO en lugar del bg de la página. Aplicarlo al wrapper en
    // lugar del <img> porque algunos WebViews ignoran backgroundColor
    // en imgs (es replaced element). El wrapper es un div regular
    // donde bg-color siempre se aplica.
    <div ref={wrapperRef} className="relative w-full h-full" style={{ backgroundColor: "#0a0a0a" }}>
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
          // preload="metadata" instead of "auto". Background:
          // confirmed freeze pattern at Softmedia (TCL Google TV
          // running Fully Kiosk) where the same SalesAd frame
          // froze within ~1h even after we fixed the H.264 encoding
          // and added a cache-buster. Same-frame freeze regardless
          // of encoding pointed to decoder pressure, not the file.
          //
          // With preload="auto", the browser pre-decodes EVERY <video>
          // in the DOM into memory — even hidden ones. The player
          // keeps all ads mounted (opacity 0 for inactive) for the
          // crossfade. On a TV-class WebView with 1-2 hardware
          // decoders, that exceeds the decoder budget after enough
          // rotations and one freezes mid-frame.
          //
          // "metadata" only fetches the container header (duration,
          // dimensions, codec) — frames are decoded lazily when
          // play() is called. duration is still known so the safety
          // timer and freeze detector work the same way.
          // preload: teaser + SalesAd usan "auto" para pre-bufferar bytes
          // (ambos tienen encoding Baseline + AAC silente que sin
          // pre-buffer rechaza el v.play() imperativo). Resto sigue
          // "metadata" para no sobrecargar decoder en TVs viejos
          // (commit cf8cd39).
          //
          // autoPlay attribute: NADIE lo usa. Razón confirmada por
          // whack-a-mole: el autoPlay attribute hace que el video
          // empiece a reproducir AL MOMENTO DE MONTAR (no cuando se
          // hace current). El player monta TODOS los ads en paralelo
          // → múltiples videos con autoPlay → todos hogging decoders
          // en background → cuando le toca a otro ad no hay decoder
          // libre → pantalla blanca. Eliminar autoPlay attribute
          // completamente deja que SOLO el current ad consuma decoder
          // (via v.play() imperativo del useEffect).
          preload={needsAggressiveAutoplay ? "auto" : "metadata"}
          muted
          playsInline
          onEnded={onVideoEnded}
          onError={onVideoError}
          onLoadedMetadata={compute}
          // Stall = network/decoder isn't supplying data; Waiting = ran
          // out of buffer mid-playback. Both indicate a freeze in
          // progress. We surface them so the parent can arm a recovery
          // timer instead of sitting on a frozen frame.
          onStalled={onVideoStalled}
          onWaiting={onVideoWaiting}
          // `playing` fires when playback resumes after a buffer wait —
          // the parent uses this to clear any pending recovery timer.
          onPlaying={onVideoPlaying}
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
  // Keep the TV awake. Without this, Android/ChromeOS panels (and even
  // some kiosk browsers) will dim or sleep after a few minutes of no
  // touch input, killing the loop. Wake Lock API is a no-op on
  // browsers that don't support it (older WebView), so safe to call
  // unconditionally. Re-acquires on visibilitychange in case the OS
  // released the lock when the tab was backgrounded.
  useWakeLock();

  // Pintar el body de oscuro mientras el PlayerPage está montado. El
  // body por defecto tiene bg blanco (--background: 0 0% 100% en
  // index.css :root). Aunque el PlayerPage root tiene su propio bg
  // dark, durante re-paints del browser (transiciones de opacity entre
  // ads/widgets, montaje/desmontaje de elementos) el body BLANCO se
  // alcanza a ver 1-2 frames → ese era el "flash blanco" que aparecía
  // entre rotaciones. Restoreamos el bg original al unmount.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0a0a0a";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  const [ads, setAds] = useState<Ad[]>(() => loadCache(screenId));
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null); // crossfade: keeps old content visible
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeWidget, setActiveWidget] = useState<WidgetType | null>(null);
  const [widgetFrequency, setWidgetFrequency] = useState(DEFAULT_WIDGET_FREQUENCY);
  const [tick, setTick] = useState(0);
  // Selfie cinematic reveal state — declared HERE (top of component) so
  // effects below that reference `revealingSelfieId` (notably the image
  // timer that extends duration for fresh selfies) don't hit a
  // temporal dead zone. Previous placement was after the realtime
  // subscription effect ~500 lines below, which caused a runtime
  // ReferenceError after minification ("Cannot access 'V' before
  // initialization") and rendered the entire player blank.
  const [freshSelfieIds, setFreshSelfieIds] = useState<Set<string>>(new Set());
  const [revealingSelfieId, setRevealingSelfieId] = useState<string | null>(null);
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
  // Recovery timer for stall/waiting. Different from videoTimerRef
  // (which is the duration-based safety net) — this fires when the
  // video element explicitly tells us it's blocked on data, and gives
  // it 5s to recover before we skip to the next ad.
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Freeze detector state. We sample currentTime every FREEZE_SAMPLE_MS
  // and count consecutive samples where it didn't advance. After 3
  // identical samples (~6s of no progress while the video should be
  // playing) we treat it as a hard freeze and skip. This catches cases
  // the duration-timer misses, e.g. decoder hangs at frame 50/300.
  const freezeWatcherRef = useRef<{ lastTime: number; sameCount: number }>({ lastTime: -1, sameCount: 0 });
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

  // Track when the player mounted so heartbeat can send uptime.
  // Used by admin Fleet Health to spot TVs that haven't rebooted in
  // forever (likely accumulating decoder state) vs fresh restarts.
  const mountedAtRef = useRef<number>(Date.now());

  // Explicit heartbeat — ping backend every 60s so Fleet Health can
  // distinguish "TV on, no ads" from "TV off". Independent from
  // ad_logs which only fire when there are ads to play. We attach
  // uptime/version/ads_count so admins see what each TV is actually
  // doing. ads.length lives in a ref because we don't want to re-arm
  // the interval every time the ad list refetches.
  const adsCountRef = useRef(0);
  useEffect(() => { adsCountRef.current = ads.length; }, [ads.length]);

  useEffect(() => {
    if (!screenId) return;
    const ping = () => {
      if (!navigator.onLine) return;
      const uptimeSec = Math.floor((Date.now() - mountedAtRef.current) / 1000);
      supabase.rpc("ping_screen", {
        screen_id: screenId,
        p_uptime_seconds: uptimeSec,
        p_app_version: APP_VERSION,
        p_ads_count: adsCountRef.current,
      });
    };
    ping(); // immediate on mount
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [screenId]);

  // Remote command channel — admin can push reload / clear-cache /
  // force-fetch from the dashboard without anyone touching the TV.
  // Uses Supabase Realtime broadcast (not Postgres changes) so
  // commands deliver in <1s and don't cost a DB row.
  useEffect(() => {
    if (!screenId) return;
    const channel = supabase
      .channel(COMMAND_CHANNEL(screenId))
      .on("broadcast", { event: "command" }, ({ payload }) => {
        const cmd: string = payload?.cmd;
        console.warn("[player] received remote command:", cmd);
        switch (cmd) {
          case "reload":
            window.location.reload();
            break;
          case "clear-cache":
            try { localStorage.clear(); } catch { /* ignore */ }
            window.location.reload();
            break;
          case "force-fetch":
            // Just refetch the ad list without reloading the page.
            // Useful when admin pushes new content and wants TVs to
            // pick it up immediately instead of waiting for the
            // postgres_changes subscription to roundtrip.
            fetchAdsRef.current?.();
            break;
          default:
            console.warn("[player] unknown command:", cmd);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [screenId]);

  // Auto-reload every 3h — prevents longevity bugs (memory leaks,
  // stale service worker, abandoned websockets, video decoder state).
  // Was 6h originally; halved because partner TVs running 24/7 were
  // accumulating decoder state and dropping frames after long uptime.
  // Jittered by ±5 min to avoid a thundering-herd reload across the
  // whole fleet if many screens were opened at the same time.
  useEffect(() => {
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const jitter = Math.floor((Math.random() - 0.5) * 10 * 60 * 1000); // ±5 min
    const timeout = setTimeout(() => {
      window.location.reload();
    }, THREE_HOURS + jitter);
    return () => clearTimeout(timeout);
  }, []);

  // Watchdog: event-loop freeze detector. Writes a timestamp to
  // localStorage every 30s and, on the same tick, checks whether the
  // PREVIOUS tick fired on schedule. If the gap between writes was
  // > 90s it means the JS event loop was frozen (an ANR on Android
  // WebView, a video decoder stalling the renderer thread, etc) — we
  // force-reload to recover. Without this, a frozen kiosk could sit
  // dead for up to the full auto-reload window.
  //
  // Why this works even though a frozen loop ALSO freezes setInterval:
  // when the loop unfreezes, the next interval tick fires immediately
  // and observes the gap, so the reload happens on recovery rather
  // than during the freeze itself. Net effect: a 30s-90s freeze
  // recovers cleanly instead of persisting until the 3h reload.
  useEffect(() => {
    const KEY = "adscreenpro-watchdog-tick";
    const TICK = 30_000;
    const FREEZE_THRESHOLD = 90_000;
    // Seed on mount so the first check has a baseline
    localStorage.setItem(KEY, String(Date.now()));
    const id = setInterval(() => {
      const last = Number(localStorage.getItem(KEY) ?? "0");
      const now = Date.now();
      const gap = now - last;
      localStorage.setItem(KEY, String(now));
      if (last > 0 && gap > FREEZE_THRESHOLD) {
        console.warn("[player] event-loop gap detected:", gap, "ms — reloading");
        window.location.reload();
      }
    }, TICK);
    return () => clearInterval(id);
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
  const clearStallTimer = () => {
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
  };

  const logImpression = useCallback((ad: Ad) => {
    if (!ad || !online) return;
    // Skip selfies AND teasers — they're filler content, not billable
    // impressions. Counting them would inflate analytics and confuse
    // advertiser reporting (a selfie or the awakening teaser isn't a
    // paid ad view). The teaser ID is also synthetic ("system-awakening")
    // so the FK to ads.id would fail anyway.
    if (ad.kind === "selfie" || ad.kind === "teaser") return;
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
      // Selfies show shorter (5s vs 10s for ads). They're filler
      // content; the customer wants a quick reveal moment, not an
      // extended display. EXCEPT: fresh selfies (first time appearing
      // after AI generation) get 10s — 5s for the cinematic reveal
      // sequence + 5s of static display underneath. After the reveal
      // unmounts, the customer + everyone in the shop gets to actually
      // see the final image without the overlay.
      const isFreshSelfie = ad.kind === "selfie" && revealingSelfieId === ad.id;
      const duration = ad.kind === "selfie"
        ? (isFreshSelfie ? 10000 : 5000)
        : IMAGE_DURATION;
      imageTimerRef.current = setTimeout(next, duration);
    }
    return clearImageTimer;
  }, [tick, current, loaded, ads, next, activeWidget, revealingSelfieId]);

  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    const ad = ads[current];
    if (ad?.type === "video" && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      // Forzar muted=true imperativamente ANTES de play(). El atributo
      // muted del JSX debería ser suficiente, pero algunos browsers (TV
      // Bro / Fully Kiosk / Android WebView específicos) evalúan el
      // autoplay policy en un timing donde el attribute todavía no se
      // aplicó al objeto DOM. Setearlo via JS antes del play() cierra
      // esa ventana de race-condition. Síntoma cuando falta: video
      // cargado pero browser muestra overlay ▶ "tap to play".
      v.muted = true;
      // Don't cascade to next() if play() rejects — that triggered a rapid
      // bounce back to the previous ad whenever a freshly-mounted <video>
      // hadn't finished buffering yet, making the first ad appear to play
      // 2-3 times before rotating. Real load failures still advance via
      // onError; transient buffering issues recover via the safety timer.
      v.play().catch((err) => console.warn("video play() rejected (will retry via safety timer):", err));

      // Re-attempt play cuando la pestaña vuelva a primer plano. En
      // TV Bro / Chrome WebView, cuando el tab se backgrouna Chrome
      // pausa el video y la promise de play() rechaza con AbortError.
      // Al volver, debemos llamar play() de nuevo (no es automático).
      // Listener local al ciclo de este ad: se limpia con el cleanup.
      const onVisibility = () => {
        if (!document.hidden && v.paused) {
          v.muted = true;
          v.play().catch(() => { /* ignore — safety timer cubre */ });
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      // El cleanup del useEffect anterior ya no aplica a este listener;
      // lo limpiamos junto con los timers más abajo dentro del return.
      ;(v as any).__visibilityCleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
      };

      // Safety-net: force-advance if onEnded never fires (Fully Kiosk /
      // Android WebView / Smart TV browser quirk). Use the video's own
      // duration + 2s buffer when available; otherwise 15s fallback for
      // normal ads, 20s fallback for the awakening teaser (18s long).
      clearVideoTimer();
      const fallbackDur = ad.kind === "teaser" ? TEASER_FALLBACK_DURATION_S : 13;
      const armTimer = () => {
        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : fallbackDur;
        clearVideoTimer();
        videoTimerRef.current = setTimeout(next, (dur + 2) * 1000);
      };
      if (v.readyState >= 1 /* HAVE_METADATA */) {
        armTimer();
      } else {
        v.addEventListener("loadedmetadata", armTimer, { once: true });
      }
    }
    return () => {
      clearVideoTimer();
      // Limpiar el listener de visibilitychange si se montó arriba.
      const v = videoRef.current as any;
      if (v?.__visibilityCleanup) {
        v.__visibilityCleanup();
        v.__visibilityCleanup = undefined;
      }
    };
    // `tick` is required so this effect re-fires when next() advances
    // from the only ad back to itself (current stays the same when
    // ads.length === 1). Without it, the video plays once and freezes.
  }, [tick, current, loaded, ads, next, activeWidget]);

  // Freeze detector — independent of `duration`. The duration-based
  // videoTimerRef expires at duration+2s, but a video that hangs at
  // frame 50/300 sits there silently for 8 more seconds before the
  // safety net fires. This watcher samples currentTime every 2s and
  // skips after 6s of no progress. Cheaper than rAF, accurate enough.
  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    if (ads[current]?.type !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    freezeWatcherRef.current = { lastTime: -1, sameCount: 0 };
    const SAMPLE_MS = 2000;
    const STUCK_SAMPLES = 3; // 3 × 2s = 6s of no progress = freeze
    const id = setInterval(() => {
      // Don't flag legit pauses (seeking, ended, paused, no data yet)
      // — only when the video is supposed to be actively playing.
      if (!v || v.paused || v.ended || v.seeking || v.readyState < 2) return;
      const t = v.currentTime;
      const w = freezeWatcherRef.current;
      if (w.lastTime >= 0 && Math.abs(t - w.lastTime) < 0.05) {
        w.sameCount += 1;
        if (w.sameCount >= STUCK_SAMPLES) {
          console.warn("[player] video freeze detected at", t, "s — advancing");
          next();
        }
      } else {
        w.sameCount = 0;
      }
      w.lastTime = t;
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [tick, current, loaded, ads, next, activeWidget]);

  // Recovery handlers — wired into the <video> via AdFrame. `stalled`
  // and `waiting` mean the player is blocked on data; if it doesn't
  // recover (`playing` event) within 5s, we skip. This catches network
  // drops in the middle of a video that the freeze-watcher's 6s window
  // would also catch but slower.
  const onVideoStallOrWait = useCallback(() => {
    if (stallTimerRef.current) return; // already armed
    stallTimerRef.current = setTimeout(() => {
      console.warn("[player] video stall did not recover in 5s — advancing");
      stallTimerRef.current = null;
      next();
    }, 5000);
  }, [next]);
  const onVideoPlaying = useCallback(() => {
    clearStallTimer();
  }, []);

  // (Removed: "Decoder cleanup on ad change" useEffect.)
  // Intent was to release the WebView decoder by pausing + clearing
  // src on the OLD video before the new one mounts. The bug: by the
  // time the useEffect cleanup ran, React had already remounted refs
  // — videoRef.current pointed to the NEW video, not the old one.
  // The "cleanup" was wiping the src of the newly-mounted video,
  // leaving every video after the first as a blank/black frame.
  //
  // The remaining protections cover the same problem space without
  // this bug:
  //   - Auto-reload every 3h flushes accumulated decoder state
  //   - Freeze detector skips ads whose decoder hung mid-playback
  //   - Stall/waiting handlers recover from network drops
  //   - onError → next() skips broken sources entirely
  //
  // If memory accumulation becomes measurable in production, the
  // correct fix is to capture the video element at effect-time (not
  // cleanup-time) into a closure variable, so the cleanup operates
  // on the element that was current when the effect ran. Out of
  // scope for the surgical fix.

  // Reset stall + freeze state on ad change. Safe — only touches
  // local refs, not the DOM. Mirrors what the buggy cleanup tried
  // to do for its non-DOM bookkeeping.
  useEffect(() => {
    clearStallTimer();
    freezeWatcherRef.current = { lastTime: -1, sameCount: 0 };
  }, [current]);

  const fetchAds = useCallback(async () => {
    try {
      // Filter out selfies in queries 1+2 — they live in the same
      // table but get their own query so we can interleave them at
      // the right ratio. Without `kind=ad` the ad rotation would get
      // diluted by however many selfies are active.
      // Query 1: general ads (screen_id IS NULL).
      // By definition these are NOT tied to any specific partner, so we
      // strip any qr_url they may carry — only per-screen ads (query 2)
      // are allowed to render a partner QR overlay.
      const { data: generalAds, error: err1 } = await supabase
        .from("ads")
        .select("id, type, final_media_path, qr_url, metadata")
        .eq("status", "published")
        .eq("kind" as any, "ad")
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
          .eq("kind" as any, "ad")
          .eq("screen_id" as any, screenId)
          .limit(10);
        if (!err2) localAds = local ?? [];
      }

      // Query 3: active customer selfies for this screen. Filter
      // expires_at server-side so the player never holds expired
      // rows. Order by created_at desc so the newest selfie shows
      // first when this screen has more than one ready.
      let selfieRows: any[] = [];
      if (screenId) {
        const nowIso = new Date().toISOString();
        const { data: selfies } = await supabase
          .from("ads")
          .select("id, type, final_media_path, customer_name, customer_title, metadata")
          .eq("status", "published")
          .eq("kind" as any, "selfie")
          .eq("screen_id" as any, screenId)
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(8);
        selfieRows = selfies ?? [];
      }

      // Append the row's id as a cache-buster query param to the
      // media URL. Why: some storage paths reuse the same filename
      // across renders (e.g. partner-sales-ads/{partnerId}.mp4 — the
      // SalesAd that hung Softmedia even after we re-rendered with
      // safe encoding, because Android WebView kept serving the old
      // bytes from HTTP cache). The new ad row has a new id on every
      // re-render, so this forces a fresh fetch. For rows that don't
      // re-render (selfies, advertiser ads with unique paths) it's a
      // no-op since the URL stays stable.
      const withBuster = (url: string | null | undefined, id: string) => {
        if (!url) return url ?? "";
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}v=${id}`;
      };

      const generalList: Ad[] = (generalAds ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: withBuster(row.final_media_path, row.id),
        qr_url: null, // never render a partner QR on a non-scoped ad
        metadata: row.metadata ?? null,
        kind: "ad",
      }));
      const localList: Ad[] = localAds.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: withBuster(row.final_media_path, row.id),
        qr_url: row.qr_url ?? null,
        metadata: row.metadata ?? null,
        kind: "ad",
      }));
      const selfieList: Ad[] = selfieRows.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: withBuster(row.final_media_path, row.id),
        qr_url: null,
        metadata: row.metadata ?? null,
        kind: "selfie",
        customer_name: row.customer_name ?? null,
        customer_title: row.customer_title ?? null,
      }));

      // Shuffle the selfie pool so each refetch gives a different
      // order — when there are more active selfies than slots in a
      // rotation, the unseen ones get their turn in the next cycle.
      // Fisher-Yates.
      const shuffledSelfies = [...selfieList];
      for (let i = shuffledSelfies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSelfies[i], shuffledSelfies[j]] = [shuffledSelfies[j], shuffledSelfies[i]];
      }

      // How many selfies go into this rotation:
      //   - Many ads (>=N): cap at floor(ads/N) → keeps paid-ad airtime
      //     ~90% even when many selfies are queued
      //   - Few ads (<N): include ALL active selfies → variety matters
      //     more than airtime cap (there are no paid ads to dilute).
      //     Without this, a partner with 2 ads sees the same single
      //     selfie loop forever until a refetch happens.
      const ads: Ad[] = [...generalList, ...localList];
      const maxSelfiesThisRotation = ads.length >= SELFIE_EVERY_N_ADS
        ? Math.max(1, Math.floor(ads.length / SELFIE_EVERY_N_ADS))
        : shuffledSelfies.length;
      const selfiesToUse = shuffledSelfies.slice(
        0,
        Math.min(shuffledSelfies.length, maxSelfiesThisRotation),
      );
      // Spacing — distribute selfies evenly through the ad list.
      // With 50 ads + 3 selfies → interval ≈ 17 (one selfie every 17 ads).
      // With 2 ads + 3 selfies → interval = 1 (selfie after every ad,
      // plus trailing selfies appended below).
      const interval = selfiesToUse.length > 0
        ? Math.max(1, Math.ceil(ads.length / selfiesToUse.length))
        : SELFIE_EVERY_N_ADS;

      const interleaved: Ad[] = [];
      let selfieIdx = 0;
      for (let i = 0; i < ads.length; i++) {
        interleaved.push(ads[i]);
        if (
          (i + 1) % interval === 0 &&
          selfieIdx < selfiesToUse.length
        ) {
          interleaved.push(selfiesToUse[selfieIdx++]);
        }
      }
      // Append any selfies that didn't fit the modulo pattern. When
      // ads are scarce and selfies abundant (e.g. 2 ads + 3 selfies
      // + interval=1 gives ad,selfie,ad,selfie — third selfie is
      // trailing), this puts the remainder at the end so all active
      // selfies appear at least once per rotation.
      while (selfieIdx < selfiesToUse.length) {
        interleaved.push(selfiesToUse[selfieIdx++]);
      }

      // ── Inyectar teaser "Awakening" cada N slots ──────────────────
      // Hace de "trailer" antes de los slots de selfie-cta. Se mete
      // DESPUÉS del interleave de selfies para que cuente sobre la
      // rotación final (ads + selfies), no solo los ads originales.
      // Si la rotación tiene <N slots, igual metemos UN teaser al
      // final para que al menos aparezca una vez por ciclo en
      // rotaciones cortas (partner nuevo con pocos ads).
      // El URL es PER-PARTNER (QR real apuntando a /selfie/{screenId}).
      // Si no hay screenId (preview/dev), saltamos el teaser entirely.
      //
      // IMPORTANTE: cada injection del teaser debe tener un `id` ÚNICO.
      // React usa key={ad.id} en el map del render, y duplicar el id
      // causa que React reuse el mismo <video> element entre slots →
      // primera vez juega, segunda vez sale blanco (video element
      // quedó pausado al final del primer ciclo, no re-arranca en el
      // segundo). Por eso el síntoma "sale bien en uno, mal en otro".
      const teaserUrl = teaserUrlFor(screenId);
      const withTeasers: Ad[] = [];
      if (teaserUrl) {
        // Factory en lugar de objeto compartido — cada llamada produce
        // un nuevo objeto con id único basado en su posición.
        const makeTeaser = (slotIndex: number): Ad => ({
          id: `system-awakening-teaser-${screenId}-${slotIndex}`,
          type: "video",
          final_media_path: teaserUrl,
          qr_url: null,
          metadata: null,
          kind: "teaser",
        });
        let teaserSlot = 0;
        for (let i = 0; i < interleaved.length; i++) {
          withTeasers.push(interleaved[i]);
          if ((i + 1) % TEASER_EVERY_N_SLOTS === 0) {
            withTeasers.push(makeTeaser(teaserSlot++));
          }
        }
        if (withTeasers.length === interleaved.length && interleaved.length > 0) {
          withTeasers.push(makeTeaser(teaserSlot++));
        }
      } else {
        withTeasers.push(...interleaved);
      }

      setAds(withTeasers);
      saveCache(screenId, withTeasers);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [screenId]);

  // Stash latest fetchAds in a ref so the remote-command channel can
  // call it without re-subscribing every time fetchAds's identity
  // changes (every ad-list refetch). Saves a teardown/setup cycle on
  // the realtime channel.
  const fetchAdsRef = useRef<typeof fetchAds | null>(null);
  useEffect(() => { fetchAdsRef.current = fetchAds; }, [fetchAds]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  // Track selfie IDs that JUST became visible (status flipped from
  // 'draft' to 'published' via the background AI task). When the
  // rotation lands on one of these, the player plays a 5s cinematic
  // reveal sequence BEFORE the normal display — gives the
  // "appearance" moment the drama it deserves. After the reveal
  // plays once, the ID is removed from this set so subsequent
  // rotations of the same selfie are normal (no repeated reveal
  // for the same customer). State is declared at the top of the
  // component now — keep it that way so the image timer effect above
  // can read revealingSelfieId without a temporal-dead-zone error.

  useEffect(() => {
    const channel = supabase
      .channel("player-ads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ads" },
        (payload) => {
          // Detect a selfie's status flipping from draft → published.
          // The transform-selfie background task does exactly one
          // UPDATE per selfie, setting status='published' and the
          // final_media_path. Mark it as "fresh" so the cinematic
          // reveal triggers on its first appearance.
          const newRow: any = (payload as any).new;
          const oldRow: any = (payload as any).old;
          if (
            payload.eventType === "UPDATE" &&
            newRow?.kind === "selfie" &&
            newRow?.status === "published" &&
            oldRow?.status !== "published"
          ) {
            setFreshSelfieIds((prev) => {
              const next = new Set(prev);
              next.add(newRow.id);
              return next;
            });
          }
          fetchAds();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAds]);

  // When the rotation lands on a fresh selfie, kick off the
  // cinematic reveal (renders fullscreen over the normal ad display).
  // Once started, immediately remove from the fresh set so the
  // reveal can't re-fire if React re-runs this effect for any reason.
  useEffect(() => {
    if (activeWidget) return;
    const currentAd = ads[current];
    if (!currentAd) return;
    if (currentAd.kind !== "selfie") return;
    if (!freshSelfieIds.has(currentAd.id)) return;
    setRevealingSelfieId(currentAd.id);
    setFreshSelfieIds((prev) => {
      const next = new Set(prev);
      next.delete(currentAd.id);
      return next;
    });
  }, [current, ads, activeWidget, freshSelfieIds]);

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
            onVideoStalled={index === current ? onVideoStallOrWait : undefined}
            onVideoWaiting={index === current ? onVideoStallOrWait : undefined}
            onVideoPlaying={index === current ? onVideoPlaying : undefined}
          />
        </div>
        );
      })}

      {/* Widgets */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: activeWidget ? 1 : 0, zIndex: activeWidget ? 2 : 0 }}
      >
        {activeWidget === "clock"      && <ClockWidget />}
        {activeWidget === "weather"    && <WeatherWidget />}
        {activeWidget === "joke"       && <JokeWidget />}
        {activeWidget === "sports"     && <SportsWidget />}
        {activeWidget === "news"       && <NewsWidget />}
        {activeWidget === "selfie-cta" && screenId && <SelfieWidget screenId={screenId} />}
      </div>

      {/* Cinematic Reveal — sits ON TOP of everything for 5s when a
          fresh selfie hits the rotation. Customer name + dramatic
          title + scan/score animation + final image scale-in. After
          5s the onComplete callback fires, we unmount, and the normal
          selfie display + name overlay below take over for 5 more
          seconds (timer extended to 10s for fresh selfies). */}
      {(() => {
        if (!revealingSelfieId) return null;
        const ad = ads[current];
        if (!ad || ad.id !== revealingSelfieId) return null;
        return (
          <div className="absolute inset-0 z-20">
            <CinematicReveal
              imageUrl={ad.final_media_path}
              name={ad.customer_name ?? null}
              title={ad.customer_title ?? null}
              businessName={(ad.metadata as any)?.business_name ?? ""}
              onComplete={() => setRevealingSelfieId(null)}
            />
          </div>
        );
      })()}

      {/* Selfie name overlay — only shows when the active ad is a
          customer selfie. Stays out of the way (top-right corner) so
          it doesn't fight with the QR overlay or the media itself.
          Drives social-share moment: customer points at TV showing
          their own name + transformed selfie, takes phone photo. */}
      {(() => {
        if (activeWidget) return null;
        const ad = ads[current];
        if (ad?.kind !== "selfie") return null;
        const name = ad.customer_name;
        const business = (ad.metadata as any)?.business_name;
        return (
          <div className="absolute top-6 left-6 right-6 z-10 pointer-events-none flex justify-between items-start">
            <div className="bg-gradient-to-br from-violet-500/90 to-fuchsia-600/90 backdrop-blur-md rounded-2xl px-5 py-3 shadow-2xl border border-white/20">
              <div className="text-white/70 text-[10px] tracking-[0.3em] uppercase font-medium mb-0.5">
                Hecho con AdScreenPro
              </div>
              <div className="text-white font-bold leading-tight" style={{ fontSize: "1.8vw" }}>
                {name ? `👋 ${name}` : "👋 Un cliente"}
                {business ? <span className="text-white/80 font-normal"> en {business}</span> : null}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Watermark */}
      <div className="absolute bottom-3 right-4 z-10 pointer-events-none">
        <span className="text-white/15 text-xs tracking-widest uppercase select-none">AdScreenPro</span>
      </div>
    </div>
  );
}
