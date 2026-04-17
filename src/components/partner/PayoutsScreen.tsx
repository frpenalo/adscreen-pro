import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerProfile, usePartnerPayouts, usePartnerEarnings } from "@/hooks/usePartnerData";
// FASE 2: import { usePartnerCommissions } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wallet, Clock } from "lucide-react";
// FASE 2: import { ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "paid") return "default";
  if (s === "approved") return "secondary";
  if (s === "rejected") return "destructive";
  return "outline";
};

const statusLabel: Record<string, string> = {
  paid: "Pagado",
  approved: "Aprobado",
  rejected: "Rechazado",
  pending: "Pendiente",
};

const PayoutsScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;
  const { user } = useAuth();
  const { data: profile } = usePartnerProfile();
  const { data: payouts } = usePartnerPayouts();
  const { data: earnings } = usePartnerEarnings();
  // FASE 2: const { data: commissions } = usePartnerCommissions();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isApproved = profile?.status === "approved";

  const totalEarnings = earnings?.reduce((sum, e) => sum + Number(e.amount_usd), 0) ?? 0;
  // FASE 2: incluir comisiones de productos
  // const totalProductCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) ?? 0;
  // const totalEarnings = totalReferralEarnings + totalProductCommissions;
  const totalPaid = payouts
    ?.filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount_usd), 0) ?? 0;
  const availableBalance = totalEarnings - totalPaid;
  const canRequest = isApproved && availableBalance >= 50;

  const handleRequest = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      partner_id: user.id,
      amount_usd: availableBalance,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(tP.payoutRequested);
      queryClient.invalidateQueries({ queryKey: ["partner-payouts"] });
    }
    setSubmitting(false);
    setShowConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{tP.availableBalance}</p>
              <p className="text-4xl font-extrabold text-foreground mt-1">${availableBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">{tP.minPayout}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="mt-5">
            {!isApproved ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full block">
                    <Button disabled className="w-full">{tP.requestPayout}</Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{tP.notApprovedTooltip}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!canRequest}
                className="w-full"
              >
                {tP.requestPayout}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FASE 2: desglose de ganancias (referidos + productos GoAffPro) */}

      {/* Payout history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{tP.payoutHistory}</h3>
        </div>

        {(!payouts || payouts.length === 0) ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground text-sm">
              {tP.noPayouts}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">${Number(p.amount_usd).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                    {p.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">{p.rejection_reason}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant(p.status)}>
                    {statusLabel[p.status] ?? p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tP.requestPayout}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Vas a solicitar un retiro de:</p>
          <p className="text-3xl font-bold text-foreground">${availableBalance.toFixed(2)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>{tP.cancel}</Button>
            <Button onClick={handleRequest} disabled={submitting}>{tP.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsScreen;
