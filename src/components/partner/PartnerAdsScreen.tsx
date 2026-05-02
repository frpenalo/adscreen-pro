import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, Sparkles, Send, Loader2, Film, Trash2, Clock, CheckCircle, XCircle, ArrowLeft, CheckCircle2, ListChecks } from "lucide-react";

const MAX_SLOTS = 3;
const ACCEPTED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/mov"];
const ACCEPT_STRING = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm";

// Stages shown during the photo-enhancement wait. `min` is the elapsed
// second at which a stage becomes the current/active one. Calibrated
// against the typical generate-ad response time of ~60s — the bar caps
// before reaching the end so a slightly-slow API doesn't look stuck.
// (Mirrors the advertiser CreateAdScreen flow — same generate-ad function,
// same expected timing.)
const ENHANCE_STAGES: Array<{ min: number; label: string; emoji: string }> = [
  { min: 0,  label: "Analizando tu foto",            emoji: "📸" },
  { min: 12, label: "Mejorando colores y luz",       emoji: "🎨" },
  { min: 28, label: "Generando estilo de comercial", emoji: "🎬" },
  { min: 48, label: "Aplicando últimos detalles",    emoji: "✨" },
];
const ENHANCE_TOTAL_SECONDS = 60;

const usePartnerAds = (partnerId: string | undefined) =>
  useQuery({
    queryKey: ["partner-local-ads", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, type, final_media_path, status, created_at")
        .eq("advertiser_id", partnerId!)
        .eq("screen_id" as any, partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!partnerId,
  });

const statusIcon = (status: string) => {
  if (status === "published") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-yellow-600" />;
};

const statusLabel = (status: string) => {
  if (status === "published") return "Publicado";
  if (status === "rejected") return "Rechazado";
  return "En revisión";
};

const PartnerAdsScreen = () => {
  const { user } = useAuth();
  const { data: profile } = usePartnerProfile();
  const queryClient = useQueryClient();
  const { data: ads = [] } = usePartnerAds(user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Media state ────────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"image" | "video">("image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Press-and-hold compare on the enhanced-photo card. While true, the
  // preview swaps to the original photo so the user can A/B with one tap.
  const [showingOriginal, setShowingOriginal] = useState(false);

  // ── Ad text fields ─────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [cta, setCta] = useState("Visítanos");

  // ── Processing state ───────────────────────────────────────────────────────
  // Two-phase flow (matches advertiser CreateAdScreen):
  //   1. processing       — calling generate-ad to enhance the photo
  //   2. enhancedUrl set  — show enhanced photo, ad-text form, single Send button
  //   3. submitting       — inserting ad row + dispatching Remotion render
  //   4. submittedSuccess — final state, partner is done; render runs in the
  //                         background, partner sees finished video in the
  //                         "Tus anuncios" list above once it's ready and the
  //                         admin has approved it.
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // ── Enhancement progress (faked-but-believable timeline) ──────────────────
  // generate-ad doesn't stream progress, so we track elapsed seconds and
  // show staged messages. The bar caps at 95% on purpose — never reaches
  // 100% until the actual response arrives, which prevents the "stuck at
  // 100%" bad UX when the API takes a few extra seconds.
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

  const slotsUsed = ads.length;
  const slotsLeft = Math.max(0, MAX_SLOTS - slotsUsed);

  // ── Conditional return AFTER all hooks ────────────────────────────────────
  if (!profile) return null;

  if (profile.status !== "approved") {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
          <Clock className="h-6 w-6 text-yellow-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Cuenta pendiente de aprobación</h2>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está siendo revisada. Una vez aprobada podrás subir anuncios a tu pantalla.
        </p>
      </div>
    );
  }

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFileSelect = async (f: File) => {
    setError(null);
    const isImage = f.type.startsWith("image/") && ACCEPTED_IMAGE.includes(f.type);
    const isVideo = f.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Solo se aceptan imágenes (JPG, PNG, WEBP) o videos (MP4, MOV).");
      return;
    }
    if (isImage && f.size > 15 * 1024 * 1024) { setError("La imagen no puede pesar más de 15MB."); return; }
    if (isVideo && f.size > 200 * 1024 * 1024) { setError("El video no puede pesar más de 200MB."); return; }

    const url = URL.createObjectURL(f);

    if (isImage) {
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          if (img.width <= img.height) {
            setError("La imagen debe ser horizontal (formato TV 16:9).");
            URL.revokeObjectURL(url);
          } else {
            setFile(f);
            setFileType("image");
            setPreviewUrl(url);
            setBusinessName(profile.business_name ?? "");
          }
          resolve();
        };
        img.onerror = () => { setFile(f); setFileType("image"); setPreviewUrl(url); setBusinessName(profile.business_name ?? ""); resolve(); };
        img.src = url;
      });
    } else {
      setFile(f);
      setFileType("video");
      setPreviewUrl(url);
    }
  };

  // ── Compress for AI ────────────────────────────────────────────────────────
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
  // Calls generate-ad which improves the uploaded image. We keep the URL in
  // `enhancedUrl` and show the partner a preview; they then add ad copy and
  // approve sending it for rendering+publication in Phase 2.
  const handleEnhancePhoto = async () => {
    if (!file || !user || processing) return;
    if (slotsLeft <= 0) {
      toast({ title: "Alcanzaste el límite de 3 anuncios locales.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.refreshSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      const imageBase64 = await toBase64(file);
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad`;
      // NOTE: do NOT send tagline / business name to the image-enhancing
      // step. The AI must produce a clean photo with NO text overlays. All
      // ad copy (headline, tagline, CTA) is composed by Remotion downstream.
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
        throw new Error((err as any).error || `Error ${fnRes.status}`);
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
  // Partner approved the enhanced photo. We:
  //   1. Insert the ad row in `draft` status (admin queue)
  //   2. Dispatch the Remotion render in the background
  //   3. Notify the admin
  //   4. Show the success state — partner is done; can navigate away.
  // The Remotion render runs out-of-band and updates the ad row when done.
  // The partner sees the finished video in "Tus anuncios" once admin
  // approves it. (The ad_status enum allows draft/approved/published/
  // rejected — same as direct image/video paths.)
  const handleSendForRender = async () => {
    if (!user || !enhancedUrl || submitting) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.refreshSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      const { data: adData, error: insertErr } = await supabase
        .from("ads")
        .insert({
          advertiser_id: user.id,
          screen_id: user.id,                        // partner ad → only on their own screen
          type: "video",
          final_media_path: "",
          status: "draft",
          metadata: { photo_url: enhancedUrl },
        } as any)
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      const adId = (adData as any).id;

      // Dispatch Remotion render. Returns immediately — the workflow runs on
      // GitHub Actions and updates the ad's final_media_path when finished.
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
          business_name: businessName.trim() || profile.business_name || "",
          tagline: tagline.trim(),
          cta: cta.trim(),
          advertiser_id: user.id,
          category: (profile as any)?.category ?? "",
        }),
      });

      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Video animado pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
      });

      setSubmittedSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
    } catch (e: any) {
      toast({ title: e.message || "Error al enviar el anuncio", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit image directly ──────────────────────────────────────────────────
  const handleSubmitImage = async () => {
    if (!previewUrl || !user || submitting) return;
    if (slotsLeft <= 0) {
      toast({ title: "Alcanzaste el límite de 3 anuncios locales.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(previewUrl);
      const raw = await res.blob();
      const uploadPath = `${user.id}/local-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(uploadPath, raw, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;
      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(uploadPath);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        screen_id: user.id,
        type: "image" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
      } as any);
      if (insertErr) throw insertErr;
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Anuncio local pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
      });
      toast({ title: "Anuncio enviado a revisión" });
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
      resetState();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit video directly ──────────────────────────────────────────────────
  const handleSubmitVideo = async () => {
    if (!file || !user || submitting) return;
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const uploadPath = `${user.id}/local-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(uploadPath, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(uploadPath);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        screen_id: user.id,
        type: "video" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
      } as any);
      if (insertErr) throw insertErr;
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Video local pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
      });
      toast({ title: "Video enviado a revisión" });
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
      resetState();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (adId: string) => {
    const { error: delErr } = await supabase.from("ads").delete().eq("id", adId);
    if (delErr) toast({ title: delErr.message, variant: "destructive" });
    else {
      toast({ title: "Anuncio eliminado" });
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
    }
  };

  const resetState = () => {
    setFile(null);
    setPreviewUrl(null);
    setFileType("image");
    setError(null);
    setBusinessName("");
    setTagline("");
    setCta("Visítanos");
    setProcessing(false);
    setEnhancedUrl(null);
    setSubmittedSuccess(false);
    setShowingOriginal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mis Anuncios Locales</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aparecen solo en la pantalla de tu local. Incluido en tu plan.
        </p>
      </div>

      <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${slotsLeft > 0 ? "bg-primary/5 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
        <span>Slots disponibles</span>
        <span>{slotsLeft} de {MAX_SLOTS}</span>
      </div>

      {/* Existing ads list */}
      {ads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Film className="h-4 w-4" /> Tus anuncios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ads.map((ad: any) => (
              <div key={ad.id} className="flex items-center gap-3">
                {ad.type === "video"
                  ? <video src={ad.final_media_path} className="h-14 w-24 object-cover rounded-md border border-border flex-shrink-0" muted playsInline />
                  : <img src={ad.final_media_path} className="h-14 w-24 object-cover rounded-md border border-border flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {statusIcon(ad.status)}
                    <Badge variant="secondary" className="text-xs">{statusLabel(ad.status)}</Badge>
                    {ad.type === "video" && <Badge variant="outline" className="text-xs">Video</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ad.created_at).toLocaleDateString()}
                  </p>
                </div>
                {ad.status !== "published" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDelete(ad.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload / create flow */}
      {slotsLeft > 0 && (
        <>
          {/* STEP 1: No file selected */}
          {!file && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Subir nuevo anuncio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Sube una imagen horizontal (16:9) o un video corto para tu pantalla.
                </p>
                <label className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" /> Seleccionar imagen o video
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_STRING}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  />
                </label>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </CardContent>
            </Card>
          )}

          {/* STEP 2a: Video uploaded — just send */}
          {file && fileType === "video" && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <video src={previewUrl!} controls className="w-full rounded-lg border border-border" />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetState} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Cambiar
                  </Button>
                  <Button onClick={handleSubmitVideo} disabled={submitting} className="flex-1">
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {submitting ? "Enviando..." : "Enviar a revisión"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2b: Image — two-phase flow ───────────────────────────────────
              States, in order:
                submittedSuccess === true  → "¡Listo! Te avisamos cuando esté en pantallas."
                enhancedUrl !== null       → enhanced photo + form + Send
                processing === true        → staged progress indicator
                else (idle)                → original preview + 2 options
          */}
          {file && fileType === "image" && (
            <div className="space-y-4">

              {/* ── Final state: ad submitted, partner is done ── */}
              {submittedSuccess && (
                <Card className="border-2 border-green-500/30">
                  <CardContent className="p-8 flex flex-col items-center text-center gap-5">
                    <CheckCircle2 className="h-14 w-14 text-green-600" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg text-foreground">¡Anuncio enviado!</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Estamos creando tu video animado en el fondo. Cuando esté listo y aprobado, lo verás arriba en <strong>Tus anuncios</strong> y aparecerá automáticamente en la pantalla de tu local.
                      </p>
                      <p className="text-xs text-muted-foreground pt-1">
                        No necesitas esperar acá. Puedes cerrar esta página o crear otro anuncio.
                      </p>
                    </div>
                    {slotsLeft > 1 ? (
                      <Button onClick={resetState} className="w-full gap-2" size="lg">
                        <Sparkles className="h-4 w-4" /> Crear otro anuncio
                      </Button>
                    ) : (
                      <Button onClick={resetState} variant="outline" className="w-full" size="lg">
                        Cerrar
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" />
                      Revisa el progreso en "Tus anuncios" arriba
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* ── Enhanced photo: before/after + form + Send ── */}
              {enhancedUrl && !submittedSuccess && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                      Antes y después
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Compara tu foto original con la versión mejorada. Si te gusta, completa el texto y presiona Enviar — crearemos el video animado en el fondo.
                    </p>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Single large preview — shows the enhanced photo by
                        default, reveals the original ONLY while the button
                        below is pressed. Cleaner than a side-by-side grid:
                        the partner sees the polished result first. */}
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
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                        showingOriginal
                          ? "bg-black/60 text-white"
                          : "bg-violet-600 text-white"
                      }`}>
                        {showingOriginal ? "Original" : <><Sparkles className="h-3 w-3" /> Mejorada</>}
                      </div>
                    </div>

                    {/* Press-and-hold compare button. Mouse for desktop,
                        touch for mobile. onMouseLeave covers cursor leaving
                        the button while still pressed. */}
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

                    {/* Ad copy form — lives here (after photo approval) so
                        the partner writes text with the actual visual in
                        mind. Pre-filled from profile.business_name. */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-foreground">
                        Texto del anuncio
                      </p>
                      <Input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Nombre del negocio *"
                        className="text-sm"
                      />
                      <Input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Tagline (opcional): ej. El mejor corte de la ciudad"
                        className="text-sm"
                      />
                      <Input
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                        placeholder="Call to action: ej. Visítanos · 919-555-0101"
                        className="text-sm"
                      />
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={handleSendForRender}
                      disabled={submitting || !businessName.trim()}
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
                const stageIdx = ENHANCE_STAGES.reduce(
                  (acc, s, i) => (enhancingSeconds >= s.min ? i : acc),
                  0
                );
                const stage = ENHANCE_STAGES[stageIdx];
                // Cap at 95% — never reach 100% until the API actually responds.
                const pct = Math.min(95, (enhancingSeconds / ENHANCE_TOTAL_SECONDS) * 100);

                return (
                  <Card>
                    <CardContent className="p-6 space-y-5">
                      <div className="flex flex-col items-center gap-3 pt-2">
                        <div className="text-5xl animate-pulse" aria-hidden>{stage.emoji}</div>
                        <p className="font-semibold text-base text-foreground text-center">
                          {stage.label}...
                        </p>
                      </div>

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
                      <p className="text-xs text-muted-foreground">Envíalo directamente sin modificar.</p>
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
                    <span className="text-xs text-muted-foreground font-medium px-2">o crea un video animado</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Option 2: AI enhance (Phase 1 of two-phase flow). Text
                      inputs (business name, tagline, CTA) intentionally
                      live in Phase 2 (after enhanced photo) so partner
                      writes copy inspired by the visual. Phase 1 is just
                      one click — less form friction, faster start. */}
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

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PartnerAdsScreen;
