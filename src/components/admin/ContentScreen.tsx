import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { usePendingAds } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const ContentScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: ads, isLoading } = usePendingAds();
  const queryClient = useQueryClient();
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    if (!selectedAd) return;
    setProcessing(true);
    try {
      const res = await supabase.functions.invoke("approve-ad", {
        body: { ad_id: selectedAd.id, action: "approve" },
      });
      // YODECK INTEGRATION — comentado, pendiente evaluación
      // console.log("=== approve-ad response ===", JSON.stringify(res.data, null, 2));
      // if (res.data?.yodeck_debug) {
      //   console.log("=== YODECK DEBUG (from Edge Function) ===");
      //   console.log("Playlist ID:", res.data.yodeck_debug.playlist_id);
      //   console.log("Asset ID:", res.data.yodeck_debug.asset_id);
      //   console.log("Request URL:", res.data.yodeck_debug.request_url);
      //   console.log("Request Body:", JSON.stringify(res.data.yodeck_debug.request_body, null, 2));
      //   console.log("Response Status:", res.data.yodeck_debug.response_status);
      //   console.log("Response Body:", res.data.yodeck_debug.response_body);
      // }
      if (res.error) throw new Error(res.error.message);
      toast.success(tA.adApproved);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-ads"] });
      setSelectedAd(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAd) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("ads")
        .update({ status: "rejected", rejected_reason: rejectReason || null })
        .eq("id", selectedAd.id);
      if (error) throw error;

      await supabase.from("advertiser_notifications").insert({
        advertiser_id: selectedAd.advertiser_id,
        message: `Tu anuncio fue rechazado.${rejectReason ? ` Motivo: ${rejectReason}` : ""}`,
      });

      toast.success(tA.adRejected);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-ads"] });
      setSelectedAd(null);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (!ads?.length) return <p className="text-muted-foreground text-center py-12">{tA.noContent}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{tA.pendingContent}</h2>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.thumbnail}</TableHead>
              <TableHead>{tA.advertiser}</TableHead>
              <TableHead>{tA.type}</TableHead>
              <TableHead>{tA.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.map((ad) => (
              <TableRow key={ad.id} className="cursor-pointer" onClick={() => setSelectedAd(ad)}>
                <TableCell>
                  {ad.type === "image" && ad.final_media_path ? (
                    <img src={ad.final_media_path} alt="" className="h-12 w-20 object-cover rounded" />
                  ) : ad.type === "video" && ad.final_media_path ? (
                    <video src={ad.final_media_path} className="h-12 w-20 object-cover rounded" muted />
                  ) : (
                    <div className="h-12 w-20 bg-muted rounded" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {(ad as any).profiles?.advertisers?.business_name
                    ?? (ad as any).profiles?.partners?.business_name
                    ?? "—"}
                  {(ad as any).profiles?.partners?.business_name && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(partner)</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="secondary">{ad.type}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(ad.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedAd} onOpenChange={() => { setSelectedAd(null); setRejectReason(""); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tA.preview}</DialogTitle>
            <DialogDescription>
              {(selectedAd as any)?.profiles?.advertisers?.business_name
                ?? (selectedAd as any)?.profiles?.partners?.business_name
                ?? ""}
            </DialogDescription>
          </DialogHeader>
          {selectedAd?.type === "image" && selectedAd?.final_media_path && (
            <img src={selectedAd.final_media_path} alt="" className="w-full rounded-lg" />
          )}
          {selectedAd?.type === "video" && selectedAd?.final_media_path && (
            <video src={selectedAd.final_media_path} controls className="w-full rounded-lg" />
          )}
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={tA.rejectReason}
          />
          <DialogFooter>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {tA.rejectAd}
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? tA.approving : tA.approveAd}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentScreen;
