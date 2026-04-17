import { useState, useRef, useCallback } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserProfile, useSubscription } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Upload, Camera, Sparkles, Image as ImageIcon, Video,
  AlertTriangle, ArrowLeft, RotateCcw, Send, Loader2,
} from "lucide-react";
import ImageOverlayEditor from "./ImageOverlayEditor";

const ACCEPTED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime"];
const ALL_ACCEPTED = [...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO];
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov";
const DEMO_EMAIL = "demo@adscreenpro.com";

type MediaType = "image" | "video" | null;

const CreateAdScreen = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: profile } = useAdvertiserProfile();
  const { data: subscription } = useSubscription();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [savedVersions, setSavedVersions] = useState<string[]>([]);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("impacto");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [peekingOriginal, setPeekingOriginal] = useState(false);

  const PLAN_LIMITS: Record<string, { ads: number; aiMonth: number; aiImage: number }> = {
    basico:    { ads: 2,   aiMonth: 6,   aiImage: 3 },
    pro:       { ads: 5,   aiMonth: 20,  aiImage: 3 },
    unlimited: { ads: 999, aiMonth: 999, aiImage: 999 },
  };
  const [imageGenCount, setImageGenCount] = useState(0); // intentos en la imagen actual

  // Leer contadores desde Supabase (el hook ya trae todos los campos con select("*"))
  const plan = (profile as any)?.plan ?? "basico";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basico;
  const lastReset = profile ? new Date((profile as any).last_month_reset || "2000-01-01") : new Date("2000-01-01");
  const now = new Date();
  const isNewMonth = lastReset.getFullYear() < now.getFullYear() || lastReset.getMonth() < now.getMonth();
  const aiGensUsed = isNewMonth ? 0 : ((profile as any)?.ai_gens_this_month ?? 0);
  const adsUsed = isNewMonth ? 0 : ((profile as any)?.ads_this_month ?? 0);
  const remainingMonthly = limits.aiMonth - aiGensUsed;
  const remainingForImage = limits.aiImage - imageGenCount;
  const remainingGenerations = Math.min(remainingMonthly, remainingForImage);
  const remainingAds = limits.ads - adsUsed;

  const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
    // Categorías del registro (en minúsculas para comparación)
    automotriz:       ["🚗 Cambio de aceite $29 · Sin cita previa", "🔧 Diagnóstico gratis con cualquier servicio", "🛞 Alineación + balanceo · Pregunta por precio"],
    "balloon artist": ["🎈 Decoraciones para fiestas · Reserva ya", "🎉 Arreglos personalizados · Llámanos hoy", "✨ Quinceañeras, bodas y eventos · Cotiza gratis"],
    belleza:          ["💅 Manicure + pedicure $35 · Hoy disponible", "✨ Coloración profesional · Agenda tu cita", "🌸 Primera visita 20% off · Llámanos"],
    educación:        ["📚 Clases particulares · Primera gratis", "🎓 Inscripciones abiertas · Cupos limitados", "⭐ Mejora tus notas · Llama hoy"],
    entretenimiento:  ["🎉 Reserva tu evento con nosotros", "🎤 Fiestas, bodas y quinces · Cotiza ya", "🎊 Diversión garantizada · Contáctanos"],
    restaurante:      ["🍽️ Almuerzo especial $12 · Lunes a viernes", "🎉 Happy hour 4–7pm · 2x1 en bebidas", "🍕 Pide en línea · Entrega gratis hoy"],
    retail:           ["🛍️ Liquidación hasta 40% off este fin de semana", "🎁 Compra $50 y llévate un regalo gratis", "⭐ Nuevos productos · Ven a conocerlos"],
    salud:            ["🩺 Consulta disponible hoy · Sin espera larga", "💊 Aceptamos la mayoría de seguros", "❤️ Tu salud primero · Llámanos ahora"],
    default:          ["🌟 Oferta especial · Solo por tiempo limitado", "📞 Llámanos hoy · Atención personalizada", "⭐ Visítanos · ¡Te esperamos!"],
  };

  const getCategorySuggestions = (category: string): string[] => {
    const key = (category ?? "").toLowerCase().trim();
    return CATEGORY_SUGGESTIONS[key] ?? CATEGORY_SUGGESTIONS.default;
  };

  const AI_TEMPLATES = [
    { id: "impacto", label: "🔥 Impacto", desc: "Fondo oscuro, colores intensos" },
    { id: "premium", label: "✨ Premium", desc: "Minimalista y elegante" },
    { id: "oferta", label: "🎉 Oferta", desc: "Llamativo, con badge de descuento" },
    { id: "moderno", label: "📱 Moderno", desc: "Gradientes y diseño contemporáneo" },
  ];

  const isActive = (subscription?.subscribed ?? false) || (profile?.is_active ?? false);
  const isDemo = user?.email === DEMO_EMAIL;

  const validateFile = useCallback(async (f: File): Promise<string | null> => {
    const tAd = t.advertiserDashboard;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    const VIDEO_EXTS = ["mp4", "mov"];
    // iOS a veces entrega MIME type vacío — usamos extensión como fallback
    const mimeOk = ALL_ACCEPTED.includes(f.type);
    const extOk = IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext);
    if (!mimeOk && !extOk) return tAd.formatError;
    const isImage = ACCEPTED_IMAGE.includes(f.type) || IMAGE_EXTS.includes(ext);
    const isVideo = ACCEPTED_VIDEO.includes(f.type) || VIDEO_EXTS.includes(ext);
    if (isImage && f.size > 15 * 1024 * 1024) return tAd.imageSizeError.replace("{size}", (f.size / 1024 / 1024).toFixed(1));
    if (isVideo && f.size > 100 * 1024 * 1024) return tAd.videoSizeError.replace("{size}", (f.size / 1024 / 1024).toFixed(1));
    return new Promise((resolve) => {
      // Timeout: si el browser no puede leer los metadatos en 5s, permitir el archivo
      const timeout = setTimeout(() => resolve(null), 5000);
      const done = (result: string | null) => { clearTimeout(timeout); resolve(result); };
      const isValidRatio = (w: number, h: number) => {
        const ratio = w / h;
        return ratio >= 1.3 && ratio <= 2.4; // acepta 4:3, 3:2, 16:10, 16:9 y similares
      };
      if (isImage) {
        const img = new window.Image();
        img.onload = () => {
          if (img.width <= img.height) { done(tAd.orientationError); URL.revokeObjectURL(img.src); return; }
          if (!isValidRatio(img.width, img.height)) { done("Tu imagen debe ser formato 16:9 (horizontal para TV). Ejemplo: 1920×1080 px."); URL.revokeObjectURL(img.src); return; }
          done(null); URL.revokeObjectURL(img.src);
        };
        img.onerror = () => done(null);
        img.src = URL.createObjectURL(f);
      } else if (isVideo) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const w = video.videoWidth;
          const h = video.videoHeight;
          const ratio = w / h;
          const ratioInv = h / w;
          const isValid = (r: number) => r >= 1.6 && r <= 2.2;
          if (!isValid(ratio) && !isValid(ratioInv)) {
            done("Tu video debe ser horizontal (16:9). Gira el teléfono y vuelve a grabar.");
            URL.revokeObjectURL(video.src);
            return;
          }
          if (video.duration > 30) done(tAd.durationError.replace("{duration}", Math.round(video.duration).toString()));
          else done(null);
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => done(null);
        video.src = URL.createObjectURL(f);
      } else done(null);
    });
  }, [t]);

  const handleLogoSelect = (f: File) => {
    setLogoFile(f);
    setLogoPreviewUrl(URL.createObjectURL(f));
  };

  const applyLogoToImage = async (imageUrl: string, logo: File): Promise<string> => {
    const baseRes = await fetch(imageUrl);
    const baseBlob = await baseRes.blob();
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const baseImg = new window.Image();
      const baseObjUrl = URL.createObjectURL(baseBlob);
      baseImg.onload = () => {
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        ctx.drawImage(baseImg, 0, 0);
        URL.revokeObjectURL(baseObjUrl);
        const logoImg = new window.Image();
        const logoObjUrl = URL.createObjectURL(logo);
        logoImg.onload = () => {
          const logoW = Math.round(baseImg.width * 0.15);
          const logoH = Math.round((logoImg.height / logoImg.width) * logoW);
          const padding = Math.round(baseImg.width * 0.03);
          ctx.globalAlpha = 0.92;
          ctx.drawImage(logoImg, padding, padding, logoW, logoH);
          ctx.globalAlpha = 1;
          URL.revokeObjectURL(logoObjUrl);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };
        logoImg.onerror = () => { URL.revokeObjectURL(logoObjUrl); resolve(canvas.toDataURL("image/jpeg", 0.9)); };
        logoImg.src = logoObjUrl;
      };
      baseImg.onerror = () => { URL.revokeObjectURL(baseObjUrl); resolve(imageUrl); };
      baseImg.src = baseObjUrl;
    });
  };

  const handleFileSelect = async (f: File) => {
    setError(null);
    setIsEnhanced(false);
    setPrompt("");
    setSavedVersions([]);
    setShowEditor(false);
    const validationError = await validateFile(f);
    if (validationError) {
      setError(validationError);
      setFile(null);
      setOriginalUrl(null);
      setPreviewUrl(null);
      setMediaType(null);
      return;
    }
    const isImage = ACCEPTED_IMAGE.includes(f.type);
    const url = URL.createObjectURL(f);
    setFile(f);
    setMediaType(isImage ? "image" : "video");
    setOriginalUrl(url);
    setPreviewUrl(url);
    setImageGenCount(0);
  };

  // Compress + resize image before sending to Edge Function (max 1280px, 85% quality)
  const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const MAX_W = 1280;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleEnhance = async () => {
    if (!file || enhancing || remainingGenerations <= 0) return;
    setEnhancing(true);
    try {
      const imageBase64 = await toBase64(file);
      const mimeType = "image/jpeg"; // toBase64 siempre convierte a JPEG

      await supabase.auth.refreshSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

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
          mimeType,
          prompt: prompt.trim(),
          category: profile?.category ?? "",
          template: selectedTemplate,
          lang,
        }),
      });

      if (!fnRes.ok) {
        const errData = await fnRes.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${fnRes.status}`);
      }
      const res = await fnRes.json();
      if (!res.imageUrl) throw new Error("No image returned");

      // Apply logo overlay if one was uploaded
      let finalUrl = res.imageUrl;
      if (logoFile) {
        try { finalUrl = await applyLogoToImage(res.imageUrl, logoFile); } catch { /* use AI image without logo */ }
      }
      setPreviewUrl(finalUrl);
      setIsEnhanced(true);
      setImageGenCount((c) => c + 1);
      setShowReveal(true);
      queryClient.invalidateQueries({ queryKey: ["advertiser-profile"] });
      setSavedVersions([]);
    } catch (e: any) {
      toast({ title: e.message || "Error al generar con IA", variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  const handleResetToOriginal = () => {
    setPreviewUrl(originalUrl);
    setIsEnhanced(false);
    setShowReveal(false);
    setPeekingOriginal(false);
    setSavedVersions([]);
  };

  const handleSaveVersion = (dataUrl: string) => {
    setSavedVersions((v) => [...v, dataUrl]);
    setPreviewUrl(dataUrl); // update main preview with edited version
    setIsEnhanced(true);
    setShowEditor(false);
  };

  const compressImageBlob = (blob: Blob, maxWidth = 1920, quality = 0.82): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((c) => resolve(c ?? blob), "image/jpeg", quality);
      };
      img.onerror = () => resolve(blob);
      img.src = url;
    });

  const handleSubmitImage = async (versionUrl: string) => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!user || submitting) return;
    if (remainingAds <= 0) {
      toast({ title: "Alcanzaste el límite de 2 anuncios este mes. Se renueva el 1 del próximo mes.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(versionUrl);
      const raw = await res.blob();
      const blob = await compressImageBlob(raw);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(path);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        type: "image" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
        metadata: {
          style: selectedTemplate,
          category: profile?.category ?? "",
          prompt: prompt.trim(),
        },
      });
      if (insertErr) throw insertErr;

      // Notify admin
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Nuevo anuncio pendiente de revisión de ${profile?.business_name ?? "un anunciante"}.`,
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

  const compressVideo = async (inputFile: File): Promise<File> => {
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      await ffmpeg.writeFile("input.mp4", await fetchFile(inputFile));
      await ffmpeg.exec([
        "-i", "input.mp4",
        "-vf", "scale='min(1280,iw)':-2",
        "-c:v", "libx264", "-crf", "28", "-preset", "fast",
        "-an", // remove audio (screens are muted)
        "-movflags", "+faststart",
        "output.mp4",
      ]);
      const data = await ffmpeg.readFile("output.mp4");
      return new File([data], "compressed.mp4", { type: "video/mp4" });
    } catch {
      return inputFile; // si falla, sube el original
    }
  };

  const handleSubmitVideo = async () => {
    if (isDemo) { setShowDemoModal(true); return; }
    if (!user || !file || submitting) return;
    if (remainingAds <= 0) {
      toast({ title: "Alcanzaste el límite de 2 anuncios este mes. Se renueva el 1 del próximo mes.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const compressed = await compressVideo(file);
      const path = `${user.id}/${Date.now()}.mp4`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(path, compressed, { contentType: "video/mp4" });
      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from("ad-media").getPublicUrl(path);
      const { error: insertErr } = await supabase.from("ads").insert({
        advertiser_id: user.id,
        type: "video" as const,
        final_media_path: publicUrl.publicUrl,
        status: "draft" as const,
        metadata: {
          style: selectedTemplate,
          category: profile?.category ?? "",
          prompt: prompt.trim(),
        },
      });
      if (insertErr) throw insertErr;

      // Notify admin
      await supabase.from("admin_notifications").insert({
        type: "new_ad",
        message: `Nuevo video pendiente de revisión de ${profile?.business_name ?? "un anunciante"}.`,
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

  const resetState = () => {
    setFile(null);
    setOriginalUrl(null);
    setPreviewUrl(null);
    setMediaType(null);
    setError(null);
    setPrompt("");
    setIsEnhanced(false);
    setSavedVersions([]);
    setShowEditor(false);
    setLogoFile(null);
    setLogoPreviewUrl(null);
  };

  const CreateButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
    if (!isActive) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Button disabled className="w-full">{children}</Button></span>
          </TooltipTrigger>
          <TooltipContent>{t.advertiserDashboard.activateTooltip}</TooltipContent>
        </Tooltip>
      );
    }
    return <Button onClick={onClick} className="w-full">{children}</Button>;
  };

  // ── STEP 1: Upload ──────────────────────────────────────────────────────────
  if (!file) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Contador de anuncios del mes */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${remainingAds > 0 ? "bg-primary/5 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
          <span>Anuncios este mes</span>
          <span>{remainingAds > 0 ? `${remainingAds} de ${limits.ads} disponibles` : "Límite alcanzado — se renueva el 1 del mes"}</span>
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
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f).catch(() => setError("Error al leer el archivo. Intenta con otro.")); }} />
                </label>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <label className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" /> {t.advertiserDashboard.takePhotoOrVideo}
                  <input type="file" accept="image/*,video/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f).catch(() => setError("Error al leer el archivo. Intenta con otro.")); }} />
                </label>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><Button disabled className="w-full"><Upload className="h-4 w-4 mr-2" />{t.advertiserDashboard.uploadFile}</Button></span>
                  </TooltipTrigger>
                  <TooltipContent>{t.advertiserDashboard.activateTooltip}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><Button disabled className="w-full"><Camera className="h-4 w-4 mr-2" />{t.advertiserDashboard.takePhotoOrVideo}</Button></span>
                  </TooltipTrigger>
                  <TooltipContent>{t.advertiserDashboard.activateTooltip}</TooltipContent>
                </Tooltip>
              </>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">📐 Formato requerido: 16:9 horizontal</p>
              <p>Imágenes: 1920×1080 px — Videos: grabados en modo paisaje (acostado)</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">{t.advertiserDashboard.acceptedFormats}</p>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── STEP 2: Video ───────────────────────────────────────────────────────────
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
                {submitting ? "Comprimiendo y enviando..." : t.advertiserDashboard.sendForReview}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.advertiserDashboard.demoModalTitle}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t.advertiserDashboard.demoModalDesc}</p>
            <DialogFooter><Button onClick={() => setShowDemoModal(false)}>{t.advertiserDashboard.demoModalOk}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── STEP 2b: Overlay editor ─────────────────────────────────────────────────
  if (showEditor && previewUrl) {
    return <ImageOverlayEditor imageUrl={previewUrl} onSaveVersion={handleSaveVersion} onCancel={() => setShowEditor(false)} />;
  }

  // ── STEP 2c: Image enhance & submit ────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Preview */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative rounded-lg overflow-hidden select-none" style={{ aspectRatio: "16/9" }}>
            {/* Current image (AI result or original) */}
            <img
              src={peekingOriginal && originalUrl ? originalUrl : previewUrl!}
              alt="Preview"
              className="w-full h-full object-cover transition-opacity duration-150"
            />

            {/* Labels */}
            {showReveal && (
              <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-150 ${
                peekingOriginal ? "bg-black/60 text-white" : "bg-green-600/90 text-white"
              }`}>
                {peekingOriginal ? "ANTES" : <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 inline" /> IA</span>}
              </span>
            )}

            {/* Non-reveal badge */}
            {!showReveal && isEnhanced && (
              <Badge className="absolute top-2 right-2 bg-green-600 gap-1">
                <Sparkles className="h-3 w-3" /> IA aplicada
              </Badge>
            )}
          </div>

          {/* Hold to compare button */}
          {showReveal && originalUrl && (
            <button
              className="w-full mt-2 py-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground bg-muted/40 active:bg-muted select-none"
              onMouseDown={() => setPeekingOriginal(true)}
              onMouseUp={() => setPeekingOriginal(false)}
              onMouseLeave={() => setPeekingOriginal(false)}
              onTouchStart={(e) => { e.preventDefault(); setPeekingOriginal(true); }}
              onTouchEnd={() => setPeekingOriginal(false)}
            >
              {peekingOriginal ? "Suelta para ver el resultado IA" : "Mantén presionado para ver el original"}
            </button>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={resetState}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Cambiar foto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit directly (no AI) */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">¿Tu diseño ya está listo?</p>
          <p className="text-xs text-muted-foreground">Si ya tienes tu anuncio diseñado, envíalo directamente para aprobación.</p>
          <Button
            onClick={() => handleSubmitImage(previewUrl!)}
            disabled={submitting}
            className="w-full"
            size="lg"
          >
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
        <span className="text-xs text-muted-foreground font-medium px-2">o mejora tu foto con IA</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Unified ad customization card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between gap-2 text-foreground">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Personaliza tu anuncio <span className="font-normal text-muted-foreground">(Opcional)</span>
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${remainingGenerations > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {remainingGenerations > 0 ? `${remainingForImage} generación${remainingForImage !== 1 ? "es" : ""} disponible${remainingForImage !== 1 ? "s" : ""}` : "Límite alcanzado"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Logo upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Logo <span className="font-normal opacity-70">(opcional)</span></p>
            <div className="flex items-center gap-3">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} className="h-12 w-auto max-w-[90px] object-contain rounded border border-border bg-muted/20 p-1" alt="Logo" />
              ) : (
                <div className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/20">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <label className="cursor-pointer text-primary hover:underline font-medium">
                  {logoFile ? "Cambiar logo" : "Subir logo"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f); }} />
                </label>
                {logoFile && (
                  <button className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => { setLogoFile(null); setLogoPreviewUrl(null); }}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Texto del anuncio</p>
            {/* Suggestions by category */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {getCategorySuggestions((profile as any)?.category ?? "").map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <Textarea
              placeholder={lang === "en"
                ? "What should the ad say? e.g. 'Weekend special 2x1 · Call 919-555-0101'"
                : "¿Qué debe decir el anuncio? Ej: 'Oferta 2x1 este fin de semana · Llama al 919-555-0101'"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Style templates */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Estilo del anuncio</p>
            <div className="grid grid-cols-2 gap-2">
              {AI_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    selectedTemplate === tmpl.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold">{tmpl.label}</div>
                  <div className="text-muted-foreground mt-0.5">{tmpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {remainingGenerations > 0 ? (
            <Button
              onClick={handleEnhance}
              disabled={enhancing}
              className="w-full"
              style={{ background: enhancing ? undefined : "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none" }}
            >
              {enhancing
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando con IA...</>
                : <><Sparkles className="h-4 w-4 mr-2" /> {isEnhanced ? "Generar otra versión" : "Generar anuncio con IA"}</>
              }
            </Button>
          ) : (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-center">
              <p className="text-sm font-medium text-destructive">Usaste tus generaciones disponibles</p>
              <p className="text-xs text-muted-foreground mt-1">Escríbenos por WhatsApp para obtener más.</p>
            </div>
          )}

          {/* Submit AI version */}
          {isEnhanced && (
            <Button
              onClick={() => handleSubmitImage(previewUrl!)}
              disabled={submitting}
              variant="outline"
              className="w-full border-green-500 text-green-700 hover:bg-green-50"
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                : <><Send className="h-4 w-4 mr-2" /> Enviar esta versión para aprobación</>
              }
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Saved versions */}
      {savedVersions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-foreground">Versiones guardadas del editor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {savedVersions.map((v, i) => (
                <div key={i} className="space-y-2">
                  <img src={v} alt={`Versión ${i + 1}`} className="w-full rounded-lg border border-border" />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleSubmitImage(v)}
                    disabled={submitting}
                  >
                    {submitting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><Send className="h-4 w-4 mr-1.5" /> Enviar esta</>
                    }
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center -mt-3">
        Revisamos tu anuncio y lo publicamos en pantallas en menos de 24h.
      </p>

      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.advertiserDashboard.demoModalTitle}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t.advertiserDashboard.demoModalDesc}</p>
          <DialogFooter><Button onClick={() => setShowDemoModal(false)}>{t.advertiserDashboard.demoModalOk}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateAdScreen;
