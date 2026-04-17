import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllPartners } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

const PartnersScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: partners, isLoading } = useAllPartners();
  const queryClient = useQueryClient();
  const [actionPartner, setActionPartner] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editPartner, setEditPartner] = useState<{ id: string; address: string } | null>(null);

  const handleSaveAddress = async () => {
    if (!editPartner) return;
    // Geocodificar para obtener coordenadas
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const clean = editPartner.address.replace(/,?\s*(United States|Estados Unidos.*?)$/i, "").replace(/(\d{5})-\d{4}/, "$1").trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`);
      const data = await res.json();
      if (data.length > 0) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
    } catch { /* silent */ }

    const updates: Record<string, any> = { address: editPartner.address };
    if (lat !== null) { updates.lat = lat; updates.lng = lng; }

    const { error } = await supabase.from("partners").update(updates).eq("id", editPartner.id);
    if (error) toast.error(error.message);
    else {
      toast.success(lat !== null ? "Dirección y coordenadas actualizadas" : "Dirección guardada (sin coordenadas)");
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    }
    setEditPartner(null);
  };

  const handleAction = async () => {
    if (!actionPartner) return;
    const { id, action } = actionPartner;
    const updates: any = action === "approve"
      ? { status: "approved", approved_at: new Date().toISOString() }
      : { status: "rejected" };

    const { error } = await supabase.from("partners").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }

    toast.success(action === "approve" ? tA.partnerApproved : tA.partnerRejected);
    queryClient.invalidateQueries({ queryKey: ["admin-partners"] });

    // When approving: sync GoAffPro + auto-publish active sales template
    if (action === "approve") {
      // 1. Sync GoAffPro (non-critical)
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-goaffpro-affiliate`;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ partner_id: id }),
        });
      } catch {
        // non-critical
      }

      // 2. Auto-publish active sales template to this partner's screen
      try {
        const { data: tpl } = await supabase
          .from("sales_templates" as any)
          .select("image_url, qr_base_url")
          .eq("is_active", true)
          .maybeSingle();

        if (tpl) {
          const qrUrl = `https://adscreenpro.com/register?role=advertiser&ref=${id}`;
          await supabase.from("ads").insert({
            advertiser_id: id,
            type: ((tpl as any).type ?? "image") as const,
            final_media_path: (tpl as any).image_url,
            status: "published" as const,
            screen_id: id,
            qr_url: qrUrl,
          } as any);
        }
      } catch {
        // non-critical — template ad failure doesn't block approval
      }
    }

    setActionPartner(null);
    setRejectReason("");
  };

  const statusColor = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.business}</TableHead>
              <TableHead>{tA.contact}</TableHead>
              <TableHead>{tA.email}</TableHead>
              <TableHead>{tA.status}</TableHead>
              <TableHead></TableHead>
              <TableHead>{tA.registeredAt}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.business_name}</TableCell>
                <TableCell>{p.contact_name}</TableCell>
                <TableCell className="text-muted-foreground">{(p as any).profiles?.email ?? p.contact_email}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(p.status)}>{
                    p.status === "approved" ? tA.approved : p.status === "rejected" ? tA.rejected : tA.pending
                  }</Badge>
                </TableCell>
                <TableCell>
                  <button onClick={() => setEditPartner({ id: p.id, address: (p as any).address ?? "" })} className="text-muted-foreground hover:text-primary" title={(p as any).address || "Sin dirección"}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {p.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setActionPartner({ id: p.id, action: "approve" })}>{tA.approve}</Button>
                      <Button size="sm" variant="destructive" onClick={() => setActionPartner({ id: p.id, action: "reject" })}>{tA.reject}</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editPartner} onOpenChange={() => setEditPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar dirección</DialogTitle>
            <DialogDescription>Ingresa la dirección completa del negocio para que aparezca en el mapa.</DialogDescription>
          </DialogHeader>
          <Input
            value={editPartner?.address ?? ""}
            onChange={(e) => setEditPartner(ep => ep ? { ...ep, address: e.target.value } : null)}
            placeholder="123 Main St, Raleigh, NC 27601"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartner(null)}>Cancelar</Button>
            <Button onClick={handleSaveAddress}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionPartner} onOpenChange={() => { setActionPartner(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionPartner?.action === "approve" ? tA.approve : tA.reject}</DialogTitle>
            {actionPartner?.action === "reject" && (
              <DialogDescription>{tA.rejectReason}</DialogDescription>
            )}
          </DialogHeader>
          {actionPartner?.action === "reject" && (
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={tA.rejectReason} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionPartner(null)}>{tA.cancel}</Button>
            <Button onClick={handleAction} variant={actionPartner?.action === "reject" ? "destructive" : "default"}>{tA.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnersScreen;
