import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserProfile } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { lastMonths, aggregateByScreen, tallyCoupons } from "@/lib/report-utils";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Download, FileText, Loader2, Eye, Ticket } from "lucide-react";

// ── Pestaña "Reportes" del dashboard advertiser ──────────────────────────────
// Agrega EN VIVO (queries del cliente, vía RLS del advertiser) las impresiones
// (ad_logs) y los cupones (coupon_claims) del mes elegido, y genera un PDF
// descargable. Reemplaza el envío por email (Resend) — el advertiser baja su
// reporte cuando quiere, sin servicios externos.

interface ReportData {
  impressions: number;
  byScreen: { screenId: string; impressions: number }[];
  couponsClaimed: number;
  couponsRedeemed: number;
}

// La lógica de meses y de agregación (lastMonths, aggregateByScreen,
// tallyCoupons) vive en @/lib/report-utils y tiene sus propios tests.

export default function ReportsScreen() {
  const { user } = useAuth();
  const { data: profile } = useAdvertiserProfile();
  const businessName = profile?.business_name ?? "Tu negocio";

  const months = useMemo(() => lastMonths(6), []);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const month = months.find((m) => m.key === monthKey) ?? months[0];

  const { data, isLoading } = useQuery({
    queryKey: ["advertiser-report", user?.id, monthKey],
    enabled: !!user,
    queryFn: async (): Promise<ReportData> => {
      // Las queries van en 2 fases paralelas en vez de 4 en fila:
      //   Fase 1 — ads y coupons (independientes entre sí).
      //   Fase 2 — ad_logs y coupon_claims (cada una depende de su id de la
      //            fase 1, pero no una de la otra).
      // Reduce la latencia del reporte ~a la mitad de los roundtrips.

      // Fase 1: ids del advertiser
      const [adsRes, couponsRes] = await Promise.all([
        supabase.from("ads").select("id").eq("advertiser_id", user!.id),
        (supabase as any).from("coupons").select("id").eq("advertiser_id", user!.id),
      ]);
      const adIds = (adsRes.data ?? []).map((a: any) => a.id);
      const couponIds = (couponsRes.data ?? []).map((c: any) => c.id);

      // Fase 2: impresiones y claims del mes (en paralelo)
      const [logsRes, claimsRes] = await Promise.all([
        adIds.length > 0
          ? supabase
              .from("ad_logs")
              .select("location_id")
              .in("ad_id", adIds)
              .gte("created_at", month.start)
              .lt("created_at", month.end)
          : Promise.resolve({ data: [] as any[] }),
        couponIds.length > 0
          ? (supabase as any)
              .from("coupon_claims")
              .select("redeemed_at")
              .in("coupon_id", couponIds)
              .gte("claimed_at", month.start)
              .lt("claimed_at", month.end)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const locationIds = (logsRes.data ?? []).map((l: any) => l.location_id);
      const impressions = locationIds.length;
      const byScreen = aggregateByScreen(locationIds);

      const claims = (claimsRes.data ?? []) as Array<{ redeemed_at?: unknown }>;
      const { claimed: couponsClaimed, redeemed: couponsRedeemed } = tallyCoupons(claims);

      return { impressions, byScreen, couponsClaimed, couponsRedeemed };
    },
  });

  const downloadPdf = () => {
    if (!data) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 48;

    // Header
    doc.setFillColor(245, 158, 11); // amber
    doc.rect(0, 0, W, 96, "F");
    doc.setTextColor(67, 20, 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ADSCREENPRO", M, 40);
    doc.setFontSize(22);
    doc.text(businessName, M, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Reporte de ${month.label}`, W - M, 70, { align: "right" });

    // Métricas grandes
    let y = 150;
    const cardW = (W - M * 2 - 16) / 2;
    const drawMetric = (x: number, value: string, label: string, rgb: [number, number, number]) => {
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(x, y, cardW, 90, 8, 8, "F");
      doc.setTextColor(...rgb);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(34);
      doc.text(value, x + 18, y + 48);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(label, x + 18, y + 72);
    };
    drawMetric(M, data.impressions.toLocaleString("es-US"), "Veces en pantalla", [180, 83, 9]);
    drawMetric(M + cardW + 16, String(data.couponsRedeemed), "Cupones canjeados", [21, 128, 61]);

    y += 120;
    if (data.couponsClaimed > 0) {
      doc.setTextColor(70, 70, 70);
      doc.setFontSize(12);
      doc.text(
        `${data.couponsClaimed} clientes reclamaron tu cupón · ${data.couponsRedeemed} lo usaron en tu negocio`,
        M, y,
      );
      y += 28;
    }

    // Desglose por pantalla
    if (data.byScreen.length > 0) {
      y += 12;
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("PANTALLA", M, y);
      doc.text("VISTAS", W - M, y, { align: "right" });
      y += 8;
      doc.setDrawColor(230, 230, 230);
      doc.line(M, y, W - M, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(12);
      for (const s of data.byScreen.slice(0, 20)) {
        doc.text(`Pantalla ${s.screenId.slice(0, 8)}`, M, y);
        doc.text(s.impressions.toLocaleString("es-US"), W - M, y, { align: "right" });
        y += 22;
      }
    }

    // Footer
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(10);
    doc.text(
      "Tu anuncio sigue trabajando para ti en pantallas de Raleigh.  ·  adscreenpro.com",
      M, doc.internal.pageSize.getHeight() - 36,
    );

    const safeName = businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    doc.save(`reporte-${safeName}-${month.key}.pdf`);
  };

  const hasActivity = data && (data.impressions > 0 || data.couponsClaimed > 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descarga el reporte de rendimiento de tu anuncio mes a mes.
        </p>
      </div>

      {/* Selector de mes */}
      <div className="flex flex-wrap items-center gap-2">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setMonthKey(m.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              m.key === monthKey
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 capitalize">
              <FileText className="h-5 w-5 text-primary" /> {month.label}
            </CardTitle>
            <CardDescription>{businessName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-amber-50 p-5">
                <div className="flex items-center gap-2 text-amber-700">
                  <Eye className="h-4 w-4" />
                  <span className="text-3xl font-extrabold">
                    {(data?.impressions ?? 0).toLocaleString("es-US")}
                  </span>
                </div>
                <p className="text-xs text-amber-900/70 uppercase tracking-wide mt-1">
                  Veces en pantalla
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-5">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Ticket className="h-4 w-4" />
                  <span className="text-3xl font-extrabold">
                    {data?.couponsRedeemed ?? 0}
                  </span>
                </div>
                <p className="text-xs text-emerald-900/70 uppercase tracking-wide mt-1">
                  Cupones canjeados
                </p>
              </div>
            </div>

            {data && data.couponsClaimed > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.couponsClaimed} clientes reclamaron tu cupón · {data.couponsRedeemed} lo usaron en tu negocio.
              </p>
            )}

            {data && data.byScreen.length > 0 && (
              <div className="text-sm">
                <p className="text-muted-foreground uppercase text-xs tracking-wide mb-2">Por pantalla</p>
                <div className="space-y-1">
                  {data.byScreen.slice(0, 10).map((s) => (
                    <div key={s.screenId} className="flex justify-between border-b border-border/50 py-1">
                      <span className="text-muted-foreground">Pantalla {s.screenId.slice(0, 8)}</span>
                      <span className="font-medium tabular-nums">{s.impressions.toLocaleString("es-US")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasActivity && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin actividad registrada en {month.label}.
              </p>
            )}

            <Button onClick={downloadPdf} disabled={!data} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" /> Descargar PDF
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
