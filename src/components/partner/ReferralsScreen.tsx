import { useEffect, useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { usePartnerReferrals, usePartnerEarnings, usePartnerQrCode, usePartnerProfile } from "@/hooks/usePartnerData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, QrCode, Users, ExternalLink } from "lucide-react";
// FASE 2: import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const ReferralsScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;
  const { data: referrals } = usePartnerReferrals();
  const { data: earnings } = usePartnerEarnings();
  const { data: qrCode } = usePartnerQrCode();
  const { data: profile } = usePartnerProfile();

  // Accumulated earnings per advertiser
  const accMap = new Map<string, number>();
  const lastMonthMap = new Map<string, number>();
  earnings?.forEach((e) => {
    accMap.set(e.advertiser_id, (accMap.get(e.advertiser_id) ?? 0) + Number(e.amount_usd));
  });
  const sortedEarnings = [...(earnings ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  sortedEarnings.forEach((e) => {
    if (!lastMonthMap.has(e.advertiser_id)) {
      lastMonthMap.set(e.advertiser_id, Number(e.amount_usd));
    }
  });

  const referralUrl = qrCode
    ? `${window.location.origin}/register?role=advertiser&ref=${qrCode.code}`
    : null;

  const handleCopyLink = () => {
    if (referralUrl) {
      navigator.clipboard.writeText(referralUrl);
      toast.success(tP.linkCopied);
    }
  };

  // ── Vertical SalesAd video for social-media download ────────────────────────
  // The video lives at a predictable Storage path:
  //   {SUPABASE_URL}/storage/v1/object/public/ad-media/partner-sales-ads-vertical/{partner_id}.mp4
  // It's generated alongside the horizontal SalesAd whenever an admin approves
  // the partner. We HEAD-check it on mount so the download button only shows
  // up for partners whose render has completed (older partners approved
  // before this feature shipped won't have one until admin re-renders them).
  const partnerId = qrCode?.partner_id;
  const [verticalUrl, setVerticalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId) { setVerticalUrl(null); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/ad-media/partner-sales-ads-vertical/${partnerId}.mp4`;
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((res) => { if (!cancelled && res.ok) setVerticalUrl(url); })
      .catch(() => { /* file not yet rendered — keep button hidden */ });
    return () => { cancelled = true; };
  }, [partnerId]);

  const [downloading, setDownloading] = useState(false);

  const handleDownloadVertical = async () => {
    if (!verticalUrl || downloading) return;
    const businessName = (profile as any)?.business_name ?? "adscreenpro";
    const safeName = String(businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // The HTML `download` attribute is ignored when the file is on a
    // different origin (Supabase Storage vs our Hostinger app), so the
    // browser opens the MP4 inline instead of saving it. Workaround:
    // fetch the bytes ourselves into a blob, create a same-origin
    // object URL, and trigger the download from that.
    setDownloading(true);
    try {
      const res = await fetch(verticalUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeName}-vertical.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Free the memory after the download has been initiated.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      toast.error(`No se pudo descargar: ${e?.message ?? "error desconocido"}`);
    } finally {
      setDownloading(false);
    }
  };

  // FASE 2: link de Shopify con código de referido
  // const shopifyReferralCode = (profile as any)?.referral_code;
  // const shopifyLink = shopifyReferralCode ? `https://regalove.co/?ref=${shopifyReferralCode}` : null;

  return (
    <div className="space-y-6">

      {/* QR / Referral link — sólo se muestra cuando el admin ya generó el código */}
      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              {tP.qrSection}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referralUrl!)}`}
                alt="QR Code"
                className="w-48 h-48 rounded-xl border border-border"
              />
              <div className="flex-1 space-y-3">
                <p className="text-xs text-muted-foreground">Comparte este link o QR con negocios que quieran anunciarse:</p>
                <p className="text-xs font-mono bg-muted px-3 py-2 rounded-lg text-foreground break-all">{referralUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-1.5" /> {tP.copyLink}
                  </Button>
                  {verticalUrl && (
                    <Button size="sm" variant="default" onClick={handleDownloadVertical} disabled={downloading}>
                      <Download className={`h-4 w-4 mr-1.5 ${downloading ? "animate-pulse" : ""}`} />
                      {downloading ? "Descargando..." : "Descargar video para redes"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advertisers list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {tP.referrals} ({referrals?.length ?? 0})
          </h3>
        </div>

        {(!referrals || referrals.length === 0) ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground text-sm">
              {tP.noReferrals}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{r.business_name}</p>
                    {r.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.category}</p>
                    )}
                    {r.activated_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Desde {new Date(r.activated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge variant={r.is_active ? "default" : "secondary"}>
                      {r.is_active ? tP.active : tP.inactive}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Acum. <span className="font-semibold text-foreground">${(accMap.get(r.id) ?? 0).toFixed(2)}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralsScreen;
