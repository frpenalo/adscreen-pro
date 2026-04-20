import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Film,
  Upload,
  Trash2,
  Plus,
  Image as ImageIcon,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FillerAd {
  id: string;
  type: "image" | "video" | "product";
  status: "draft" | "approved" | "published" | "rejected";
  final_media_path: string | null;
  metadata: { kind?: string; label?: string } | null;
  created_at: string;
}

const MEDIA_BUCKET = "ad-media";

const FillerScreen = () => {
  const [items, setItems] = useState<FillerAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Filler = general ads (screen_id NULL, advertiser_id NULL) with kind=filler
    const { data, error } = await supabase
      .from("ads")
      .select("id, type, status, final_media_path, metadata, created_at")
      .is("screen_id" as any, null)
      .is("advertiser_id", null)
      .filter("metadata->>kind", "eq", "filler")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setItems((data ?? []) as any as FillerAd[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = () => {
    setFile(null);
    setLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    setSaving(true);
    try {
      // 1. Upload to ad-media/filler/
      const path = `filler/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      const mediaUrl = pub.publicUrl;

      // 2. Insert ads row (general filler: no screen_id, no advertiser, no qr)
      const { error: insertError } = await supabase.from("ads").insert({
        advertiser_id: null,
        type: mediaType,
        status: "published",
        final_media_path: mediaUrl,
        metadata: { kind: "filler", label: label.trim() || null },
      } as any);
      if (insertError) throw insertError;

      toast.success("Filler publicado en todas las pantallas");
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir filler");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: FillerAd) => {
    setTogglingId(item.id);
    const nextStatus = item.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("ads")
      .update({ status: nextStatus })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      toast.success(nextStatus === "published" ? "Activado" : "Pausado");
      await load();
    }
    setTogglingId(null);
  };

  const remove = async (item: FillerAd) => {
    if (!confirm("¿Eliminar este filler? También se borrará el archivo.")) return;
    setDeletingId(item.id);
    try {
      // Try to delete the storage object too (best-effort)
      const url = item.final_media_path ?? "";
      const marker = `/${MEDIA_BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const objectPath = url.substring(idx + marker.length);
        await supabase.storage.from(MEDIA_BUCKET).remove([objectPath]);
      }
      const { error } = await supabase.from("ads").delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Filler eliminado");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6" /> Filler Content
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Contenido genérico (imagen o video) que se reproduce en <b>todas</b> las
            pantallas sin QR. Útil para promociones de la casa, mensajes institucionales
            o filler cuando falta inventario de anunciantes.
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Subir filler
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 flex flex-col items-center gap-3">
          <ImageIcon className="h-10 w-10 opacity-30" />
          <p className="text-sm text-muted-foreground">Aún no has subido contenido filler.</p>
          <Button variant="outline" onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" /> Subir el primero
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isActive = item.status === "published";
            return (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
                <div className="aspect-video bg-muted relative">
                  {item.type === "video" ? (
                    <video
                      src={item.final_media_path ?? ""}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                    />
                  ) : (
                    <img
                      src={item.final_media_path ?? ""}
                      alt={item.metadata?.label ?? "filler"}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Badge
                    className={`absolute top-2 left-2 ${
                      isActive ? "bg-green-500/90" : "bg-muted-foreground/80"
                    } text-white`}
                  >
                    {isActive ? "Activo" : "Pausado"}
                  </Badge>
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">
                      {item.metadata?.label || "Sin etiqueta"}
                    </p>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStatus(item)}
                      disabled={togglingId === item.id}
                    >
                      {togglingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isActive ? (
                        <>
                          <PowerOff className="h-3.5 w-3.5 mr-1.5" /> Pausar
                        </>
                      ) : (
                        <>
                          <Power className="h-3.5 w-3.5 mr-1.5" /> Activar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir filler</DialogTitle>
            <DialogDescription>
              Se publicará automáticamente en todas las pantallas, sin QR. Puedes pausarlo
              o eliminarlo después.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Etiqueta (opcional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej. Promo de verano"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={60}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Archivo (imagen o video)
              </label>
              <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-xs file:cursor-pointer"
                />
                {file && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={saving || !file}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" /> Publicar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FillerScreen;
