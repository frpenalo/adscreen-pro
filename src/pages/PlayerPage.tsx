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

interface Ad {
  id: string;
  type: "image" | "video";
  final_media_path: string;
  qr_url?: string | null;
  metadata?: any;
  // Selfies are stored in the same `ads` table with kind='selfie'.
  // The player uses these to render the customer-name overlay and
  // to avoid logging selfies as paid impressions.
  kind?: "ad" | "selfie";
  customer_name?: string | null;
}

type WidgetType = "clock" | "weather" | "joke" | "sports" | "news" | "selfie-cta";
const WIDGETS: WidgetType[] = ["clock", "weather", "joke", "sports", "news", "selfie-cta"];

// Ratio for interleaving customer selfies into the ad rotation. With
// the default of 5, the visible loop is "ad ad ad ad ad SELFIE ad ad
// ad ad ad SELFIE...". If there are no active selfies, the slot just
// becomes another ad — paid ads never lose airtime to empty slots.
const SELFIE_EVERY_N_ADS = 5;
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
  onVideoStalled?: () => void;
  onVideoWaiting?: () => void;
  onVideoPlaying?: () => void;
}

function AdFrame({ ad, videoRef, onVideoEnded, onVideoError, onVideoStalled, onVideoWaiting, onVideoPlaying }: AdFrameProps) {
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
    // Skip selfies — they're filler content, not billable impressions.
    // Counting them would inflate analytics and confuse advertiser
    // reporting (a selfie display in the rotation isn't a paid ad view).
    if (ad.kind === "selfie") return;
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
      // extended display. Also keeps the rotation snappy when many
      // selfies are queued.
      const duration = ad.kind === "selfie" ? 5000 : IMAGE_DURATION;
      imageTimerRef.current = setTimeout(next, duration);
    }
    return clearImageTimer;
  }, [tick, current, loaded, ads, next, activeWidget]);

  useEffect(() => {
    if (!loaded || ads.length === 0 || activeWidget) return;
    const ad = ads[current];
    if (ad?.type === "video" && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      // Don't cascade to next() if play() rejects — that triggered a rapid
      // bounce back to the previous ad whenever a freshly-mounted <video>
      // hadn't finished buffering yet, making the first ad appear to play
      // 2-3 times before rotating. Real load failures still advance via
      // onError; transient buffering issues recover via the safety timer.
      v.play().catch((err) => console.warn("video play() rejected (will retry via safety timer):", err));

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
          .select("id, type, final_media_path, customer_name, metadata")
          .eq("status", "published")
          .eq("kind" as any, "selfie")
          .eq("screen_id" as any, screenId)
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(8);
        selfieRows = selfies ?? [];
      }

      const generalList: Ad[] = (generalAds ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: null, // never render a partner QR on a non-scoped ad
        metadata: row.metadata ?? null,
        kind: "ad",
      }));
      const localList: Ad[] = localAds.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: row.qr_url ?? null,
        metadata: row.metadata ?? null,
        kind: "ad",
      }));
      const selfieList: Ad[] = selfieRows.map((row: any) => ({
        id: row.id,
        type: row.type,
        final_media_path: row.final_media_path,
        qr_url: null,
        metadata: row.metadata ?? null,
        kind: "selfie",
        customer_name: row.customer_name ?? null,
      }));

      // Interleave: every Nth ad slot becomes a selfie if any are
      // available. If we run out of selfies, those slots stay as ads.
      // This keeps paid ads' airtime intact when the screen has zero
      // active selfies.
      const ads: Ad[] = [...generalList, ...localList];
      const interleaved: Ad[] = [];
      let selfieIdx = 0;
      for (let i = 0; i < ads.length; i++) {
        interleaved.push(ads[i]);
        if (
          (i + 1) % SELFIE_EVERY_N_ADS === 0 &&
          selfieIdx < selfieList.length
        ) {
          interleaved.push(selfieList[selfieIdx++]);
        }
      }
      // Any leftover selfies (more selfies than slots) — append at end
      while (selfieIdx < selfieList.length) {
        interleaved.push(selfieList[selfieIdx++]);
      }

      setAds(interleaved);
      saveCache(screenId, interleaved);
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
