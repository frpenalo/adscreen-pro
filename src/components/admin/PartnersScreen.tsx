import { useState, useEffect, useRef } from "react";
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
import { Pencil, RefreshCw, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

const PartnersScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: partners, isLoading } = useAllPartners();
  const queryClient = useQueryClient();
  const [actionPartner, setActionPartner] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Extended with lat/lng so the edit dialog can show a map and let
  // admin fine-tune the location after geocoding. Nominatim's default
  // for the address can be 50-200m off (strip malls, plazas), which
  // breaks the 60m selfie geofence — manual pin fixes it once.
  const [editPartner, setEditPartner] = useState<{ id: string; address: string; lat: number | null; lng: number | null } | null>(null);
  const [rerendering, setRerendering] = useState<string | null>(null); // partner id being re-rendered
  const [renderingAll, setRenderingAll] = useState(false); // despliegue masivo v2 en curso
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  // Tracks whether the admin dragged the marker manually. If so, we
  // persist those coords as-is on save instead of re-geocoding from
  // the address text and overwriting the manual adjustment.
  const manuallyAdjustedRef = useRef(false);
  // Leaflet map + marker refs (imperative API — same pattern as
  // ScreensMapScreen). Held in refs because they don't drive React
  // render; they're mutable map objects living in the DOM.
  const editMapRef = useRef<HTMLDivElement | null>(null);
  const editMapInstanceRef = useRef<any>(null);
  const editMarkerRef = useRef<any>(null);

  // Geocode an address via Nominatim and move the map marker there.
  // Used by the "Buscar dirección" button. Manual adjustment flag is
  // cleared so a subsequent save uses these fresh coords.
  const geocodeAndMoveMarker = async () => {
    if (!editPartner?.address) return;
    setGeocodingAddress(true);
    try {
      const clean = editPartner.address
        .replace(/,?\s*(United States|Estados Unidos.*?)$/i, "")
        .replace(/(\d{5})-\d{4}/, "$1")
        .trim();
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`,
        { headers: { "Accept-Language": "es" } },
      );
      const data = await res.json();
      if (data.length === 0) {
        toast.error("No encontré esa dirección. Revisa el formato.");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setEditPartner((ep) => (ep ? { ...ep, lat, lng } : null));
      manuallyAdjustedRef.current = false;
      if (editMapInstanceRef.current && editMarkerRef.current) {
        editMarkerRef.current.setLatLng([lat, lng]);
        editMapInstanceRef.current.setView([lat, lng], 18);
      }
    } catch {
      toast.error("Error consultando el geocoder. Intenta de nuevo.");
    } finally {
      setGeocodingAddress(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!editPartner) return;
    const updates: Record<string, any> = { address: editPartner.address };
    if (editPartner.lat !== null && editPartner.lng !== null) {
      updates.lat = editPartner.lat;
      updates.lng = editPartner.lng;
    }

    const { error } = await supabase.from("partners").update(updates).eq("id", editPartner.id);
    if (error) toast.error(error.message);
    else {
      toast.success(
        manuallyAdjustedRef.current
          ? "Dirección y posición exacta guardadas"
          : (editPartner.lat !== null ? "Dirección y coordenadas actualizadas" : "Dirección guardada (sin coordenadas)"),
      );
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    }
    setEditPartner(null);
  };

  // Initialize the Leaflet map inside the edit dialog. Runs when the
  // dialog opens (editPartner changes from null → a partner) and tears
  // down when it closes. Uses the same imperative L.map() pattern as
  // ScreensMapScreen so we have one consistent way of using Leaflet
  // in the codebase.
  useEffect(() => {
    if (!editPartner || !editMapRef.current) return;

    // Default center: Raleigh NC (where most partners are) if the
    // partner has no coords yet. Once they enter address + geocode
    // or drag, the marker takes over.
    const initialLat = editPartner.lat ?? 35.7796;
    const initialLng = editPartner.lng ?? -78.6382;

    let cleanedUp = false;
    import("leaflet").then((L) => {
      if (cleanedUp || !editMapRef.current) return;
      // Fix default marker icon URLs (broken by bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(editMapRef.current, {
        center: [initialLat, initialLng],
        zoom: editPartner.lat !== null ? 18 : 11,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        manuallyAdjustedRef.current = true;
        setEditPartner((ep) => (ep ? { ...ep, lat: pos.lat, lng: pos.lng } : null));
      });

      editMapInstanceRef.current = map;
      editMarkerRef.current = marker;
    });

    return () => {
      cleanedUp = true;
      if (editMapInstanceRef.current) {
        editMapInstanceRef.current.remove();
        editMapInstanceRef.current = null;
        editMarkerRef.current = null;
      }
      manuallyAdjustedRef.current = false;
    };
    // Only re-run when the dialog opens for a different partner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPartner?.id]);

  const handleRerender = async (partnerId: string) => {
    setRerendering(partnerId);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-render`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ partner_id: partnerId }),
      });
      if (res.ok) toast.success("Re-render iniciado (~2 min)");
      else toast.error("Error al iniciar re-render");
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setRerendering(null);
    }
  };

  // Despliegue masivo: dispara teaser v2 + SalesAd v3 para TODOS los partners.
  // Llama a la edge function render-all (admin-only), que lee el ref code real
  // de cada partner y dispara los workflows nuevos de GitHub Actions.
  const handleRenderAll = async () => {
    if (
      !window.confirm(
        "¿Renderizar el teaser v2 + SalesAd v3 para TODOS los partners?\n\n" +
          "Esto dispara los workflows de GitHub Actions (2 por partner). " +
          "Los videos estarán listos en unos minutos.",
      )
    )
      return;
    setRenderingAll(true);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-all`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teaser: true, salesAd: true }),
      });
      const data = await res.json();
      if (res.ok) {
        const fails = data.failed?.length ?? 0;
        toast.success(
          `Renders disparados: ${data.triggered} para ${data.total} partners` +
            (fails > 0 ? ` · ${fails} fallaron` : ""),
        );
        if (fails > 0) console.warn("render-all fallos:", data.failed);
      } else {
        toast.error(`Error: ${data.error ?? res.status}`);
      }
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setRenderingAll(false);
    }
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
      // 0. Backfill geo coords if partner has address but no lat/lng.
      //    Cause: AddressAutocomplete on signup only sets coords when
      //    the user clicks a dropdown suggestion. Partners who typed
      //    their address without selecting get registered with
      //    lat=null, lng=null — which then makes the 60m selfie
      //    geofence reject everyone. This step auto-geocodes via
      //    Nominatim so approval always leaves the partner with
      //    valid coords. Admin can still fine-tune later with the
      //    map-picker in the address editor.
      try {
        const { data: existing } = await supabase
          .from("partners")
          .select("address, lat, lng")
          .eq("id", id)
          .single();
        const hasNoCoords = existing && (existing.lat == null || existing.lng == null);
        if (hasNoCoords && (existing as any)?.address) {
          const clean = (existing as any).address
            .replace(/,?\s*(United States|Estados Unidos.*?)$/i, "")
            .replace(/(\d{5})-\d{4}/, "$1")
            .trim();
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`,
            { headers: { "Accept-Language": "es" } },
          );
          const data = await res.json();
          if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            await supabase.from("partners").update({ lat, lng }).eq("id", id);
          }
        }
      } catch {
        // non-critical — admin can fix manually via the map-picker
      }

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

      // 2. Auto-generar código de referido AdScreenPro (non-critical)
      //    Mismo formato que usaba el botón "Generar mi código" del partner.
      //    Upsert evita error si ya existía un código previo.
      //    Nota: requiere unique constraint en partner_qr_codes.partner_id
      //    (ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (partner_id)).
      try {
        const referralCode = `REF-${id.slice(0, 8).toUpperCase()}`;
        const { error: qrErr } = await supabase
          .from("partner_qr_codes")
          .upsert({ partner_id: id, code: referralCode }, { onConflict: "partner_id" });
        if (qrErr) {
          // Antes este error se tragaba en silencio. Ahora lo vemos para
          // poder diagnosticar problemas de RLS / constraint sin volver
          // a quedar a ciegas como pasó con la tabla sin índice único.
          toast.warning(`Código de referido: ${qrErr.message}`);
        }
      } catch (e: any) {
        toast.warning(`Código de referido falló: ${e?.message ?? "error desconocido"}`);
      }

      // 3. Disparar render de video personalizado con QR del partner
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-render`;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const renderRes = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ partner_id: id }),
        });
        if (renderRes.ok) {
          toast.info("Video personalizado en proceso (~2 min)");
        }
      } catch {
        // non-critical — render failure doesn't block approval
      }

      // 4. Auto-publicar todos los productos activos a la pantalla del partner
      //    Sin esto, partners nuevos quedaban con la pantalla vacía hasta que
      //    el admin re-publicaba cada producto manualmente. Depende del paso 1
      //    (sync-goaffpro-affiliate) porque cada producto se publica con la
      //    URL afiliada partner.goaffpro_referral_link.
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-products-to-partner`;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const pubRes = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ partner_id: id }),
        });
        if (pubRes.ok) {
          const pubJson = await pubRes.json().catch(() => ({}));
          const n = (pubJson as any)?.published ?? 0;
          if (n > 0) {
            toast.info(`${n} productos agregados a su pantalla`);
          }
        }
      } catch {
        // non-critical — admin can re-publish products manually later
      }
    }

    setActionPartner(null);
    setRejectReason("");
  };

  const statusColor = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleRenderAll}
          disabled={renderingAll}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {renderingAll ? "Disparando renders…" : "🎬 Renderizar todos (v2)"}
        </button>
      </div>
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditPartner({
                      id: p.id,
                      address: (p as any).address ?? "",
                      lat: (p as any).lat ?? null,
                      lng: (p as any).lng ?? null,
                    })} className="text-muted-foreground hover:text-primary" title={(p as any).address || "Sin dirección"}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {p.status === "approved" && (
                      <button
                        onClick={() => handleRerender(p.id)}
                        disabled={rerendering === p.id}
                        className="text-muted-foreground hover:text-primary disabled:opacity-50"
                        title="Re-renderizar video SalesAd"
                      >
                        <RefreshCw className={`h-4 w-4 ${rerendering === p.id ? "animate-spin" : ""}`} />
                      </button>
                    )}
                  </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar dirección y ubicación</DialogTitle>
            <DialogDescription>
              Ingresa la dirección, búscala en el mapa, y arrastra el pin al punto exacto del negocio. La ubicación precisa es necesaria para el geofence de selfies (60m de tolerancia).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={editPartner?.address ?? ""}
                onChange={(e) => setEditPartner(ep => ep ? { ...ep, address: e.target.value } : null)}
                placeholder="123 Main St, Raleigh, NC 27601"
              />
              <Button
                variant="outline"
                onClick={geocodeAndMoveMarker}
                disabled={!editPartner?.address || geocodingAddress}
                className="flex-shrink-0"
              >
                {geocodingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1.5">Buscar</span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {editPartner && editPartner.lat !== null && editPartner.lng !== null
                ? "📍 Arrastra el pin para ajustar al punto exacto donde está el negocio (entrada del local, no la calle)."
                : "Escribe la dirección y dale a Buscar para ubicar en el mapa."}
            </p>

            <div
              ref={editMapRef}
              className="w-full rounded-md border border-border overflow-hidden"
              style={{ height: 380 }}
            />

            {editPartner && editPartner.lat !== null && editPartner.lng !== null && (
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                {editPartner.lat.toFixed(6)}, {editPartner.lng.toFixed(6)}
              </p>
            )}
          </div>

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
