import { useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { usePartnerProfile, usePartnerReferrals, usePartnerEarnings, useRegisterGoAffPro } from "@/hooks/usePartnerData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, TrendingUp, DollarSign, Info } from "lucide-react";

const ReportsScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;
  const { data: profile } = usePartnerProfile();
  const { data: referrals, isLoading: loadingRefs } = usePartnerReferrals();
  const { data: earnings, isLoading: loadingEarnings } = usePartnerEarnings();
  const registerGoAffPro = useRegisterGoAffPro();

  // Auto-register in GoAffPro silently when partner first enters dashboard
  useEffect(() => {
    if (profile && !(profile as any).goaffpro_affiliate_id && !registerGoAffPro.isPending && !registerGoAffPro.isSuccess && !registerGoAffPro.isError) {
      registerGoAffPro.mutate();
    }
  }, [profile]);

  const isLoading = loadingRefs || loadingEarnings;

  // Stats
  const activeCount = referrals?.filter((r) => r.is_active).length ?? 0;
  const totalEarnings = earnings?.reduce((sum, e) => sum + Number(e.amount_usd), 0) ?? 0;

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const thisMonthEarnings = earnings
    ?.filter((e) => e.month?.startsWith(currentMonth))
    .reduce((sum, e) => sum + Number(e.amount_usd), 0) ?? 0;

  const recentReferrals = [...(referrals ?? [])].slice(0, 4);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending approval warning */}
      {profile?.status !== "approved" && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3 text-yellow-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{tP.pendingApproval}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tP.activeAdvertisers}</p>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tP.thisMonthEarnings}</p>
              <p className="text-2xl font-bold text-foreground">${thisMonthEarnings.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tP.totalEarnings}</p>
              <p className="text-2xl font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission calculator */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-primary font-semibold">{tP.commissionInfo}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[1, 3, 5].map((n) => (
              <div
                key={n}
                className="rounded-xl bg-background border border-primary/15 p-3 text-center"
              >
                <p className="text-xs text-muted-foreground mb-1">{n} anunciante{n > 1 ? "s" : ""}</p>
                <p className="text-lg font-extrabold text-foreground">${(n * 60 * 0.2).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">/ mes</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Comisión permanente mientras el anunciante esté activo
          </p>
        </CardContent>
      </Card>

      {/* Recent advertisers */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{tP.recentAdvertisers}</h3>
        {recentReferrals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              {tP.noAdvertisersYet}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentReferrals.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">{r.business_name}</p>
                    {r.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.category}</p>
                    )}
                  </div>
                  <Badge variant={r.is_active ? "default" : "secondary"}>
                    {r.is_active ? tP.active : tP.inactive}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsScreen;
