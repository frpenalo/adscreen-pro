import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Sparkles, Tv, AlertCircle, Download, Share2, Calendar, Instagram } from "lucide-react";
import { toPng } from "html-to-image";
import { BrandedCard } from "@/components/selfie/BrandedCard";

// Shape of the row returned by get_selfie_status RPC. The polling
// transitions to step "result-ready" once status === "published"
// (background AI job finished) or "rejected" (failed — we then show
// a graceful error instead of looping forever).
interface SelfieResult {
  status: string;
  final_media_path: string | null;
  customer_name: string | null;
  customer_title: string | null;
  style: string | null;
  business_name: string | null;
  booking_url: string | null;
  instagram_handle: string | null;
}

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

type Step = "pick-style" | "take-photo" | "loading" | "success" | "waiting-result" | "result-ready" | "error";

// Polling cadence for the background AI job. The customer's phone hits
// get_selfie_status() every 4s after submit until the status flips from
// "draft" to "published" (or "rejected"). 4s = fast enough that the
// customer feels something is happening, slow enough that a partner
// with 10 simultaneous selfies doesn't get DDOS'd by their RPC.
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 120_000; // 2 min — gpt-image-2 worst case

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
  // Result polling: when the customer submits, we get back an adId.
  // We then poll get_selfie_status every POLL_INTERVAL_MS until the
  // status flips to "published" (success) or "rejected" (AI failed).
  const [adId, setAdId] = useState<string | null>(null);
  const [result, setResult] = useState<SelfieResult | null>(null);
  // Ref to the hidden BrandedCard DOM node — html-to-image rasterizes
  // this to a PNG blob for download/share. Lives off-screen so it
  // doesn't affect layout.
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the partner's business name to show on the success screen.
  // Uses a SECURITY DEFINER RPC instead of a direct table read because
  // RLS on `partners` only allows authenticated users to SELECT —
  // anon customers scanning the QR would get null back and see
  // "Pantalla no encontrada" even for valid partners. The RPC exposes
  // only business_name + status (no contact info, no financial data).
  useEffect(() => {
    if (!screenId) return;
    supabase
      .rpc("get_partner_for_selfie", { p_id: screenId })
      .then(({ data, error: rpcErr }) => {
        const row = Array.isArray(data) ? data[0] : null;
        if (rpcErr || !row) {
          setError("Pantalla no encontrada");
          return;
        }
        if (row.status !== "approved") {
          setError("Esta pantalla no está activa todavía");
          return;
        }
        setBusinessName(row.business_name);
      });
  }, [screenId]);

  // ── Poll for AI result ────────────────────────────────────────────────
  // Once we have an adId (set after submit), poll get_selfie_status
  // every POLL_INTERVAL_MS. The status flips from "draft" to
  // "published" when the background EdgeRuntime.waitUntil task
  // finishes uploading the generated image. Transition to result-ready
  // when ready, or back to error if it took too long / was rejected.
  useEffect(() => {
    if (!adId || step !== "waiting-result") return;
    const startedAt = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const { data, error: rpcErr } = await supabase
        .rpc("get_selfie_status", { p_ad_id: adId });
      const row = Array.isArray(data) ? data[0] : null;
      if (rpcErr || !row) {
        // Transient — retry on next interval. Don't fail hard yet.
        return;
      }
      if (row.status === "published" && row.final_media_path) {
        setResult(row);
        setStep("result-ready");
        cancelled = true;
        return;
      }
      if (row.status === "rejected") {
        setError("La transformación no pudo completarse. Intenta de nuevo con otra foto.");
        setStep("error");
        cancelled = true;
        return;
      }
      // Timeout — give up after POLL_TIMEOUT_MS
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setError("El AI tardó demasiado. Aún puede aparecer en la TV en unos minutos — vuelve a mirar.");
        setStep("success"); // fall back to "Listo, mira la TV" screen
        cancelled = true;
      }
    };

    // Fire once immediately + start interval
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [adId, step]);

  // Rasterize the hidden BrandedCard DOM into a PNG blob. Used by
  // both download (saveAs) and share (Web Share API with files).
  const renderCardPng = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      // pixelRatio: 1 because the card already declares 1080x1920 in
      // CSS pixels. Bumping pixelRatio would output 2160x3840 — too
      // heavy for an iPhone to share via Instagram Stories.
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#000",
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (e) {
      console.error("Card render failed:", e);
      return null;
    }
  };

  const handleDownload = async () => {
    const blob = await renderCardPng();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adscreenpro-${result?.customer_name ?? "selfie"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const blob = await renderCardPng();
    if (!blob) return;
    const file = new File([blob], "adscreenpro.png", { type: "image/png" });
    const shareText = result?.business_name
      ? `Acabo de salir en la TV de @${result.instagram_handle ?? result.business_name} vía @adscreenpro 🔥`
      : `Mira mi transformación AI vía @adscreenpro 🔥`;
    // Web Share API with files — supported on iOS Safari, Chrome
    // mobile, most modern mobile browsers. Falls back to download
    // if files aren't supported (older browsers).
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: shareText,
        });
      } catch {
        // User cancelled — silent
      }
    } else {
      // Fallback: just trigger download
      handleDownload();
    }
  };

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
      // El geofence por GPS se quitó (demasiada fricción). La defensa son
      // los rate limits + la moderación de contenido por IA en el servidor.
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
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error ${res.status}`);
      }
      // The edge function returns { adId, expiresAt, message } after
      // inserting the placeholder row. Stash the adId — the polling
      // effect below uses it to detect when the background AI job
      // finishes and transition the UI to the result-ready screen.
      const body = await res.json().catch(() => ({}));
      if (body.adId) setAdId(body.adId);
      setStep("waiting-result");
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
            Al participar aceptas que tu transformación aparezca temporalmente en la pantalla del local. Caduca en 1 hora.
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

  // ── STEP: waiting-result ───────────────────────────────────────────────
  // After submit, the edge function returned 200 quickly but the
  // background AI job is still running. Show an anticipation screen
  // ("we're making something special") while polling for status.
  // Calibrated to ~60-90s expected wait. Different from "loading"
  // (pre-submit) because here the customer KNOWS the wait is for
  // AI generation, and the messaging should hype the upcoming reveal
  // on the TV rather than feel like a generic loading spinner.
  if (step === "waiting-result") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-violet-900 via-fuchsia-900 to-slate-900 text-white overflow-hidden">
        <div className="relative mb-8">
          <div className="text-7xl animate-pulse" aria-hidden>📺</div>
          <div className="absolute inset-0 rounded-full blur-3xl bg-fuchsia-500/40 -z-10" />
        </div>
        <h2 className="text-3xl font-bold mb-2 text-center">Generando tu momento</h2>
        <p className="text-center text-white/70 max-w-sm mb-6">
          Saldrás <strong>2 veces</strong> en la pantalla de <strong>{businessName}</strong> en la próxima hora.<br />
          Después podrás descargarlo y compartirlo.
        </p>
        <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-400 to-violet-400"
            style={{ animation: "loading 90s linear forwards" }}
          />
        </div>
        <p className="text-xs text-white/40 text-center max-w-xs">
          Esto toma 1-2 min. Puedes guardar la página y volver a mirar la TV.
        </p>
        <style>{`@keyframes loading { from { width: 0% } to { width: 95% } }`}</style>
      </div>
    );
  }

  // ── STEP: result-ready ─────────────────────────────────────────────────
  // The AI finished. Show the branded card (the asset the customer
  // can take home), download/share buttons, and CTAs to drive
  // commercial action (booking / IG follow) for the partner.
  //
  // The hidden BrandedCard div is rendered off-screen for
  // html-to-image rasterization — the on-screen preview is a
  // CSS-scaled version of the same component to guarantee what they
  // see matches what they download.
  if (step === "result-ready" && result) {
    const igHandle = result.instagram_handle?.replace(/^@/, "");
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white px-4 py-8">
        {/* Hidden BrandedCard for rasterization. position:absolute +
            left:-9999 keeps it out of the viewport but rendered in
            the DOM so html-to-image can read it. */}
        <div style={{ position: "absolute", left: -99999, top: 0 }}>
          <BrandedCard
            ref={cardRef}
            imageUrl={result.final_media_path ?? ""}
            name={result.customer_name}
            title={result.customer_title}
            businessName={result.business_name ?? businessName}
            style={result.style ?? style}
          />
        </div>

        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-4">
            <div className="text-4xl mb-2">🎬</div>
            <h1 className="text-2xl font-bold">¡Ya estás en la TV!</h1>
            <p className="text-sm text-white/60 mt-1">
              Tu momento en <strong>{result.business_name ?? businessName}</strong>
            </p>
            <p className="text-sm text-fuchsia-300/90 mt-1">
              Sales <strong>2 veces</strong> en la pantalla durante la próxima hora 👀
            </p>
          </div>

          {/* Preview of the card — scaled-down 9:16 */}
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 mx-auto"
               style={{ aspectRatio: "9/16", maxHeight: "55vh" }}>
            <img
              src={result.final_media_path ?? ""}
              alt={result.customer_title ?? "Selfie"}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title badge */}
          {result.customer_title && (
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold tracking-widest uppercase px-4 py-1.5 rounded-full text-sm">
                {result.customer_title}
              </div>
            </div>
          )}

          {/* Download + Share buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-sm active:scale-[0.98] transition"
            >
              <Download className="h-4 w-4" />
              Descargar
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-sm active:scale-[0.98] transition"
            >
              <Share2 className="h-4 w-4" />
              Compartir
            </button>
          </div>

          {/* CTAs — only render when partner has filled them in.
              Avoids broken buttons that go nowhere. */}
          {(result.booking_url || igHandle) && (
            <div className="space-y-3 pt-6 border-t border-white/10">
              <p className="text-center text-sm text-white/60">
                ¿Te gustó tu sesión en {result.business_name ?? businessName}?
              </p>
              {result.booking_url && (
                <a
                  href={result.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-slate-900 font-semibold text-sm active:scale-[0.98] transition"
                >
                  <Calendar className="h-4 w-4" />
                  Reserva tu próximo corte
                </a>
              )}
              {igHandle && (
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-sm active:scale-[0.98] transition"
                >
                  <Instagram className="h-4 w-4" />
                  Sigue a @{igHandle}
                </a>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setStep("pick-style");
              setFile(null);
              setPreviewUrl("");
              setStyle("");
              setName("");
              setAdId(null);
              setResult(null);
            }}
            className="block mx-auto text-xs text-white/40 hover:text-white/70 mt-4"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: success ──────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-violet-900 via-fuchsia-900 to-slate-900 text-white">
        <div className="text-7xl mb-4 animate-bounce">📺</div>
        <h2 className="text-3xl font-bold mb-2 text-center">¡Listo!</h2>
        <p className="text-center text-white/70 mb-1">Mira la TV</p>
        <p className="text-center text-sm text-white/50 mb-8 max-w-xs">
          Saldrás <strong>2 veces</strong> en la pantalla de {businessName} durante la próxima hora.
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
// Wait is now ~1-2s — validation + insert. The actual AI generation
// runs in the background after the server responds, so the customer
// doesn't sit on this screen. Animation calibrated for the short
// wait: progress bar fills over 5s (so it never looks stuck), tips
// rotate but rarely get past the first one.
function LoadingScreen() {
  const [tip, setTip] = useState(0);
  const TIPS = [
    "Enviando tu foto…",
    "Casi listo…",
  ];
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white overflow-hidden">
      <div className="relative mb-8">
        <div className="text-7xl animate-pulse" aria-hidden>🔮</div>
        <div className="absolute inset-0 rounded-full blur-3xl bg-violet-500/40 -z-10" />
      </div>
      <h2 className="text-2xl font-semibold mb-3 text-center">Preparando tu sorpresa</h2>
      <p className="text-sm text-white/60 text-center max-w-xs min-h-[2.5rem]">
        {TIPS[tip]}
      </p>
      <div className="mt-10 w-48 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ animation: "loading 5s linear forwards" }} />
      </div>
      <style>{`@keyframes loading { from { width: 0% } to { width: 95% } }`}</style>
    </div>
  );
}
