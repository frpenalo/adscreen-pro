import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import {
  Ticket, Plus, Pause, Play, Archive, Copy, CheckCircle2, XCircle, Loader2, QrCode,
} from "lucide-react";

// ── Pestaña "Cupones" del dashboard advertiser ───────────────────────────────
// Crear/pausar cupones digitales, ver stats (reclamados/canjeados) y canjear
// el código que el cliente muestra en el negocio.
//
// Nota de tipos: coupons/coupon_claims aún no están en los types generados
// de Supabase — los casts (supabase as any) se quitan cuando se regeneren.

interface Coupon {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
  expires_at: string | null;
  max_claims: number | null;
  status: "active" | "paused" | "archived";
  created_at: string;
}

interface ClaimRow {
  coupon_id: string;
  redeemed_at: string | null;
}

const couponUrl = (id: string) => `${window.location.origin}/coupon/${id}`;

export default function CouponsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Datos ────────────────────────────────────────────────────────────────
  const { data: coupons, isLoading } = useQuery({
    queryKey: ["advertiser-coupons", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("advertiser_id", user!.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: claims } = useQuery({
    queryKey: ["advertiser-coupon-claims", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ClaimRow[]> => {
      // RLS limita a claims de cupones propios
      const { data, error } = await (supabase as any)
        .from("coupon_claims")
        .select("coupon_id, redeemed_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const statsFor = (couponId: string) => {
    const rows = claims?.filter((c) => c.coupon_id === couponId) ?? [];
    return {
      claimed: rows.length,
      redeemed: rows.filter((r) => r.redeemed_at !== null).length,
    };
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["advertiser-coupons"] });
    queryClient.invalidateQueries({ queryKey: ["advertiser-coupon-claims"] });
  };

  // ── Canje de código ──────────────────────────────────────────────────────
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    setRedeemResult(null);
    try {
      const { data, error } = await (supabase.rpc as any)(
        "redeem_coupon_claim",
        { p_code: code },
      );
      if (error) throw error;
      if (data.status === "redeemed") {
        setRedeemResult({ ok: true, message: `Canjeado: ${data.title}` });
        setRedeemCode("");
        refresh();
      } else if (data.status === "already_redeemed") {
        const when = new Date(data.redeemed_at).toLocaleString("es-US");
        setRedeemResult({ ok: false, message: `Este código ya fue canjeado el ${when}.` });
      } else {
        setRedeemResult({ ok: false, message: "Código no encontrado. Verifica e intenta de nuevo." });
      }
    } catch {
      setRedeemResult({ ok: false, message: "Error al canjear. Intenta de nuevo." });
    } finally {
      setRedeeming(false);
    }
  };

  // ── Crear cupón ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClaims, setMaxClaims] = useState("");

  const handleCreate = async () => {
    if (!title.trim() || !user || saving) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("coupons").insert({
        advertiser_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        terms: terms.trim() || null,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        max_claims: maxClaims ? parseInt(maxClaims, 10) : null,
      });
      if (error) throw error;
      toast({ title: "Cupón creado" });
      setTitle(""); setDescription(""); setTerms(""); setExpiresAt(""); setMaxClaims("");
      setShowForm(false);
      refresh();
    } catch {
      toast({ title: "No se pudo crear el cupón", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Cambiar estado ───────────────────────────────────────────────────────
  const setStatus = async (id: string, status: Coupon["status"]) => {
    const { error } = await (supabase as any)
      .from("coupons")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({ title: "No se pudo actualizar", variant: "destructive" });
    } else {
      refresh();
    }
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(couponUrl(id));
    toast({ title: "Link copiado" });
  };

  // ── QR expandido ─────────────────────────────────────────────────────────
  const [qrCouponId, setQrCouponId] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cupones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cupones digitales que tus clientes reclaman escaneando el QR de tu anuncio.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo cupón
        </Button>
      </div>

      {/* ── Canjear código ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Canjear código
          </CardTitle>
          <CardDescription>
            Teclea el código que el cliente muestra en su teléfono.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="ej. JOE-4F8K"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              className="font-mono tracking-widest uppercase"
              maxLength={12}
            />
            <Button onClick={handleRedeem} disabled={redeeming || !redeemCode.trim()}>
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Canjear"}
            </Button>
          </div>
          {redeemResult && (
            <div
              className={`mt-3 text-sm flex items-center gap-2 ${
                redeemResult.ok ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {redeemResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {redeemResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Formulario de creación ── */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nuevo cupón</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="coupon-title">Oferta *</Label>
              <Input
                id="coupon-title"
                placeholder='ej. "10% de descuento en tu primer corte"'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="coupon-desc">Descripción</Label>
              <Input
                id="coupon-desc"
                placeholder="Detalle breve de la oferta (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="coupon-terms">Términos y condiciones</Label>
              <Textarea
                id="coupon-terms"
                placeholder="ej. Válido solo de lunes a jueves. No acumulable. (opcional)"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                maxLength={300}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="coupon-expiry">Vence el</Label>
                <Input
                  id="coupon-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="coupon-max">Cantidad máxima</Label>
                <Input
                  id="coupon-max"
                  type="number"
                  min={1}
                  placeholder="Sin límite"
                  value={maxClaims}
                  onChange={(e) => setMaxClaims(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cupón"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lista de cupones ── */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !coupons || coupons.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Ticket className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Aún no tienes cupones. Crea el primero y agrega su QR a tu anuncio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => {
            const stats = statsFor(c.id);
            const expired = c.expires_at && new Date(c.expires_at) <= new Date();
            return (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{c.title}</p>
                        {expired ? (
                          <Badge variant="secondary">Vencido</Badge>
                        ) : c.status === "active" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Pausado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {stats.claimed} reclamados · {stats.redeemed} canjeados
                        {c.max_claims ? ` · cupo ${c.max_claims}` : ""}
                        {c.expires_at
                          ? ` · vence ${new Date(c.expires_at).toLocaleDateString("es-US")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        onClick={() => setQrCouponId(qrCouponId === c.id ? null : c.id)}
                      >
                        <QrCode className="h-3.5 w-3.5" /> QR
                      </Button>
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        onClick={() => copyLink(c.id)}
                      >
                        <Copy className="h-3.5 w-3.5" /> Link
                      </Button>
                      {c.status === "active" ? (
                        <Button variant="outline" size="sm" onClick={() => setStatus(c.id, "paused")}>
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setStatus(c.id, "active")}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setStatus(c.id, "archived")}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {qrCouponId === c.id && (
                    <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4">
                      <div className="bg-white p-3 rounded-xl">
                        <QRCodeCanvas value={couponUrl(c.id)} size={180} />
                      </div>
                      <p className="text-xs text-muted-foreground break-all text-center">
                        {couponUrl(c.id)}
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        Este QR va en tu anuncio — pídele al equipo de AdScreenPro
                        agregarlo si tu ad ya está publicado.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
