import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

// ── Página pública del cupón (/coupon/:couponId) ─────────────────────────────
// El cliente llega acá escaneando el QR del ad en la TV. Mobile-first.
// Flujo: ver oferta → "Reclamar" → código único → card persistida en
// localStorage (re-abrir el link muestra el código sin re-reclamar).

interface PublicCoupon {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
  expires_at: string | null;
  business_name: string | null;
  sold_out: boolean;
}

interface SavedClaim {
  code: string;
  title: string;
  businessName: string | null;
  terms: string | null;
  expiresAt: string | null;
}

// Mismo fingerprint que SelfiePage: UUID estable en localStorage + señales
// del browser, hasheado. Un dispositivo = un claim por cupón.
async function getFingerprint(): Promise<string> {
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

const claimStorageKey = (couponId: string) => `adscreenpro-coupon-${couponId}`;

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CouponPage() {
  const { couponId } = useParams<{ couponId: string }>();
  const [coupon, setCoupon] = useState<PublicCoupon | null>(null);
  const [claim, setClaim] = useState<SavedClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!couponId) return;

    // Si este dispositivo ya reclamó, mostrar la card directo sin fetch.
    const saved = localStorage.getItem(claimStorageKey(couponId));
    if (saved) {
      try {
        setClaim(JSON.parse(saved));
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem(claimStorageKey(couponId));
      }
    }

    (supabase.rpc as any)("get_public_coupon", { p_coupon_id: couponId })
      .then(({ data, error: rpcErr }: { data: PublicCoupon[] | null; error: any }) => {
        if (rpcErr || !data || data.length === 0) {
          setNotFound(true);
        } else {
          setCoupon(data[0]);
        }
        setLoading(false);
      });
  }, [couponId]);

  const handleClaim = async () => {
    if (!couponId || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const fp = await getFingerprint();
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-coupon`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ couponId, fp }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 410) setError("Este cupón ya no está disponible.");
        else if (res.status === 429) setError("Demasiados cupones reclamados hoy. Intenta mañana.");
        else setError("No se pudo reclamar el cupón. Intenta de nuevo.");
        return;
      }
      const saved: SavedClaim = {
        code: json.code,
        title: json.coupon.title,
        businessName: json.coupon.businessName,
        terms: json.coupon.terms,
        expiresAt: json.coupon.expiresAt,
      };
      localStorage.setItem(claimStorageKey(couponId), JSON.stringify(saved));
      setClaim(saved);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setClaiming(false);
    }
  };

  // ── Estados ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/70 animate-spin" />
      </div>
    );
  }

  if (notFound && !claim) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <XCircle className="h-12 w-12 text-white/50" />
        <p className="text-white text-xl font-semibold">Cupón no disponible</p>
        <p className="text-white/60 text-sm">
          Este cupón expiró o ya no está activo.
        </p>
      </div>
    );
  }

  // ── Card del código (ya reclamado) ──────────────────────────────────────
  if (claim) {
    const expiry = formatExpiry(claim.expiresAt);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            {/* Header del negocio */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-5 text-center">
              <p className="text-amber-950/70 text-xs font-bold tracking-[0.25em] uppercase">
                Cupón digital
              </p>
              <p className="text-amber-950 text-2xl font-extrabold mt-1 leading-tight">
                {claim.businessName ?? "AdScreenPro"}
              </p>
            </div>

            {/* Cuerpo */}
            <div className="bg-white px-6 py-6 text-center">
              <p className="text-slate-900 text-xl font-bold leading-snug">
                {claim.title}
              </p>

              {/* Código — el cliente lo muestra al staff */}
              <div className="mt-6 mb-2">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                  Muestra este código
                </p>
                <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl py-4 px-3">
                  <p className="text-slate-900 font-mono font-extrabold tracking-[0.15em]" style={{ fontSize: "1.9rem" }}>
                    {claim.code}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-emerald-600 mt-4">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Cupón reclamado</span>
              </div>

              <p className="text-slate-500 text-xs mt-3 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
                📸 Tómale un screenshot a esta pantalla para no perder tu código
              </p>

              {expiry && (
                <div className="flex items-center justify-center gap-1.5 text-slate-500 mt-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Válido hasta el {expiry}</span>
                </div>
              )}

              {claim.terms && (
                <p className="text-slate-400 text-[11px] leading-relaxed mt-4 border-t border-slate-100 pt-3">
                  {claim.terms}
                </p>
              )}
            </div>
          </div>

          <p className="text-white/40 text-center text-xs mt-6 tracking-widest uppercase">
            AdScreenPro
          </p>
        </div>
      </div>
    );
  }

  // ── Oferta sin reclamar ─────────────────────────────────────────────────
  const expiry = formatExpiry(coupon?.expires_at ?? null);
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-6">
          <Ticket className="h-8 w-8 text-amber-950" />
        </div>

        {coupon?.business_name && (
          <p className="text-amber-300 text-sm font-semibold tracking-widest uppercase mb-2">
            {coupon.business_name}
          </p>
        )}

        <h1 className="text-white text-3xl font-extrabold leading-tight">
          {coupon?.title}
        </h1>

        {coupon?.description && (
          <p className="text-white/70 text-base mt-3 leading-relaxed">
            {coupon.description}
          </p>
        )}

        {expiry && (
          <div className="flex items-center justify-center gap-1.5 text-white/50 mt-4">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Válido hasta el {expiry}</span>
          </div>
        )}

        {coupon?.sold_out ? (
          <div className="mt-8 bg-white/10 rounded-2xl py-4 px-6">
            <p className="text-white/80 font-semibold">Cupón agotado</p>
            <p className="text-white/50 text-sm mt-1">
              Ya se reclamaron todos los cupones disponibles.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="mt-8 w-full bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-extrabold text-lg rounded-2xl py-4 shadow-xl active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {claiming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Reclamando...
                </span>
              ) : (
                "Reclamar mi cupón"
              )}
            </button>
            <p className="text-white/40 text-xs mt-3">
              Sin registro. Recibes un código al instante.
            </p>
          </>
        )}

        {error && (
          <p className="text-red-300 text-sm mt-4 bg-red-500/10 rounded-xl py-2 px-4">
            {error}
          </p>
        )}

        {coupon?.terms && (
          <p className="text-white/30 text-[11px] leading-relaxed mt-8">
            {coupon.terms}
          </p>
        )}

        <p className="text-white/30 text-center text-xs mt-6 tracking-widest uppercase">
          AdScreenPro
        </p>
      </div>
    </div>
  );
}
