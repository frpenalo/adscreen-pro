import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllAdvertisers } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

// ── Test scenarios for the spec-driven pipeline ────────────────────────────
// One per category so we can validate every family without needing real
// advertisers in the database. Each scenario uses a stable Unsplash photo
// URL so re-running produces consistent input. The variations within the
// rolled family are still seeded by `advertiser_id`, so changing the seed
// (eg. by appending a counter) lets us see different rolls of the same
// family.
const TEST_SCENARIOS: Array<{
  label: string;
  category: string;
  business_name: string;
  tagline: string;
  photo_url: string;
}> = [
  {
    label: "Barber",
    category: "barber",
    business_name: "Fade Studio",
    tagline: "El mejor corte de la ciudad",
    photo_url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1920&h=1080&fit=crop",
  },
  {
    label: "Restaurant",
    category: "restaurant",
    business_name: "La Trattoria",
    tagline: "Auténtica cocina italiana",
    photo_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&h=1080&fit=crop",
  },
  {
    label: "Gym",
    category: "gym",
    business_name: "Iron Athletics",
    tagline: "Supera tus límites",
    photo_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&h=1080&fit=crop",
  },
  {
    label: "Balloon",
    category: "balloon",
    business_name: "Globos Felices",
    tagline: "Decoraciones únicas",
    photo_url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&h=1080&fit=crop",
  },
  {
    label: "Nightclub",
    category: "nightclub",
    business_name: "Pulse Lounge",
    tagline: "La noche es nuestra",
    photo_url: "https://images.unsplash.com/photo-1571266028243-d220c9c3b31f?w=1920&h=1080&fit=crop",
  },
  {
    label: "Bakery",
    category: "bakery",
    business_name: "Pan & Honra",
    tagline: "Horneado fresco cada día",
    photo_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1920&h=1080&fit=crop",
  },
  {
    label: "Yoga",
    category: "yoga",
    business_name: "Zen Studio",
    tagline: "Equilibrio y bienestar",
    photo_url: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1920&h=1080&fit=crop",
  },
  {
    label: "Jewelry",
    category: "jewelry",
    business_name: "Aurora Joyas",
    tagline: "Piezas únicas hechas a mano",
    photo_url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1920&h=1080&fit=crop",
  },
];

const AdvertisersScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: advertisers, isLoading } = useAllAdvertisers();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [rerendering, setRerendering] = useState<string | null>(null);
  // Phase 5 A/B: separate state so the spec test doesn't conflict with the
  // legacy re-render. Both can run in parallel for the same advertiser.
  const [testingSpec, setTestingSpec] = useState<string | null>(null);
  // Pure test panel state (no advertiser row needed).
  const [testingScenario, setTestingScenario] = useState<string | null>(null);

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

  // ── Test scenario runner ─────────────────────────────────────────────────
  // Doesn't require an existing advertiser. Picks one of the curated
  // TEST_SCENARIOS, generates a synthetic ad_id and advertiser_id, then
  // hits the same generate-spec-ad endpoint. Output lands in
  // advertiser-ads-spec/ for visual review — never touches production.
  const handleTestScenario = async (scenario: typeof TEST_SCENARIOS[0]) => {
    setTestingScenario(scenario.category);
    try {
      const adId = `spec-test-${scenario.category}`;
      const advertiserId = `test-advertiser-${scenario.category}`;

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
          ad_id: adId,
          advertiser_id: advertiserId,
          business_name: scenario.business_name,
          category: scenario.category,
          tagline: scenario.tagline,
          cta: "Visítanos",
          photo_url: scenario.photo_url,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(`Error: ${json.error ?? "desconocido"}`);
        return;
      }

      const s = json.spec_summary;
      toast.success(
        `${scenario.label} → familia "${s.family}", font ${(s.fontFamily ?? "").split(",")[0]}, CTA ${s.cta_style}. Video en ~3 min en advertiser-ads-spec/${adId}.mp4`,
        { duration: 12000 }
      );
    } catch (e: any) {
      toast.error(`Error al conectar con el servidor: ${e?.message ?? ""}`);
    } finally {
      setTestingScenario(null);
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
      {/* ── Test panel for the spec-driven pipeline (Phase 5) ── */}
      {/* Lives above the table so it's reachable even when there are no */}
      {/* advertisers in the system yet. Each scenario uses sample data + a   */}
      {/* stable Unsplash photo so the user can see how every family looks. */}
      <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Test spec pipeline</span>
          <span className="text-xs text-muted-foreground">
            (genera videos en advertiser-ads-spec/ — no toca pantallas)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEST_SCENARIOS.map((scenario) => (
            <Button
              key={scenario.category}
              size="sm"
              variant="outline"
              onClick={() => handleTestScenario(scenario)}
              disabled={testingScenario === scenario.category}
            >
              {testingScenario === scenario.category ? "..." : scenario.label}
            </Button>
          ))}
        </div>
      </div>

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
