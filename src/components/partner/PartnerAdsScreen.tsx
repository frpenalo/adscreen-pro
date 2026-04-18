import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, Sparkles, Send, Loader2, Film, Trash2, Clock, CheckCircle, XCircle, Video, ArrowLeft } from "lucide-react";

const MAX_SLOTS = 3;
const ACCEPTED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/mov"];
const ACCEPT_STRING = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm";

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

  // ── Ad text fields ─────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [cta, setCta] = useState("Visítanos");

  // ── Processing state ───────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);   // AI enhance + render trigger
  const [submitting, setSubmitting] = useState(false);    // direct submit
  const [renderingAdId, setRenderingAdId] = useState<string | null>(null);

  // ── Poll for rendered video ────────────────────────────────────────────────
  const { data: renderingAd } = useQuery({
    queryKey: ["rendering-ad-partner", renderingAdId],
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

  // ── Unified: AI enhance → animated video ──────────────────────────────────
  const handleCreateAd = async () => {
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

      // Step 1 — AI enhance (category drives the style)
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
          adText: tagline.trim(),
        }),
      });
      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({}));
        throw new Error((err as any).error || `Error ${fnRes.status}`);
      }
      const aiRes = await fnRes.json();
      if (!aiRes.imageUrl) throw new Error("La IA no devolvió imagen. Intenta de nuevo.");

      // Step 2 — Insert ad record + trigger Remotion render
      const { data: adData, error: insertErr } = await supabase
        .from("ads")
        .insert({
          advertiser_id: user.id,
          screen_id: user.id,
          type: "video",
          final_media_path: "",
          status: "draft",
        } as any)
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
          business_name: businessName.trim() || profile.business_name || "",
          tagline: tagline.trim(),
          cta: cta.trim(),
          advertiser_id: user.id,
          category: (profile as any)?.category ?? "",
        }),
      });

      setRenderingAdId(adId);
      toast({ title: "¡Procesando tu anuncio! Listo en ~2 minutos." });
    } catch (e: any) {
      toast({ title: e.message || "Error al crear el anuncio", variant: "destructive" });
    } finally {
      setProcessing(false);
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

  // ── Submit rendered video ──────────────────────────────────────────────────
  const handleSubmitRenderedVideo = async () => {
    if (!renderingAd || !user || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from("ads").update({ status: "pending" }).eq("id", (renderingAd as any).id);
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Video animado pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
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
    setRenderingAdId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const videoReady = !!(renderingAd as any)?.final_media_path;

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

          {/* STEP 2b: Image selected */}
          {file && fileType === "image" && (
            <div className="space-y-4">

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

              {/* Option 1: Send as-is */}
              {!processing && !renderingAdId && (
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium">¿Tu diseño ya está listo?</p>
                    <p className="text-xs text-muted-foreground">Envíalo directamente sin modificar.</p>
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
                  <span className="text-xs text-muted-foreground font-medium">o crea un video animado</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {/* Option 2: Animated video with AI */}
              {!renderingAdId && (
                <Card className="border-2 border-accent/30">
                  <CardContent className="p-4 space-y-3">

                    {!processing && (
                      <>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">Crear anuncio animado con IA</p>
                        </div>
                        <p className="text-xs text-muted-foreground">La IA mejora tu foto y crea un video de 10 segundos optimizado para TV.</p>

                        <Input
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Nombre del negocio"
                          className="text-sm"
                        />
                        <Input
                          value={tagline}
                          onChange={(e) => setTagline(e.target.value)}
                          placeholder="Tagline (ej. El mejor corte de la ciudad)"
                          className="text-sm"
                        />
                        <Input
                          value={cta}
                          onChange={(e) => setCta(e.target.value)}
                          placeholder="Call to action (ej. Visítanos)"
                          className="text-sm"
                        />
                      </>
                    )}

                    {/* Processing states */}
                    {processing && (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-foreground">Mejorando imagen con IA...</p>
                        <p className="text-xs text-muted-foreground">Esto toma unos segundos</p>
                      </div>
                    )}

                    {!processing && (
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handleCreateAd}
                        disabled={processing || !businessName.trim()}
                      >
                        <Sparkles className="h-4 w-4" />
                        Crear anuncio animado con IA
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Rendering in progress */}
              {renderingAdId && !videoReady && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">Generando tu anuncio...</p>
                      <p className="text-xs text-muted-foreground">Esto toma ~2 minutos. Puedes esperar aquí.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Video ready */}
              {renderingAdId && videoReady && (
                <Card className="border-2 border-green-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <p className="text-sm font-medium">¡Tu video está listo!</p>
                    </div>
                    <video
                      src={(renderingAd as any).final_media_path}
                      controls
                      className="w-full rounded-lg border"
                    />
                    <Button className="w-full gap-2" onClick={handleSubmitRenderedVideo} disabled={submitting}>
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar a revisión</>}
                    </Button>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PartnerAdsScreen;
