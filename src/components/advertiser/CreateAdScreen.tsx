import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserProfile, useSubscription } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload, Camera, Sparkles, Video, AlertTriangle, ArrowLeft, Send, Loader2, CheckCircle2, ListChecks } from "lucide-react";

const ACCEPTED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime"];
const ALL_ACCEPTED = [...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO];
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov";
const DEMO_EMAIL = "demo@adscreenpro.com";

// Stages shown during the photo-enhancement wait. `min` is the elapsed
// second at which a stage becomes the current/active one. Calibrated
// against the typical generate-ad response time of ~60s — the bar caps
// before reaching the end so a slightly-slow API doesn't look stuck.
const ENHANCE_STAGES: Array<{ min: number; label: string; emoji: string }> = [
  { min: 0,  label: "Analizando tu foto",            emoji: "📸" },
  { min: 12, label: "Mejorando colores y luz",       emoji: "🎨" },
  { min: 28, label: "Generando estilo de comercial", emoji: "🎬" },
  { min: 48, label: "Aplicando últimos detalles",    emoji: "✨" },
];
const ENHANCE_TOTAL_SECONDS = 60;

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
  // Press-and-hold compare on the enhanced-photo card. While true, the
  // preview swaps to the original photo so the user can A/B with one tap.
  const [showingOriginal, setShowingOriginal] = useState(false);

  // ── Ad creation state ────────────────────────────────────────────────────────
  const [adBusinessName, setAdBusinessName] = useState("");
  const [adTagline, setAdTagline] = useState("");
  const [adCta, setAdCta] = useState("Visítanos");

  // ── Processing state ─────────────────────────────────────────────────────────
  // Two-phase flow:
  //   1. processing       — calling generate-ad to enhance the photo
  //   2. enhancedUrl set  — show the enhanced photo with a single "Send" button
  //   3. submitting       — calling generate-ad-video + inserting the ad row
  //   4. submittedSuccess — final state, user is done; their ad is rendering in
  //                         the background and will appear in "Mis Anuncios"
  //                         once admin approves.
  // The previous version polled for the rendered video here so the user could
  // see the final video before sending. The new flow ships the user away as
  // soon as they approve the enhanced PHOTO — the render runs out-of-band and
  // the user reviews the final video later in MyAdsScreen.
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // ── Enhancement progress (faked-but-believable timeline) ──────────────────
  // The real generate-ad call doesn't stream progress, so we track elapsed
  // seconds and show staged messages. The stages are calibrated against
  // the typical ~60s end-to-end time so the user always feels we're moving
  // forward. The progress bar caps at 95% on purpose — never reaches 100%
  // until the actual response arrives, which prevents the "stuck at 100%"
  // bad UX when the API takes a few extra seconds.
  const [enhancingSeconds, setEnhancingSeconds] = useState(0);

  useEffect(() => {
    if (!processing) {
      setEnhancingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setEnhancingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [processing]);

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

  // ── Phase 1: AI-enhance the photo ─────────────────────────────────────────
  // Calls the generate-ad edge function which improves the uploaded image.
  // On success we keep the URL in `enhancedUrl` and show the user a preview;
  // they then decide whether to send it for rendering+publication.
  const handleEnhancePhoto = async () => {
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

      const imageBase64 = await toBase64(file);
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad`;
      // NOTE: do NOT send the tagline / business name to the image-enhancing
      // step. The AI must produce a clean photo with NO text overlays. All
      // ad copy (headline, tagline, CTA) is composed by Remotion downstream
      // — the photo is just the visual base.
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
        }),
      });
      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({}));
        throw new Error(err.error || `Error ${fnRes.status}`);
      }
      const aiRes = await fnRes.json();
      if (!aiRes.imageUrl) throw new Error("La IA no devolvió imagen. Intenta de nuevo.");
      setEnhancedUrl(aiRes.imageUrl);
    } catch (e: any) {
      toast({ title: e.message || "Error al mejorar la imagen", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // ── Phase 2: Send for render + admin review ───────────────────────────────
  // The user has approved the enhanced photo. We:
  //   1. Insert the ad row in `pending` status (admin queue)
  //   2. Dispatch the Remotion render in the background
  //   3. Notify the admin
  //   4. Show the success state — user is done; can navigate away.
  // The Remotion render runs out-of-band and updates the ad row when finished.
  // The advertiser sees the final video in "Mis Anuncios" once it renders +
  // the admin approves it.
  const handleSendForRender = async () => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!user || !enhancedUrl || submitting) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.refreshSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      // Insert ad row — status "draft" puts it in the admin's review queue.
      // (The Postgres ad_status enum only allows draft / approved /
      // published / rejected, so we keep using "draft" the same way the
      // legacy direct-image and direct-video paths do.)
      // The admin sees pending ads in their queue, reviews the rendered
      // video once it lands, and flips status to "published" via the
      // approve-ad edge function.
      const { data: adData, error: insertErr } = await supabase
        .from("ads")
        .insert({
          advertiser_id: user.id,
          type: "video",
          final_media_path: "",
          status: "draft",
          metadata: { photo_url: enhancedUrl },
        } as any)
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      const adId = (adData as any).id;

      // Dispatch the Remotion render. Returns immediately — the workflow
      // runs on GitHub Actions and updates the ad's final_media_path
      // when finished. We don't block the user on this.
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
          photo_url: enhancedUrl,
          business_name: adBusinessName.trim() || profile?.business_name || "",
          tagline: adTagline.trim(),
          cta: adCta.trim(),
          advertiser_id: user.id,
          category: (profile as any)?.category ?? "",
        }),
      });

      // Notify the admin that there's a new ad to review.
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Nuevo anuncio animado pendiente de ${profile?.business_name ?? "un anunciante"}.`,
      });

      setSubmittedSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["advertiser-profile"] });
      queryClient.invalidateQueries({ queryKey: ["advertiser-ads"] });
    } catch (e: any) {
      toast({ title: e.message || "Error al enviar el anuncio", variant: "destructive" });
    } finally {
      setSubmitting(false);
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

  // (handleSubmitRenderedVideo removed — the user no longer waits for the
  // rendered video on this screen. Once they click Send on the enhanced
  // photo, the ad is inserted as pending and the user is freed up.)

  const resetState = () => {
    setFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setError(null);
    setAdBusinessName("");
    setAdTagline("");
    setAdCta("Visítanos");
    setProcessing(false);
    setEnhancedUrl(null);
    setSubmittedSuccess(false);
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

  // ── STEP 3: Image — two-phase flow ──────────────────────────────────────────
  // States, in order:
  //   submittedSuccess === true  → "¡Listo! Te avisamos cuando esté en pantallas."
  //   enhancedUrl !== null       → enhanced photo preview + single "Enviar" button
  //   processing === true        → enhancing spinner
  //   else (idle)                → original preview + 2 options (send as-is / enhance)
  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* ── Final state: ad submitted, user is done ── */}
      {submittedSuccess && (
        <Card className="border-2 border-green-500/30">
          <CardContent className="p-8 flex flex-col items-center text-center gap-5">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">¡Anuncio enviado!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estamos creando tu video animado en el fondo. Cuando esté listo y aprobado por nuestro equipo, lo verás publicado en <strong>Mis Anuncios</strong> y comenzará a aparecer en pantallas.
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                No necesitas esperar acá. Puedes cerrar esta página o crear otro anuncio.
              </p>
            </div>
            <Button
              onClick={resetState}
              className="w-full gap-2"
              size="lg"
            >
              <Sparkles className="h-4 w-4" /> Crear otro anuncio
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              Revisa el progreso en la pestaña "Mis Anuncios"
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Enhanced photo: before/after + single approve button ── */}
      {enhancedUrl && !submittedSuccess && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Antes y después
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Compara tu foto original con la versión mejorada por IA. Si te gusta, presiona Enviar — crearemos el video animado en el fondo y aparecerá en "Mis Anuncios" cuando esté listo.
            </p>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Single large preview — shows the enhanced photo by default,
                and reveals the original ONLY while the button below is
                pressed. Cleaner than a side-by-side grid: the user sees
                the polished result first, then can dip into the original
                for comparison without losing focus on the final output. */}
            <div className="relative">
              <img
                src={showingOriginal ? previewUrl! : enhancedUrl!}
                alt={showingOriginal ? "Foto original" : "Foto mejorada"}
                className={`w-full rounded-lg object-cover transition-all ${
                  showingOriginal ? "border border-border" : "border-2 border-violet-500/40"
                }`}
                style={{ aspectRatio: "16/9" }}
                draggable={false}
              />
              {/* Floating label so the user always knows which version they're looking at */}
              <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                showingOriginal
                  ? "bg-black/60 text-white"
                  : "bg-violet-600 text-white"
              }`}>
                {showingOriginal ? "Original" : <><Sparkles className="h-3 w-3" /> Mejorada</>}
              </div>
            </div>

            {/* Press-and-hold compare button. Mouse for desktop, touch for
                mobile. onMouseLeave covers the case where the cursor leaves
                the button while still pressed, so the toggle doesn't get
                stuck on "original". */}
            <Button
              variant="outline"
              size="sm"
              className="w-full select-none"
              onMouseDown={() => setShowingOriginal(true)}
              onMouseUp={() => setShowingOriginal(false)}
              onMouseLeave={() => setShowingOriginal(false)}
              onTouchStart={(e) => { e.preventDefault(); setShowingOriginal(true); }}
              onTouchEnd={() => setShowingOriginal(false)}
              onTouchCancel={() => setShowingOriginal(false)}
            >
              Mantén presionado para ver el original
            </Button>

            {/* Ad copy form — lives here (after the photo is approved) so
                the user writes the text with the actual visual in mind.
                Pre-filled from profile.business_name; user can override
                per-ad. */}
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-medium text-foreground">
                Texto del anuncio
              </p>
              <Input
                value={adBusinessName}
                onChange={(e) => setAdBusinessName(e.target.value)}
                placeholder="Nombre del negocio *"
              />
              <Input
                value={adTagline}
                onChange={(e) => setAdTagline(e.target.value)}
                placeholder="Tagline (opcional): ej. Corte $15 esta semana"
              />
              <Input
                value={adCta}
                onChange={(e) => setAdCta(e.target.value)}
                placeholder="Call to action: ej. Visítanos · 919-555-0101"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSendForRender}
              disabled={submitting || !adBusinessName.trim()}
              size="lg"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none" }}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                : <><Send className="h-4 w-4" /> Enviar</>
              }
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={resetState}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Empezar de nuevo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Enhancing: staged progress indicator ── */}
      {processing && !enhancedUrl && !submittedSuccess && (() => {
        // Pick the latest stage whose `min` we've passed. Fallback to 0
        // for the first second before the interval kicks in.
        const stageIdx = ENHANCE_STAGES.reduce(
          (acc, s, i) => (enhancingSeconds >= s.min ? i : acc),
          0
        );
        const stage = ENHANCE_STAGES[stageIdx];
        // Cap progress at 95% so we never look "stuck at done" while we
        // wait for the actual response.
        const pct = Math.min(95, (enhancingSeconds / ENHANCE_TOTAL_SECONDS) * 100);

        return (
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* Big animated emoji + current stage label */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="text-5xl animate-pulse" aria-hidden>{stage.emoji}</div>
                <p className="font-semibold text-base text-foreground text-center">
                  {stage.label}...
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-violet-700 transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                  {enhancingSeconds}s
                </p>
              </div>

              {/* Stages checklist — gives a sense of "we're doing several things" */}
              <div className="space-y-2 pt-1">
                {ENHANCE_STAGES.map((s, i) => {
                  const isDone = i < stageIdx;
                  const isCurrent = i === stageIdx;
                  return (
                    <div
                      key={s.label}
                      className={`flex items-center gap-2 text-xs ${
                        isDone
                          ? "text-foreground/70"
                          : isCurrent
                            ? "text-violet-700 font-medium"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600 flex-shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                Esto tarda alrededor de 1 minuto. No cierres la página.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Idle: original preview + 2 options ── */}
      {!processing && !enhancedUrl && !submittedSuccess && (
        <>
          {/* Preview of original upload */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <img
                src={previewUrl!}
                alt="Preview"
                className="w-full rounded-lg object-cover border border-border"
                style={{ aspectRatio: "16/9" }}
              />
              <Button variant="outline" size="sm" onClick={resetState}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Cambiar foto
              </Button>
            </CardContent>
          </Card>

          {/* Option 1: send as-is, no AI */}
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">¿Tu diseño ya está listo?</p>
              <p className="text-xs text-muted-foreground">Envíalo directamente para aprobación sin modificar.</p>
              <Button onClick={handleSubmitImage} disabled={submitting} className="w-full" size="lg">
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  : <><Send className="h-4 w-4 mr-2" /> Enviar para aprobación</>
                }
              </Button>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium px-2">o crea tu anuncio con IA</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Option 2: AI enhance (Phase 1 of two-phase flow) */}
          {/* The text inputs (business name, tagline, CTA) intentionally
              live in Phase 2 (after the user sees the enhanced photo) so
              they can write copy inspired by the actual visual. Phase 1
              is just one click — less form friction, faster start. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Crear anuncio animado con IA
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Mejoramos tu foto y te la mostramos. Si te gusta, escribes el texto del anuncio y lo enviamos a producción.
              </p>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full gap-2"
                onClick={handleEnhancePhoto}
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none" }}
                size="lg"
              >
                <Sparkles className="h-4 w-4" /> Mejorar con IA
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center pb-4">
        Revisamos tu anuncio y lo publicamos en pantallas en menos de 24h.
      </p>

      <DemoModal />
    </div>
  );
};

export default CreateAdScreen;
