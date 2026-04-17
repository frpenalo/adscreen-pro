import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserAds, useAdvertiserProfile, useAdImpressions, useAdImpressionsDetail, useAdClicks } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { Trash2, Image as ImageIcon, Video, BarChart2, Monitor, QrCode } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const MyAdsScreen = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: ads, isLoading } = useAdvertiserAds();
  const { data: profile } = useAdvertiserProfile();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailAdId, setDetailAdId] = useState<string | null>(null);

  const adIds = (ads ?? []).map((a) => a.id);
  const { data: impressions } = useAdImpressions(adIds);
  const { data: clicks } = useAdClicks(adIds);
  const { data: detail, isLoading: loadingDetail } = useAdImpressionsDetail(detailAdId);

  const statusLabel = (s: string) =>
    ({
      draft: t.advertiserDashboard.draft,
      approved: t.advertiserDashboard.approved,
      published: t.advertiserDashboard.published,
      rejected: t.advertiserDashboard.rejected,
    })[s] ?? s;

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    setDeleting(true);
    try {
      const ad = ads?.find((a) => a.id === deleteId);
      if (!ad) return;

      if (ad.final_media_path) {
        try {
          const url = new URL(ad.final_media_path);
          const pathParts = url.pathname.split("/storage/v1/object/public/ad-media/");
          if (pathParts[1]) {
            await supabase.storage.from("ad-media").remove([pathParts[1]]);
          }
        } catch {}
      }

      const { error } = await supabase.from("ads").delete().eq("id", deleteId);
      if (error) throw error;

      toast({ title: t.advertiserDashboard.deleteAd });
      queryClient.invalidateQueries({ queryKey: ["advertiser-ads"] });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">...</div>;
  }

  if (!ads || ads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>{t.advertiserDashboard.noAds}</p>
      </div>
    );
  }

  const detailAd = ads.find((a) => a.id === detailAdId);

  return (
    <div className="space-y-4">
      {ads.map((ad) => {
        const total = impressions?.[ad.id] ?? 0;
        const clickCount = clicks?.[ad.id] ?? 0;
        return (
          <Card
            key={ad.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setDetailAdId(ad.id)}
          >
            <CardContent className="p-4 flex gap-4 items-start">
              {/* Thumbnail */}
              <div className="w-24 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {ad.final_media_path ? (
                  ad.type === "video" ? (
                    <video src={ad.final_media_path} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={ad.final_media_path} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  ad.type === "video" ? <Video className="h-6 w-6 text-muted-foreground" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {ad.type === "image" ? t.advertiserDashboard.image : t.advertiserDashboard.video}
                  </Badge>
                  <Badge className={`text-xs ${statusColors[ad.status]}`}>
                    {statusLabel(ad.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ad.created_at).toLocaleDateString()}
                </p>
                {ad.status === "rejected" && ad.rejected_reason && (
                  <p className="text-xs text-destructive">
                    {t.advertiserDashboard.rejectedReason}: {ad.rejected_reason}
                  </p>
                )}
                {/* Impressions + Clicks */}
                {(total > 0 || clickCount > 0) && (
                  <div className="flex items-center gap-3 pt-0.5">
                    {total > 0 && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <BarChart2 className="h-3.5 w-3.5" />
                        {total.toLocaleString()} impresiones
                      </span>
                    )}
                    {clickCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <QrCode className="h-3.5 w-3.5" />
                        {clickCount.toLocaleString()} escaneos
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteId(ad.id); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Detail Sheet */}
      <Sheet open={!!detailAdId} onOpenChange={() => setDetailAdId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Estadísticas del anuncio
            </SheetTitle>
          </SheetHeader>

          {/* Thumbnail */}
          {detailAd?.final_media_path && (
            <div className="w-full h-40 rounded-lg overflow-hidden bg-muted mb-4">
              {detailAd.type === "video" ? (
                <video src={detailAd.final_media_path} className="w-full h-full object-contain" muted controls />
              ) : (
                <img src={detailAd.final_media_path} alt="" className="w-full h-full object-contain" />
              )}
            </div>
          )}

          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !detail || detail.total === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aún no hay impresiones registradas para este anuncio.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-primary/10 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{detail.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Impresiones</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-600">
                    {(clicks?.[detailAdId!] ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Escaneos QR</p>
                </div>
              </div>

              {/* Por día */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Por día</h3>
                <div className="space-y-2">
                  {Object.entries(detail.byDay)
                    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                    .slice(0, 14)
                    .map(([day, count]) => (
                      <div key={day} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{day}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 bg-primary rounded-full"
                            style={{ width: `${Math.max(8, (count / detail.total) * 120)}px` }}
                          />
                          <span className="font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Por pantalla */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Monitor className="h-4 w-4" />
                  Por pantalla
                </h3>
                <div className="space-y-2">
                  {Object.entries(detail.byLocation)
                    .sort((a, b) => b[1] - a[1])
                    .map(([loc, count]) => (
                      <div key={loc} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[180px]">{loc}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.advertiserDashboard.deleteConfirm}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t.advertiserDashboard.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {t.advertiserDashboard.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAdsScreen;
