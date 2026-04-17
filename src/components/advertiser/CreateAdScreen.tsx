import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserProfile, useSubscription } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload, Camera, Sparkles, Video, AlertTriangle, ArrowLeft, Send, Loader2 } from "lucide-react";

const ACCEPTED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime"];
const ALL_ACCEPTED = [...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO];
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov";
const DEMO_EMAIL = "demo@adscreenpro.com";

const PLAN_LIMITS: Record<string, { ads: number }> = {
  basico:    { ads: 2 },
  pro:       { ads: 5 },
  unlimited: { ads: 999 },
};

type MediaType = "image" | "video" | null;

const CreateAdScreen = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: profile } = useAdvertiserProfile();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();

  // ── Media state ─────────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Ad creation state ────────────────────────────────────────────────────────
  const [adBusinessName, setAdBusinessName] = useState("");
  const [adTagline, setAdTagline] = useState("");
  const [adCta, setAdCta] = useState("Visítanos");

  // ── Processing state ─────────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);   // AI enhance step
  const [submitting, setSubmitting] = useState(false);    // final submit
  const [renderingAdId, setRenderingAdId] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // ── Poll for rendered video ──────────────────────────────────────────────────
  const { data: renderingAd } = useQuery({
    queryKey: ["rendering-ad-advertiser", renderingAdId],
    queryFn: async () => {
      const { data } = await supabase.from("ads").select("*").eq("id", renderingAdId!).single();
      return data;
    },
    enabled: !!renderingAdId,
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.final_media_path ? false : 5000;
    },
  });

  // ── Plan limits ──────────────────────────────────────────────────────────────
  const plan = (profile as any)?.plan ?? "basico";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basico;
  const lastReset = profile ? new Date((profile as any).last_month_reset || "2000-01-01") : new Date("2000-01-01");
  const now = new Date();
  const isNewMonth = lastReset.getFullYear() < now.getFullYear() || lastReset.getMonth() < now.getMonth();
  const adsUsed = isNewMonth ? 0 : ((profile as any)?.ads_this_month ?? 0);
  const remainingAds = limits.ads - adsUsed;

  const isActive = (subscription?.subscribed ?? false) || (profile?.is_active ?? false);
  const isDemo = user?.email === DEMO_EMAIL;

  // ── File validation ──────────────────────────────────────────────────────────
  const validateFile = async (f: File): Promise<string | null> => {
    const tAd = t.advertiserDashboard;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    const VIDEO_EXTS = ["mp4", "mov"];
    const mimeOk = ALL_ACCEPTED.includes(f.type);
    const extOk = IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext);
    if (!mimeOk && !extOk) return tAd.formatError;
    const isImage = ACCEPTED_IMAGE.includes(f.type) || IMAGE_EXTS.includes(ext);
    const isVideo = ACCEPTED_VIDEO.includes(f.type) || VIDEO_EXTS.includes(ext);
    if (isImage && f.size > 15 * 1024 * 1024) return tAd.imageSizeError.replace("{size}", (f.size / 1024 / 1024).toFixed(1));
    if (isVideo && f.size > 100 * 1024 * 1024) return tAd.videoSizeError.replace("{size}", (f.size / 1024 / 1024).toFixed(1));
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);
      const done = (result: string | null) => { clearTimeout(timeout); resolve(result); };
      const isValidRatio = (w: number, h: number) => { const r = w / h; return r >= 1.3 && r <= 2.4; };
      if (isImage) {
        const img = new window.Image();
        img.onload = () => {
          if (img.width <= img.height) { done(tAd.orientationError); URL.revokeObjectURL(img.src); return; }
          if (!isValidRatio(img.width, img.height)) { done("Tu imagen debe ser formato 16:9 (horizontal para TV)."); URL.revokeObjectURL(img.src); return; }
          done(null); URL.revokeObjectURL(img.src);
        };
        img.onerror = () => done(null);
        img.src = URL.createObjectURL(f);
      } else if (isVideo) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const r = video.videoWidth / video.videoHeight;
          if (r < 1.6 || r > 2.2) { done("Tu video debe ser horizontal (16:9)."); URL.revokeObjectURL(video.src); return; }
          if (video.duration > 30) done(tAd.durationError.replace("{duration}", Math.round(video.duration).toString()));
          else done(null);
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => done(null);
        video.src = URL.createObjectURL(f);
      } else done(null);
    });
  };

  const handleFileSelect = async (f: File) => {
    setError(null);
    const validationError = await validateFile(f);
    if (validationError) { setError(validationError); return; }
    const isImage = ACCEPTED_IMAGE.includes(f.type) || f.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i);
    const url = URL.createObjectURL(f);
    setFile(f);
    setMediaType(isImage ? "image" : "video");
    setPreviewUrl(url);
    setAdBusinessName(profile?.business_name ?? "");
  };

  // ── Compress image before sending to AI ─────────────────────────────────────
  const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const MAX_W = 1280;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = reject;
      img.src = url;
    });

  // ── Unified: AI enhance → animated video ────────────────────────────────────
  const handleCreateAd = async () => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!file || !user || processing) return;
    if (remainingAds <= 0) {
      toast({ title: "Alcanzaste el límite de anuncios este mes.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.refreshSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      // Step 1 — AI enhance image (category drives the style)
      const imageBase64 = await toBase64(file);
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad`;
      const fnRes = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: "image/jpeg",
          category: (profile as any)?.category ?? "",
          adText: adTagline.trim(),
        }),
      });
      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({}));
        throw new Error(err.error || `Error ${fnRes.status}`);
      }
      const aiRes = await fnRes.json();
      if (!aiRes.imageUrl) throw new Error("La IA no devolvió imagen. Intenta de nuevo.");

      // Step 2 — trigger Remotion render with enhanced image + text
      const { data: adData, error: insertErr } = await supabase
        .from("ads")
        .insert({ advertiser_id: user.id, type: "video", final_media_path: "", status: "draft" } as any)
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      const adId = (adData as any).id;
      const videoFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad-video`;
      await fetch(videoFnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_id: adId,
          photo_url: aiRes.imageUrl,
          business_name: adBusinessName.trim() || profile?.business_name || "",
          tagline: adTagline.trim(),
          cta: adCta.trim(),
          advertiser_id: user.id,
          category: (profile as any)?.category ?? "",
        }),
      });

      setRenderingAdId(adId);
      queryClient.invalidateQueries({ queryKey: ["advertiser-profile"] });
      toast({ title: "¡Procesando tu anuncio! Listo en ~2 minutos." });
    } catch (e: any) {
      toast({ title: e.message || "Error al crear el anuncio", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // ── Submit image directly (no AI) ────────────────────────────────────────────
  const handleSubmitImage = async () => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!user || !previewUrl || submitting) return;
    if (remainingAds <= 0) {
      toast({ title: "Alcanzaste el límite de anuncios este mes.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(previewUrl);
      const raw = await res.blob();
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("ad-media").upload(path, raw, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;
      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(path);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        type: "image" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
      });
      if (insertErr) throw insertErr;
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Nuevo anuncio pendiente de ${profile?.business_name ?? "un anunciante"}.`,
      });
      toast({ title: t.advertiserDashboard.adSentForReview });
      queryClient.invalidateQueries({ queryKey: ["advertiser-ads"] });
      resetState();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit video directly ────────────────────────────────────────────────────
  const handleSubmitVideo = async () => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!user || !file || submitting) return;
    setSubmitting(true);
    try {
      const path = `${user.id}/${Date.now()}.mp4`;
      const { error: uploadErr } = await supabase.storage.from("ad-media").upload(path, file, { contentType: "video/mp4" });
      if (uploadErr) throw uploadErr;
      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(path);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        type: "video" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
      });
      if (insertErr) throw insertErr;
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Nuevo video pendiente de ${profile?.business_name ?? "un anunciante"}.`,
      });
      toast({ title: t.advertiserDashboard.videoSentForReview });
      queryClient.invalidateQueries({ queryKey: ["advertiser-ads"] });
      resetState();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit rendered video ────────────────────────────────────────────────────
  const handleSubmitRenderedVideo = async () => {
    if (!renderingAd || !user || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from("ads").update({ status: "pending" }).eq("id", (renderingAd as any).id);
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Video animado pendiente de ${profile?.business_name ?? "un anunciante"}.`,
      });
      toast({ title: "Video enviado a revisión" });
      queryClient.invalidateQueries({ queryKey: ["advertiser-ads"] });
      resetState();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setError(null);
    setAdBusinessName("");
    setAdTagline("");
    setAdCta("Visítanos");
    setProcessing(false);
    setRenderingAdId(null);
  };

  const DemoModal = () => (
    <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.advertiserDashboard.demoModalTitle}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t.advertiserDashboard.demoModalDesc}</p>
        <DialogFooter><Button onClick={() => setShowDemoModal(false)}>{t.advertiserDashboard.demoModalOk}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── STEP 1: Upload ───────────────────────────────────────────────────────────
  if (!file) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${remainingAds > 0 ? "bg-primary/5 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
          <span>Anuncios este mes</span>
          <span>{remainingAds > 0 ? `${remainingAds} de ${limits.ads} disponibles` : "Límite alcanzado"}</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5" /> Sube tu foto o video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isActive ? (
              <>
                <label className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" /> {t.advertiserDashboard.uploadFile}
                  <input type="file" accept={ACCEPT_STRING} className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <label className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" /> {t.advertiserDashboard.takePhotoOrVideo}
                  <input type="file" accept="image/*,video/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                </label>
              </>
            ) : (
              <Button disabled className="w-full"><Upload className="h-4 w-4 mr-2" />{t.advertiserDashboard.uploadFile}</Button>
            )}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">📐 Formato requerido: 16:9 horizontal</p>
              <p>Imágenes: 1920×1080 px — Videos: grabados en modo paisaje</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
          </CardContent>
        </Card>
        <DemoModal />
      </div>
    );
  }

  // ── STEP 2: Video uploaded ───────────────────────────────────────────────────
  if (mediaType === "video") {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-5 w-5" /> Vista previa del video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <video src={previewUrl!} controls className="w-full rounded-lg" />
            <div className="flex items-start gap-2 p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {t.advertiserDashboard.videoAudioNote}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetState} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" /> {t.advertiserDashboard.cancel}
              </Button>
              <Button onClick={handleSubmitVideo} disabled={submitting} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {submitting ? "Enviando..." : t.advertiserDashboard.sendForReview}
              </Button>
            </div>
          </CardContent>
        </Card>
        <DemoModal />
      </div>
    );
  }

  // ── STEP 3: Image — create or send ──────────────────────────────────────────
  const videoReady = !!(renderingAd as any)?.final_media_path;

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Preview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <img src={previewUrl!} alt="Preview" className="w-full rounded-lg object-cover border border-border" style={{ aspectRatio: "16/9" }} />
          {!processing && !renderingAdId && (
            <Button variant="outline" size="sm" onClick={resetState}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Cambiar foto
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Option 1: Send as-is (always visible unless processing) */}
      {!processing && !renderingAdId && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">¿Tu diseño ya está listo?</p>
            <p className="text-xs text-muted-foreground">Envíalo directamente para aprobación sin modificar.</p>
            <Button onClick={handleSubmitImage} disabled={submitting} className="w-full" size="lg">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4 mr-2" /> Enviar para aprobación</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Divider */}
      {!processing && !renderingAdId && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium px-2">o crea tu anuncio con IA</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Option 2: AI + animated video */}
      {!processing && !renderingAdId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Crear anuncio animado con IA
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              La IA mejora tu foto y genera un video animado automáticamente.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={adBusinessName}
              onChange={(e) => setAdBusinessName(e.target.value)}
              placeholder="Nombre del negocio *"
            />
            <Input
              value={adTagline}
              onChange={(e) => setAdTagline(e.target.value)}
              placeholder="Texto del anuncio (opcional): ej. Corte $15 esta semana"
            />
            <Input
              value={adCta}
              onChange={(e) => setAdCta(e.target.value)}
              placeholder="Call to action: ej. Visítanos · 919-555-0101"
            />
            <Button
              className="w-full gap-2 mt-1"
              onClick={handleCreateAd}
              disabled={!adBusinessName.trim()}
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none" }}
              size="lg"
            >
              <Sparkles className="h-4 w-4" /> Mejorar con IA y animar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Processing: AI enhancement */}
      {processing && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
            <p className="font-medium text-foreground">Mejorando tu imagen con IA...</p>
            <p className="text-sm text-muted-foreground">Un momento, esto tarda unos segundos</p>
          </CardContent>
        </Card>
      )}

      {/* Processing: Remotion render */}
      {renderingAdId && !videoReady && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-medium text-foreground">Generando tu video animado...</p>
            <p className="text-sm text-muted-foreground">Esto toma ~2 minutos</p>
          </CardContent>
        </Card>
      )}

      {/* Video ready */}
      {renderingAdId && videoReady && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-medium text-green-700 flex items-center gap-2">
              ✅ ¡Tu video animado está listo!
            </p>
            <video
              src={(renderingAd as any).final_media_path}
              controls
              className="w-full rounded-lg border border-border"
            />
            <Button className="w-full gap-2" onClick={handleSubmitRenderedVideo} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a revisión
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={resetState}>
              Cancelar y empezar de nuevo
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center pb-4">
        Revisamos tu anuncio y lo publicamos en pantallas en menos de 24h.
      </p>

      <DemoModal />
    </div>
  );
};

export default CreateAdScreen;
