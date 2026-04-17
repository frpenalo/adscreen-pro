import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle, Loader2 } from "lucide-react";

const USE_MOCK = false;

const SubscriptionScreen = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) return;

    if (USE_MOCK) {
      // In mock mode, reflect the real is_active flag from the DB
      // so pending accounts don't incorrectly show "Cuenta activa"
      try {
        const { data } = await supabase
          .from("advertisers")
          .select("is_active")
          .eq("id", user.id)
          .single();
        setSubscribed(data?.is_active ?? false);
      } catch {
        setSubscribed(false);
      }
      setSubscriptionEnd(null);
      setSubLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscribed(data.subscribed ?? false);
      setSubscriptionEnd(data.subscription_end ?? null);
    } catch {
      // silent
    } finally {
      setSubLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const handleCheckout = async () => {
    setCheckingOut(true);

    if (USE_MOCK) {
      // TODO: Replace with real call → supabase.functions.invoke("create-checkout")
      console.log("[MOCK] create-checkout called");
      await new Promise((r) => setTimeout(r, 1000));
      toast({
        title: "🧪 Modo desarrollo",
        description: "En producción se abriría Stripe Checkout aquí.",
      });
      setCheckingOut(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: t.advertiserDashboard.checkoutError, description: e.message, variant: "destructive" });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleManage = async () => {
    if (USE_MOCK) {
      // TODO: Replace with real call → supabase.functions.invoke("customer-portal")
      console.log("[MOCK] customer-portal called");
      toast({
        title: "🧪 Modo desarrollo",
        description: "En producción se abriría el portal de Stripe aquí.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleCancellation = async () => {
    if (!user) return;
    setCancelling(true);
    try {
      const { error } = await supabase.from("cancellation_requests").insert({
        advertiser_id: user.id,
        status: "new" as const,
      });
      if (error) throw error;
      toast({ title: t.advertiserDashboard.cancellationSent });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
      setShowCancel(false);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{t.advertiserDashboard.loadingSubscription}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {USE_MOCK && (
        <div className="rounded-md border border-dashed border-yellow-500 bg-yellow-50 p-3 text-center text-xs text-yellow-800">
          🧪 Modo mock activo — No se realizan cargos reales
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {t.advertiserDashboard.subscription}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscribed ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Badge className="bg-green-100 text-green-800 text-sm">{t.advertiserDashboard.activeAccount}</Badge>
              </div>
              {subscriptionEnd && (
                <p className="text-sm text-muted-foreground">
                  {t.advertiserDashboard.subscriptionUntil}: {new Date(subscriptionEnd).toLocaleDateString()}
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={handleManage}>
                {t.advertiserDashboard.manageSubscription}
              </Button>
              <Button variant="outline" className="w-full text-destructive" onClick={() => setShowCancel(true)}>
                {t.advertiserDashboard.requestCancellation}
              </Button>
            </>
          ) : (
            <>
              <div className="text-center py-6 space-y-2">
                <p className="text-3xl font-bold text-foreground">{t.advertiserDashboard.planPrice}</p>
                <p className="text-sm text-muted-foreground">{t.advertiserDashboard.plan}</p>
              </div>

              <Button className="w-full" onClick={handleCheckout} disabled={checkingOut}>
                {checkingOut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.advertiserDashboard.subscribeCta}
              </Button>

              <p className="text-xs text-muted-foreground text-center">{t.advertiserDashboard.afterPaymentNote}</p>
              <p className="text-xs text-muted-foreground text-center">Cancela en cualquier momento. Sin contratos.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.advertiserDashboard.cancellationConfirm}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancel(false)}>
              {t.advertiserDashboard.cancel}
            </Button>
            <Button variant="destructive" onClick={handleCancellation} disabled={cancelling}>
              {t.advertiserDashboard.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionScreen;
