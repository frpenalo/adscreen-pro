import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerReferrals, usePartnerEarnings, usePartnerQrCode, usePartnerProfile } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, QrCode, Users, ExternalLink } from "lucide-react";
// FASE 2: import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const ReferralsScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;
  const { user } = useAuth();
  const { data: referrals } = usePartnerReferrals();
  const { data: earnings } = usePartnerEarnings();
  const { data: qrCode, refetch: refetchQr } = usePartnerQrCode();
  const { data: profile } = usePartnerProfile();
  const queryClient = useQueryClient();
  const [generatingQr, setGeneratingQr] = useState(false);

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

  const handleDownloadQr = () => {
    if (!referralUrl) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(referralUrl)}`;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = "referral-qr.png";
    a.click();
  };

  const handleGenerateCode = async () => {
    if (!user) return;
    setGeneratingQr(true);
    const code = `REF-${user.id.slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("partner_qr_codes").insert({ partner_id: user.id, code });
    if (error) toast.error(error.message);
    else {
      refetchQr();
      queryClient.invalidateQueries({ queryKey: ["partner-qr"] });
    }
    setGeneratingQr(false);
  };

  // FASE 2: link de Shopify con código de referido
  // const shopifyReferralCode = (profile as any)?.referral_code;
  // const shopifyLink = shopifyReferralCode ? `https://regalove.co/?ref=${shopifyReferralCode}` : null;

  return (
    <div className="space-y-6">

      {/* QR / Referral link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {tP.qrSection}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qrCode ? (
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(referralUrl!)}`}
                alt="QR Code"
                className="w-36 h-36 rounded-xl border border-border"
              />
              <div className="flex-1 space-y-3">
                <p className="text-xs text-muted-foreground">Comparte este link o QR con negocios que quieran anunciarse:</p>
                <p className="text-xs font-mono bg-muted px-3 py-2 rounded-lg text-foreground break-all">{referralUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-1.5" /> {tP.copyLink}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadQr}>
                    <Download className="h-4 w-4 mr-1.5" /> {tP.downloadQr}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">Genera tu código de referido para empezar a ganar comisiones.</p>
              <Button onClick={handleGenerateCode} disabled={generatingQr}>
                <QrCode className="h-4 w-4 mr-2" /> Generar mi código
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
