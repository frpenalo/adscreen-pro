import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_TEMPLATES = 3;

const useSalesTemplates = () =>
  useQuery({
    queryKey: ["sales-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_templates" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

const SalesTemplatesScreen = () => {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useSalesTemplates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    if (templates.length >= MAX_TEMPLATES) {
      toast.error("Máximo 3 plantillas. Elimina una antes de subir.");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Solo se aceptan imágenes o videos.");
      return;
    }
    setUploading(true);
    try {
      const path = `sales-templates/${Date.now()}-${file.name.replace(/\s/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("ad-media").getPublicUrl(path);
      const { error: insertErr } = await supabase
        .from("sales_templates" as any)
        .insert({ image_url: urlData.publicUrl, type: file.type.startsWith("video/") ? "video" : "image", is_active: templates.length === 0 });
      if (insertErr) throw insertErr;

      toast.success("Plantilla subida");
      queryClient.invalidateQueries({ queryKey: ["sales-templates"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleActivate = async (id: string) => {
    setActivating(id);
    try {
      // Deactivate all
      await supabase.from("sales_templates" as any).update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      // Activate selected
      const { error } = await supabase.from("sales_templates" as any).update({ is_active: true }).eq("id", id);
      if (error) throw error;
      toast.success("Plantilla activa actualizada");
      queryClient.invalidateQueries({ queryKey: ["sales-templates"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    setDeleting(id);
    try {
      // Delete from storage
      const path = imageUrl.split("/ad-media/")[1];
      if (path) await supabase.storage.from("ad-media").remove([path]);
      // Delete from DB
      const { error } = await supabase.from("sales_templates" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Plantilla eliminada");
      queryClient.invalidateQueries({ queryKey: ["sales-templates"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Plantillas de Venta</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          La plantilla activa se publica automáticamente en la pantalla de cada partner cuando lo apruebas.
          El QR de registro con su referido se agrega automáticamente.
        </p>
      </div>

      {/* Upload */}
      {templates.length < MAX_TEMPLATES && (
        <label className={`flex items-center justify-center gap-2 w-full h-12 px-4 rounded-md border-2 border-dashed border-border text-sm font-medium cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:text-primary"}`}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Subiendo..." : `Subir plantilla (${templates.length}/${MAX_TEMPLATES})`}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
        </label>
      )}

      {/* Templates grid */}
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay plantillas aún. Sube una imagen.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {templates.map((tpl: any) => (
            <Card key={tpl.id} className={`overflow-hidden ${tpl.is_active ? "ring-2 ring-primary" : ""}`}>
              <div className="relative">
                {tpl.type === "video"
                  ? <video src={tpl.image_url} className="w-full aspect-video object-cover" muted playsInline />
                  : <img src={tpl.image_url} alt="" className="w-full aspect-video object-cover" />
                }
                {tpl.is_active && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-primary text-primary-foreground gap-1">
                      <CheckCircle className="h-3 w-3" /> Activa
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3 flex gap-2">
                {!tpl.is_active && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleActivate(tpl.id)}
                    disabled={activating === tpl.id}
                  >
                    {activating === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Seleccionar"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(tpl.id, tpl.image_url)}
                  disabled={deleting === tpl.id}
                >
                  {deleting === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesTemplatesScreen;
