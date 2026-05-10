import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Sparkles, Tv, AlertCircle } from "lucide-react";

// ── Style catalog ──────────────────────────────────────────────────────────
// IDs MUST match the keys in the transform-selfie edge function's
// STYLE_PROMPTS map. Order matters — most viral styles first so they
// dominate the above-the-fold of the picker grid.
const STYLES = [
  { id: "peluche",       emoji: "🧸", label: "Peluche" },
  { id: "action-figure", emoji: "📦", label: "Action Figure" },
  { id: "anime",         emoji: "🎨", label: "Anime / Pixar" },
  { id: "caricatura",    emoji: "😂", label: "Caricatura" },
  { id: "estatua",       emoji: "🗿", label: "Estatua griega" },
  { id: "poster",        emoji: "🎬", label: "Póster cine" },
  { id: "pixel-art",     emoji: "👾", label: "Pixel art" },
  { id: "superheroe",    emoji: "🦸", label: "Superhéroe" },
  { id: "trading-card",  emoji: "🎴", label: "Trading card" },
  { id: "wanted",        emoji: "🤠", label: "Wanted poster" },
];

type Step = "pick-style" | "take-photo" | "loading" | "success" | "error" | "geo-denied";

// ── Geolocation ────────────────────────────────────────────────────────────
// Customer MUST be physically inside the partner's business (≤60m
// from the geocoded address, with GPS accuracy ≤75m). Two reasons:
//
//   1. The reveal on the TV is the social moment — only matters if
//      the customer is there to see it (and friends/staff react).
//   2. Prevents abuse: someone outside the building (parking lot,
//      sidewalk, neighbor) can't post inappropriate content to the
//      partner's screen by scanning a QR through the window.
//
// Returns null if customer denies permission, browser lacks geo, or
// the fix is too imprecise to trust. Caller must treat null as block.
async function getCoords(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (!("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, // meters; smaller = better
      }),
      () => resolve(null),
      // We force a fresh fix (no cache) and require high accuracy —
      // a stale cached low-accuracy reading would let bad actors
      // game the check from outside the building.
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}

// ── Device fingerprint ─────────────────────────────────────────────────────
// Combines stable-ish browser characteristics into a SHA-256 hash.
// Imperfect by design — a determined customer can clear localStorage,
// switch to incognito, change UA. That's why the IP rate-limit exists
// as a second layer. This catches >95% of casual screenshot-farming
// without spending the bandwidth/UX cost of a full fingerprinting lib.
async function getFingerprint(): Promise<string> {
  // Stable random ID per browser; persists across visits unless
  // localStorage is cleared. This is the dominant component.
  let stableId = localStorage.getItem("adscreenpro-fp-id");
  if (!stableId) {
    stableId = crypto.randomUUID();
    localStorage.setItem("adscreenpro-fp-id", stableId);
  }
  const parts = [
    stableId,
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    navigator.language || "",
  ].join("|");
  const buf = new TextEncoder().encode(parts);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Compress image before sending ──────────────────────────────────────────
// Phone selfies are commonly 4-12 MB. The edge function would choke on
// the JSON payload. We resize down to max 1280px wide and re-encode at
// JPEG 0.85 — usually gets the file under 300KB without visible
// quality loss for a 1024x1024 AI input.
const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const MAX = 1280;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = reject;
    img.src = url;
  });

export default function SelfiePage() {
  const { screenId } = useParams<{ screenId: string }>();
  const [step, setStep] = useState<Step>("pick-style");
  const [style, setStyle] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the partner's business name to show on the success screen
  // ("Aparecerás en Barber Shop X"). Public read — no auth needed.
  useEffect(() => {
    if (!screenId) return;
    supabase
      .from("partners")
      .select("business_name, status")
      .eq("id", screenId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setError("Pantalla no encontrada");
        else if (data.status !== "approved") setError("Esta pantalla no está activa todavía");
        else setBusinessName(data.business_name);
      });
  }, [screenId]);

  const handleFile = (f: File) => {
    if (f.size > 15 * 1024 * 1024) {
      setError("La foto pesa demasiado (máx 15MB)");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError("");
  };

  const handleSubmit = async () => {
    if (!file || !style || !screenId) return;
    setStep("loading");
    setError("");
    try {
      // Geolocation gate — fail FAST before any expensive work.
      // null = permission denied OR no geo support → block.
      const coords = await getCoords();
      if (!coords) {
        setError("Necesitamos tu ubicación para verificar que estás en el negocio. Activa el GPS y vuelve a intentar.");
        setStep("geo-denied");
        return;
      }

      const fp = await getFingerprint();
      const imageBase64 = await toBase64(file);
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transform-selfie`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Supabase edge functions verify JWT by default. The anon
          // key is a valid JWT — pass it as Authorization. Without
          // this header, the gateway returns 401 before reaching the
          // function code at all.
          "Authorization": `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: "image/jpeg",
          screenId,
          style,
          customerName: name.trim() || null,
          fp,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        // Server-side geo rejections (too_far / low_accuracy / no_partner_geo)
        // route to the dedicated geo-denied screen so the customer gets a
        // clear actionable message instead of a generic toast.
        if (errBody.code === "too_far" || errBody.code === "low_accuracy" || errBody.code === "no_partner_geo") {
          setError(errBody.error);
          setStep("geo-denied");
          return;
        }
        throw new Error(errBody.error || `Error ${res.status}`);
      }
      setStep("success");
    } catch (e: any) {
      setError(e.message || "Algo salió mal. Intenta de nuevo.");
      setStep("error");
    }
  };

  // Hard error — bad screenId or partner not approved. Block before
  // the customer wastes time picking a style.
  if (error && step === "pick-style" && !businessName) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 to-violet-950 text-white">
        <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
        <p className="text-center text-white/80">{error}</p>
      </div>
    );
  }

  // ── STEP: pick style ───────────────────────────────────────────────────
  if (step === "pick-style") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white p-5">
        <div className="max-w-md mx-auto">
          <div className="text-center mt-6 mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-violet-500/20 border border-violet-400/30 rounded-full px-3 py-1 text-xs font-medium text-violet-200">
              <Tv className="h-3.5 w-3.5" /> {businessName || "AdScreenPro"}
            </div>
            <h1 className="text-3xl font-bold leading-tight">
              Sale en pantalla
            </h1>
            <p className="text-sm text-white/60">
              Elige cómo quieres aparecer. Será una sorpresa cuando se vea en la TV.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setStyle(s.id); setStep("take-photo"); }}
                className="aspect-square rounded-xl bg-white/5 border border-white/10 hover:bg-violet-500/20 hover:border-violet-400/50 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 p-3"
              >
                <span className="text-4xl" aria-hidden>{s.emoji}</span>
                <span className="text-sm font-medium text-white/90">{s.label}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-[10px] text-white/30 mt-8 leading-relaxed">
            Al participar aceptas que tu transformación aparezca temporalmente en la pantalla del local. Caduca en 8h.
          </p>
        </div>
      </div>
    );
  }

  // ── STEP: take photo ───────────────────────────────────────────────────
  if (step === "take-photo") {
    const selectedStyle = STYLES.find((s) => s.id === style);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white p-5">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => { setStep("pick-style"); setFile(null); setPreviewUrl(""); }}
            className="text-xs text-white/50 hover:text-white mb-4"
          >
            ← Cambiar estilo
          </button>

          <div className="text-center mb-6 space-y-1">
            <div className="text-5xl" aria-hidden>{selectedStyle?.emoji}</div>
            <h2 className="text-xl font-semibold">{selectedStyle?.label}</h2>
            <p className="text-xs text-white/50">Toma una foto clara de tu cara</p>
          </div>

          {previewUrl ? (
            <div className="rounded-xl overflow-hidden border-2 border-violet-400/40 mb-4">
              <img src={previewUrl} alt="" className="w-full aspect-square object-cover" />
            </div>
          ) : (
            <label className="block">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-violet-400/50 hover:bg-violet-500/5 transition-all mb-4">
                <Camera className="h-12 w-12 text-white/40" />
                <span className="text-sm text-white/60">Toca para tomar foto</span>
              </div>
            </label>
          )}

          {previewUrl && (
            <button
              onClick={() => { setFile(null); setPreviewUrl(""); }}
              className="text-xs text-white/50 hover:text-white mb-4 mx-auto block"
            >
              Tomar otra foto
            </button>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (opcional)"
            maxLength={40}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 placeholder:text-white/30 text-white mb-4 text-sm focus:outline-none focus:border-violet-400/50"
          />

          <button
            onClick={handleSubmit}
            disabled={!file}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Tv className="h-5 w-5" />
            Mostrar en la TV
          </button>

          {error && (
            <p className="text-center text-xs text-red-400 mt-3">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── STEP: loading ──────────────────────────────────────────────────────
  // ~45s wait. Show rotating taglines so the customer doesn't feel
  // they're staring at a static loader.
  if (step === "loading") {
    return <LoadingScreen />;
  }

  // ── STEP: success ──────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-violet-900 via-fuchsia-900 to-slate-900 text-white">
        <div className="text-7xl mb-4 animate-bounce">📺</div>
        <h2 className="text-3xl font-bold mb-2 text-center">¡Listo!</h2>
        <p className="text-center text-white/70 mb-1">Mira la TV</p>
        <p className="text-center text-sm text-white/50 mb-8 max-w-xs">
          Aparecerás en {businessName} en los próximos minutos. Caduca en 8h.
        </p>
        <button
          onClick={() => {
            setStep("pick-style");
            setFile(null);
            setPreviewUrl("");
            setStyle("");
            setName("");
          }}
          className="text-sm text-violet-300 hover:text-violet-200"
        >
          Cerrar
        </button>
      </div>
    );
  }

  // ── STEP: geo-denied ───────────────────────────────────────────────────
  // Customer is not at the partner location — physically too far,
  // GPS too imprecise, or they denied the permission prompt. Show
  // a friendly "you have to be at the business" screen with a
  // retry button (in case they were in the doorway and just need
  // to step inside).
  if (step === "geo-denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 text-white">
        <div className="text-7xl mb-4">📍</div>
        <h2 className="text-2xl font-bold mb-2 text-center">
          Tienes que estar en el negocio
        </h2>
        <p className="text-center text-white/70 max-w-sm mb-2 text-sm leading-relaxed">
          {error || `Para que tu selfie aparezca en la TV de ${businessName}, necesitas estar dentro del local.`}
        </p>
        <p className="text-center text-white/50 text-xs max-w-sm mb-8">
          Activa el GPS de alta precisión en tu teléfono y vuelve a intentar.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { setStep("take-photo"); setError(""); }}
            className="px-6 py-3 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium"
          >
            Intentar de nuevo
          </button>
          <button
            onClick={() => { setStep("pick-style"); setFile(null); setPreviewUrl(""); setStyle(""); setError(""); }}
            className="text-xs text-white/40 hover:text-white/60"
          >
            Empezar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: error ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 to-red-950 text-white">
      <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
      <p className="text-center text-white/80 max-w-xs mb-6">{error}</p>
      <button
        onClick={() => { setStep("take-photo"); setError(""); }}
        className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}

// ── Loading screen ─────────────────────────────────────────────────────────
function LoadingScreen() {
  const [tip, setTip] = useState(0);
  const TIPS = [
    "Mezclando pixeles mágicos…",
    "El AI está pensando…",
    "Casi listo, no cierres la pantalla",
    "La sorpresa está cerca",
    "Esto vale la pena, prometido",
  ];
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white overflow-hidden">
      <div className="relative mb-8">
        <div className="text-7xl animate-pulse" aria-hidden>🔮</div>
        <div className="absolute inset-0 rounded-full blur-3xl bg-violet-500/40 -z-10" />
      </div>
      <h2 className="text-2xl font-semibold mb-3 text-center">Generando tu sorpresa</h2>
      <p className="text-sm text-white/60 text-center max-w-xs min-h-[2.5rem]">
        {TIPS[tip]}
      </p>
      <div className="mt-10 w-48 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-[loading_45s_linear]" style={{ animation: "loading 45s linear forwards" }} />
      </div>
      <style>{`@keyframes loading { from { width: 0% } to { width: 95% } }`}</style>
    </div>
  );
}
