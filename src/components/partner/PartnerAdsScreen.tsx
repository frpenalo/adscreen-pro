import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, Sparkles, Send, Loader2, Film, Trash2, Clock, CheckCircle, XCircle, Video } from "lucide-react";

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

  // ALL hooks must be declared before any conditional return
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"image" | "video">("image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [cta, setCta] = useState("Visítanos");
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [renderingAdId, setRenderingAdId] = useState<string | null>(null);

  const { data: renderingAd } = useQuery({
    queryKey: ["rendering-ad", renderingAdId],
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

  // ── Conditional return AFTER all hooks ──────────────────────────────────────
  if (!profile) return null; // still loading

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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFileSelect = async (f: File) => {
    setError(null);
    const isImage = f.type.startsWith("image/") && ACCEPTED_IMAGE.includes(f.type);
    const isVideo = f.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Solo se aceptan imágenes (JPG, PNG, WEBP) o videos (MP4, MOV, WEBM).");
      return;
    }
    if (isImage && f.size > 15 * 1024 * 1024) {
      setError("La imagen no puede pesar más de 15MB.");
      return;
    }
    if (isVideo && f.size > 200 * 1024 * 1024) {
      setError("El video no puede pesar más de 200MB.");
      return;
    }

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
            setIsEnhanced(false);
          }
          resolve();
        };
        img.onerror = () => { setFile(f); setFileType("image"); setPreviewUrl(url); resolve(); };
        img.src = url;
      });
    } else {
      setFile(f);
      setFileType("video");
      setPreviewUrl(url);
      setIsEnhanced(false);
    }
  };

  const handleEnhance = async () => {
    if (!file || fileType !== "image") return;
    setEnhancing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error: fnErr } = await supabase.functions.invoke("generate-ad", {
        body: {
          imageBase64: base64,
          mimeType: file.type,
          prompt: prompt.trim() || "Anuncio de barbería local",
          businessName: profile.business_name ?? "",
          style: "impacto",
        },
      });
      if (fnErr) throw fnErr;
      if (data?.imageUrl) {
        setPreviewUrl(data.imageUrl);
        setIsEnhanced(true);
      } else {
        toast({ title: "La IA no devolvió imagen. Intenta de nuevo.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error al mejorar con IA", description: e.message, variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  const compressImageBlob = (blob: Blob): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const scale = img.width > 1920 ? 1920 / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((c) => resolve(c ?? blob), "image/jpeg", 0.82);
      };
      img.onerror = () => resolve(blob);
      img.src = url;
    });

  const handleSubmit = async () => {
    if (!previewUrl || !user || submitting) return;
    if (slotsLeft <= 0) {
      toast({ title: "Alcanzaste el límite de 3 anuncios locales.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let uploadPath: string;
      let contentType: string;
      let uploadBlob: Blob;

      if (fileType === "video") {
        const ext = file!.name.split(".").pop() ?? "mp4";
        uploadPath = `${user.id}/local-${Date.now()}.${ext}`;
        contentType = file!.type;
        uploadBlob = file!;
      } else {
        const res = await fetch(previewUrl);
        const raw = await res.blob();
        uploadBlob = await compressImageBlob(raw);
        uploadPath = `${user.id}/local-${Date.now()}.jpg`;
        contentType = "image/jpeg";
      }

      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(uploadPath, uploadBlob, { contentType });
      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(uploadPath);

      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        type: fileType as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
        screen_id: user.id,
      } as any);
      if (insertErr) throw insertErr;

      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Anuncio local pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
      });

      toast({ title: "Anuncio enviado a revisión" });
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
      setFile(null);
      setPreviewUrl(null);
      setPrompt("");
      setIsEnhanced(false);
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

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setPrompt("");
    setIsEnhanced(false);
    setError(null);
    setVideoMode(false);
    setRenderingAdId(null);
    setBusinessName(profile.business_name ?? "");
    setTagline("");
    setCta("Visítanos");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateVideo = async () => {
    if (!previewUrl || !user || generatingVideo) return;
    setGeneratingVideo(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const photoPath = `${user.id}/video-source-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(photoPath, blob, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;
      const { data: photoUrlData } = supabase.storage.from("ad-media").getPublicUrl(photoPath);

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

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ad-video`;
      const { data: sessionData } = await supabase.auth.getSession();
      await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionData.session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_id: adId,
          photo_url: photoUrlData.publicUrl,
          business_name: businessName,
          tagline,
          cta,
          advertiser_id: user.id,
        }),
      });

      setRenderingAdId(adId);
      toast({ title: "¡Video en proceso! Estará listo en ~2 minutos." });
    } catch (e: any) {
      toast({ title: "Error al generar video", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleSubmitVideo = async () => {
    if (!renderingAd || !user) return;
    setSubmitting(true);
    try {
      await supabase.from("ads").update({ status: "pending" }).eq("id", (renderingAd as any).id);
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Video animado pendiente de revisión de ${profile.business_name ?? "un partner"}.`,
      });
      toast({ title: "Video enviado a revisión" });
      queryClient.invalidateQueries({ queryKey: ["partner-local-ads"] });
      setRenderingAdId(null);
      setVideoMode(false);
      handleReset();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mis Anuncios Locales</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aparecen solo en la pantalla de tu barbería. Incluido en tu plan.
        </p>
      </div>

      <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${slotsLeft > 0 ? "bg-primary/5 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
        <span>Slots disponibles</span>
        <span>{slotsLeft} de {MAX_SLOTS}</span>
      </div>

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

      {slotsLeft > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" /> Subir nuevo anuncio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!file ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Sube una imagen horizontal (16:9) o un video corto. Cortes, productos, promos — lo que quieras mostrar en tu pantalla.
                </p>
                <label className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" /> Seleccionar imagen o video
                  <span className="text-xs opacity-70 font-normal">(JPG, PNG, MP4, MOV)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_STRING}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                </label>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </>
            ) : (
              <>
                {fileType === "video"
                  ? <video src={previewUrl!} controls className="w-full rounded-lg border border-border" style={{ maxHeight: 200 }} />
                  : <img src={previewUrl!} className="w-full rounded-lg object-cover border border-border" style={{ maxHeight: 200 }} />
                }

                {fileType === "image" && (
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe tu anuncio para la IA (opcional): ej. 'Promo corte de pelo $15 esta semana'"
                    rows={2}
                    className="text-sm"
                  />
                )}

                {/* Mejorar con IA */}
                {fileType === "image" && !videoMode && !renderingAdId && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleEnhance}
                    disabled={enhancing}
                  >
                    {enhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isEnhanced ? "Mejorar de nuevo con IA" : "Mejorar con IA"}
                  </Button>
                )}

                {/* Usar imagen / Crear video — siempre visibles */}
                {!videoMode && !renderingAdId && (
                  <div className={fileType === "image" ? "flex gap-2" : ""}>
                    <Button
                      className="flex-1 gap-2"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {fileType === "video" ? "Enviar a revisión" : "Usar imagen"}
                    </Button>
                    {fileType === "image" && (
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setVideoMode(true)}
                      >
                        <Video className="h-4 w-4" />
                        Crear video animado
                      </Button>
                    )}
                  </div>
                )}

                {/* Formulario video */}
                {videoMode && !renderingAdId && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Datos para el video</p>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Nombre del negocio"
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
                      placeholder="Call to action: ej. Visítanos"
                      className="text-sm"
                    />
                    <Button
                      className="w-full gap-2"
                      onClick={handleGenerateVideo}
                      disabled={generatingVideo || !businessName.trim()}
                    >
                      {generatingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                      Generar video
                    </Button>
                  </div>
                )}

                {/* Generando... */}
                {renderingAdId && !(renderingAd as any)?.final_media_path && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Generando tu video animado...</p>
                    <p className="text-xs text-muted-foreground">Esto toma ~2 minutos</p>
                  </div>
                )}

                {/* Video listo */}
                {renderingAdId && (renderingAd as any)?.final_media_path && (
                  <div className="space-y-3">
                    <video
                      src={(renderingAd as any).final_media_path}
                      controls
                      className="w-full rounded-lg border"
                      style={{ maxHeight: 200 }}
                    />
                    <Button
                      className="w-full gap-2"
                      onClick={handleSubmitVideo}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar a revisión
                    </Button>
                  </div>
                )}

                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleReset}>
                  Cancelar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartnerAdsScreen;
