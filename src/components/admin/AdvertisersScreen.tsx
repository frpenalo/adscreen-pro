import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllAdvertisers } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AdvertisersScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: advertisers, isLoading } = useAllAdvertisers();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [rerendering, setRerendering] = useState<string | null>(null);
  // Phase 5 A/B: separate state so the spec test doesn't conflict with the
  // legacy re-render. Both can run in parallel for the same advertiser.
  const [testingSpec, setTestingSpec] = useState<string | null>(null);

  const handleRerender = async (advertiser: any) => {
    setRerendering(advertiser.id);
    try {
      // 1. Find the advertiser's latest rendered ad
      const { data: ads } = await supabase
        .from("ads")
        .select("id, metadata, final_media_path")
        .eq("advertiser_id", advertiser.id)
        .eq("type", "video")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!ads || ads.length === 0) {
        toast.error("No se encontró anuncio para re-renderizar");
        return;
      }

      const ad = ads[0];
      const adId = ad.id;

      // 2. photo_url: desde metadata (nuevos ads) o desde Storage (ads viejos)
      let photoUrl: string | null = (ad.metadata as any)?.photo_url ?? null;

      if (!photoUrl) {
        const { data: files } = await supabase.storage
          .from("ad-media")
          .list(`${advertiser.id}/ai-generated`, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });

        if (!files || files.length === 0) {
          toast.error("No se encontró la foto original. El advertiser debe recrear su anuncio.");
          return;
        }

        const { data: urlData } = supabase.storage
          .from("ad-media")
          .getPublicUrl(`${advertiser.id}/ai-generated/${files[0].name}`);
        photoUrl = urlData.publicUrl;
      }

      // 3. Disparar generate-ad-video
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad-video`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_id: adId,
          photo_url: photoUrl,
          business_name: advertiser.business_name,
          tagline: "",
          cta: "Visítanos",
          advertiser_id: advertiser.id,
          category: advertiser.category ?? "",
        }),
      });

      if (res.ok) toast.success("Re-render iniciado (~2 min)");
      else toast.error("Error al iniciar re-render");
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setRerendering(null);
    }
  };

  // ── Phase 5 A/B test: spec-driven render ───────────────────────────────────
  // Hits the new generate-spec-ad edge function instead of generate-ad-video.
  // Output goes to ad-media/advertiser-ads-spec/{ad_id}.mp4 (parallel path —
  // does NOT overwrite the production file or update the ads table).
  const handleTestSpec = async (advertiser: any) => {
    setTestingSpec(advertiser.id);
    try {
      // Same data lookup as the legacy re-render — find the latest video
      // ad for this advertiser to get its photo_url.
      const { data: ads } = await supabase
        .from("ads")
        .select("id, metadata, final_media_path")
        .eq("advertiser_id", advertiser.id)
        .eq("type", "video")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!ads || ads.length === 0) {
        toast.error("No se encontró anuncio para test (este advertiser no tiene ads aún)");
        return;
      }

      const ad = ads[0];
      let photoUrl: string | null = (ad.metadata as any)?.photo_url ?? null;

      if (!photoUrl) {
        const { data: files } = await supabase.storage
          .from("ad-media")
          .list(`${advertiser.id}/ai-generated`, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
        if (files && files.length > 0) {
          const { data: urlData } = supabase.storage
            .from("ad-media")
            .getPublicUrl(`${advertiser.id}/ai-generated/${files[0].name}`);
          photoUrl = urlData.publicUrl;
        }
      }

      if (!photoUrl) {
        toast.error("Foto original no encontrada — no se puede generar spec sin imagen");
        return;
      }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-spec-ad`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_id: ad.id,
          advertiser_id: advertiser.id,
          business_name: advertiser.business_name,
          category: advertiser.category ?? "other",
          tagline: (ad.metadata as any)?.tagline ?? "",
          cta: "Visítanos",
          photo_url: photoUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(`Error: ${json.error ?? "desconocido"}`);
        return;
      }

      // Surface the picked spec so the admin can see what was rolled BEFORE
      // the render finishes — useful for fast iteration on family rules.
      const s = json.spec_summary;
      toast.success(
        `Spec listo (familia: ${s.family}, font: ${(s.fontFamily ?? "").split(",")[0]}, CTA: ${s.cta_style}). Video en ~3 min en advertiser-ads-spec/${ad.id}.mp4`,
        { duration: 8000 }
      );
    } catch (e: any) {
      toast.error(`Error al conectar con el servidor: ${e?.message ?? ""}`);
    } finally {
      setTestingSpec(null);
    }
  };

  const filtered = advertisers?.filter((a) => {
    if (filter === "active") return a.is_active;
    if (filter === "inactive") return !a.is_active;
    return true;
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "active", "inactive"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? tA.all : f === "active" ? tA.active : tA.inactive}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.name}</TableHead>
              <TableHead>{tA.business}</TableHead>
              <TableHead>{tA.category}</TableHead>
              <TableHead>{tA.email}</TableHead>
              <TableHead>{tA.status}</TableHead>
              <TableHead>{tA.registeredAt}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.customer_name}</TableCell>
                <TableCell>{a.business_name}</TableCell>
                <TableCell>{a.category}</TableCell>
                <TableCell className="text-muted-foreground">{(a as any).profiles?.email}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "secondary"}>
                    {a.is_active ? tA.active : tA.inactive}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.activated_at ? new Date(a.activated_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRerender(a)}
                      disabled={rerendering === a.id}
                      className="text-muted-foreground hover:text-primary disabled:opacity-50"
                      title="Re-renderizar video del anuncio (legacy / producción)"
                    >
                      <RefreshCw className={`h-4 w-4 ${rerendering === a.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleTestSpec(a)}
                      disabled={testingSpec === a.id}
                      className="text-muted-foreground hover:text-primary disabled:opacity-50"
                      title="Generar versión spec-driven (A/B) — sube a advertiser-ads-spec/{id}.mp4 sin tocar producción"
                    >
                      <Sparkles className={`h-4 w-4 ${testingSpec === a.id ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


    </div>
  );
};

export default AdvertisersScreen;
