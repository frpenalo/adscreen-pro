import { useState, useRef, useEffect, useCallback } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertiserBrandAssets } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Type, Image as ImageIcon, Layout, ArrowLeft, ZoomIn, ZoomOut, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  imageUrl: string;
  onSaveVersion: (dataUrl: string) => void;
  onCancel: () => void;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  font: string;
  color: string;
  fontSize: number;
  rotation: number;
  hasBg: boolean;
}

interface LogoElement {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const FONTS = ["Inter, sans-serif", "Arial Black, sans-serif", "Georgia, serif"];
const FONT_LABELS = ["Sans Modern", "Sans Bold", "Serif"];
const COLORS = ["#ffffff", "#000000", "#ff0000", "#ffcc00", "#00cc66", "#3366ff"];
const SAFE_MARGIN = 0.05;

const ImageOverlayEditor = ({ imageUrl, onSaveVersion, onCancel }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: brandAssets } = useAdvertiserBrandAssets();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [logos, setLogos] = useState<LogoElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [selectedFont, setSelectedFont] = useState(0);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [hasBg, setHasBg] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Drag state
  const dragging = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Pinch state
  const pinchStart = useRef<{ dist: number; size: number } | null>(null);

  // Load background image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    const container = containerRef.current;
    if (!container) return;

    const maxW = container.clientWidth;
    const ratio = bgImage.width / bgImage.height;
    const w = maxW;
    const h = w / ratio;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(bgImage, 0, 0, w, h);

    // Safe area
    const mx = w * SAFE_MARGIN;
    const my = h * SAFE_MARGIN;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(mx, my, w - 2 * mx, h - 2 * my);
    ctx.setLineDash([]);

    // Draw texts
    texts.forEach((te) => {
      ctx.save();
      const tx = te.x * w;
      const ty = te.y * h;
      ctx.translate(tx, ty);
      ctx.rotate((te.rotation * Math.PI) / 180);
      ctx.font = `${te.fontSize}px ${te.font}`;
      const metrics = ctx.measureText(te.text);
      const textW = metrics.width;
      const textH = te.fontSize;

      if (te.hasBg) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-4, -textH, textW + 8, textH + 8);
      }
      ctx.fillStyle = te.color;
      ctx.fillText(te.text, 0, 0);

      // Selection highlight + handles
      if (selectedId === te.id) {
        const bx = -8, by = -textH - 4, bw = textW + 16, bh = textH + 16;
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
        // Draw handles at corners + midpoints
        const handles = [
          [bx, by], [bx + bw / 2, by], [bx + bw, by],
          [bx, by + bh / 2],              [bx + bw, by + bh / 2],
          [bx, by + bh], [bx + bw / 2, by + bh], [bx + bw, by + bh],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      ctx.restore();
    });

    // Draw logos
    logos.forEach((lo) => {
      const logoImg = logoImagesRef.current.get(lo.id);
      if (!logoImg) return;
      ctx.save();
      const lx = lo.x * w;
      const ly = lo.y * h;
      ctx.translate(lx, ly);
      ctx.rotate((lo.rotation * Math.PI) / 180);
      ctx.drawImage(logoImg, -lo.width / 2, -lo.height / 2, lo.width, lo.height);

      // Selection highlight + handles
      if (selectedId === lo.id) {
        const bx = -lo.width / 2 - 4, by = -lo.height / 2 - 4;
        const bw = lo.width + 8, bh = lo.height + 8;
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
        const handles = [
          [bx, by], [bx + bw / 2, by], [bx + bw, by],
          [bx, by + bh / 2],              [bx + bw, by + bh / 2],
          [bx, by + bh], [bx + bw / 2, by + bh], [bx + bw, by + bh],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      ctx.restore();
    });
  }, [bgImage, texts, logos, selectedId]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  // Wheel resize — must be non-passive to prevent page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!selectedId) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 8 : -8;
      setTexts(prev => prev.map(te =>
        te.id === selectedId ? { ...te, fontSize: Math.max(10, te.fontSize + delta) } : te
      ));
      setLogos(prev => prev.map(lo =>
        lo.id === selectedId
          ? { ...lo, width: Math.max(20, lo.width + delta), height: Math.max(20, lo.height + delta) }
          : lo
      ));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [selectedId]);

  // Get canvas-relative position (normalized 0-1)
  const getPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  // Find element at position
  const findElementAt = (pos: { x: number; y: number }) => {
    const threshold = 0.08;
    // Check logos first (on top)
    for (const lo of [...logos].reverse()) {
      if (Math.abs(lo.x - pos.x) < threshold && Math.abs(lo.y - pos.y) < threshold) {
        return lo.id;
      }
    }
    for (const te of [...texts].reverse()) {
      if (Math.abs(te.x - pos.x) < threshold && Math.abs(te.y - pos.y) < threshold) {
        return te.id;
      }
    }
    return null;
  };

  // Pointer down
  const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pos = getPos(clientX, clientY);
    const id = findElementAt(pos);
    setSelectedId(id);
    if (id) {
      dragging.current = id;
      const el = texts.find(t => t.id === id) || logos.find(l => l.id === id);
      if (el) dragOffset.current = { x: pos.x - el.x, y: pos.y - el.y };
    }
  };

  // Pointer move
  const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    // Pinch to resize (two fingers)
    if ("touches" in e && e.touches.length === 2 && selectedId) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!pinchStart.current) {
        const el = texts.find(t => t.id === selectedId) || logos.find(l => l.id === selectedId);
        const size = texts.find(t => t.id === selectedId)?.fontSize
          ?? logos.find(l => l.id === selectedId)?.width ?? 80;
        pinchStart.current = { dist, size };
        return;
      }

      const scale = dist / pinchStart.current.dist;
      const newSize = Math.max(12, Math.round(pinchStart.current.size * scale));

      setTexts(prev => prev.map(te =>
        te.id === selectedId ? { ...te, fontSize: newSize } : te
      ));
      setLogos(prev => prev.map(lo =>
        lo.id === selectedId ? { ...lo, width: newSize, height: newSize } : lo
      ));
      return;
    }

    pinchStart.current = null;

    if (!dragging.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pos = getPos(clientX, clientY);
    const newX = Math.max(SAFE_MARGIN, Math.min(1 - SAFE_MARGIN, pos.x - dragOffset.current.x));
    const newY = Math.max(SAFE_MARGIN, Math.min(1 - SAFE_MARGIN, pos.y - dragOffset.current.y));

    setTexts(prev => prev.map(te => te.id === dragging.current ? { ...te, x: newX, y: newY } : te));
    setLogos(prev => prev.map(lo => lo.id === dragging.current ? { ...lo, x: newX, y: newY } : lo));
  };

  const handlePointerUp = () => {
    dragging.current = null;
    pinchStart.current = null;
  };

  // Mouse wheel to resize selected element
  const handleWheel = (e: React.WheelEvent) => {
    if (!selectedId) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 6 : -6;
    resizeSelected(delta);
  };

  // Resize selected element
  const resizeSelected = (delta: number) => {
    if (!selectedId) return;
    setTexts(prev => prev.map(te =>
      te.id === selectedId ? { ...te, fontSize: Math.max(10, te.fontSize + delta) } : te
    ));
    setLogos(prev => prev.map(lo =>
      lo.id === selectedId
        ? { ...lo, width: Math.max(20, lo.width + delta), height: Math.max(20, lo.height + delta) }
        : lo
    ));
  };

  // Delete selected element
  const deleteSelected = () => {
    if (!selectedId) return;
    setTexts(prev => prev.filter(te => te.id !== selectedId));
    setLogos(prev => prev.filter(lo => lo.id !== selectedId));
    logoImagesRef.current.delete(selectedId);
    setSelectedId(null);
  };

  const addText = () => {
    if (!newText.trim()) return;
    const id = Date.now().toString();
    const te: TextElement = {
      id, text: newText, x: 0.5, y: 0.5,
      font: FONTS[selectedFont], color: selectedColor,
      fontSize: 28, rotation: 0, hasBg,
    };
    setTexts(prev => [...prev, te]);
    setSelectedId(id);
    setNewText("");
  };

  const applyTemplate = (template: "bottom" | "top" | "center") => {
    const positions = { bottom: { x: 0.5, y: 0.85 }, top: { x: 0.5, y: 0.12 }, center: { x: 0.5, y: 0.5 } };
    const id = Date.now().toString();
    setTexts([{
      id, text: newText || "Tu texto aquí",
      font: FONTS[selectedFont], color: selectedColor,
      fontSize: 28, rotation: 0, hasBg: template === "center",
      ...positions[template],
    }]);
    setSelectedId(id);
  };

  const addLogoToCanvas = (src: string) => {
    const id = Date.now().toString();
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImagesRef.current.set(id, img);
      setLogos(prev => [...prev, { id, src, x: 0.8, y: 0.15, width: 80, height: 80, rotation: 0 }]);
      setSelectedId(id);
    };
    img.onerror = () => {
      // Try without crossOrigin for same-origin images
      const img2 = new window.Image();
      img2.onload = () => {
        logoImagesRef.current.set(id, img2);
        setLogos(prev => [...prev, { id, src, x: 0.8, y: 0.15, width: 80, height: 80, rotation: 0 }]);
        setSelectedId(id);
      };
      img2.src = src;
    };
    img.src = src;
  };

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    setUploadingLogo(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file);
      if (error) throw error;
      const { data: url } = supabase.storage.from("brand-assets").getPublicUrl(path);
      await supabase.from("advertiser_brand_assets").insert({ advertiser_id: user.id, logo_path: url.publicUrl });
      addLogoToCanvas(url.publicUrl);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = () => {
    // Use the display canvas directly to avoid CORS tainted canvas issues
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Temporarily deselect so handles don't appear in saved image
      setSelectedId(null);
      // Use setTimeout to let React re-render (redraw without handles) before capturing
      setTimeout(() => {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          onSaveVersion(dataUrl);
        } catch (err) {
          toast({ title: "Error al guardar. Intenta de nuevo.", variant: "destructive" });
        }
      }, 80);
    } catch (err) {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const hasSelection = selectedId !== null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold">Editor</h2>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full touch-none select-none">
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg border border-border cursor-pointer"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      {/* Selection controls */}
      {hasSelection && (
        <div className="flex items-center justify-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-xs text-muted-foreground mr-2">Elemento seleccionado:</span>
          <Button size="sm" variant="outline" onClick={() => resizeSelected(-6)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => resizeSelected(6)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteSelected}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground ml-2">o pellizca con 2 dedos para redimensionar</span>
        </div>
      )}

      {/* Tools */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Templates */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Plantillas de texto</p>
            <div className="flex gap-2">
              {(["bottom", "top", "center"] as const).map((tmpl) => (
                <Button key={tmpl} variant="outline" size="sm" onClick={() => applyTemplate(tmpl)}>
                  <Layout className="h-3 w-3 mr-1" />
                  {t.advertiserDashboard[`template${tmpl.charAt(0).toUpperCase() + tmpl.slice(1)}` as keyof typeof t.advertiserDashboard]}
                </Button>
              ))}
            </div>
          </div>

          {/* Add text */}
          <div className="space-y-2">
            <div className="space-y-2">
              <Input
                placeholder='Ej: "Corte $15 • Tel: 555-1234"'
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addText()}
              />
              <Button onClick={addText} className="w-full" variant="outline">
                <Type className="h-4 w-4 mr-2" /> Agregar texto a la imagen
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {FONT_LABELS.map((label, i) => (
                <Button key={label} variant={selectedFont === i ? "default" : "outline"} size="sm"
                  onClick={() => setSelectedFont(i)} style={{ fontFamily: FONTS[i] }} className="text-xs">
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1.5 items-center flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => {
                  setSelectedColor(c);
                  // Apply color to selected text immediately
                  if (selectedId) {
                    setTexts(prev => prev.map(te =>
                      te.id === selectedId ? { ...te, color: c } : te
                    ));
                  }
                }}
                  className={`w-7 h-7 rounded-full border-2 ${selectedColor === c ? "border-primary scale-110" : "border-border"}`}
                  style={{ backgroundColor: c }} />
              ))}
              <label className="ml-3 flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={hasBg} onChange={(e) => setHasBg(e.target.checked)} />
                Fondo
              </label>
            </div>
          </div>

          {/* Logo */}
          <div className="flex gap-2 flex-wrap items-center">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Subiendo...</>
                : <><ImageIcon className="h-4 w-4 mr-1" /> Subir logo</>
              }
            </Button>
            {brandAssets && brandAssets.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => addLogoToCanvas(brandAssets[0].logo_path)} disabled={uploadingLogo}>
                <ImageIcon className="h-4 w-4 mr-1" /> Usar logo guardado
              </Button>
            )}
          </div>

          <Button onClick={handleSave} className="w-full">
            {t.advertiserDashboard.saveVersion}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageOverlayEditor;
