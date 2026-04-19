import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  ShoppingBag,
  Upload,
  Trash2,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface Product {
  id: string;
  title: string;
  price: number;
  shopify_handle: string;
  media_url: string;
  media_type: "image" | "video";
  published_count: number;
  created_at: string;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [shopifyHandle, setShopifyHandle] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setProducts((data ?? []) as any as Product[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setShopifyHandle("");
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!title || !price || !shopifyHandle || !mediaFile) {
      toast.error("Completa todos los campos y sube una imagen o video");
      return;
    }

    const isImage = mediaFile.type.startsWith("image/");
    const isVideo = mediaFile.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("El archivo debe ser imagen o video");
      return;
    }

    setSaving(true);
    try {
      // 1. Upload media
      const path = `products/${Date.now()}-${mediaFile.name.replace(/\s/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(path, mediaFile, { contentType: mediaFile.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("ad-media").getPublicUrl(path);

      // 2. Insert product row
      const { error: insertErr } = await supabase.from("products" as any).insert({
        title,
        price: parseFloat(price),
        shopify_handle: shopifyHandle.trim(),
        media_url: urlData.publicUrl,
        media_type: isImage ? "image" : "video",
      });
      if (insertErr) throw insertErr;

      toast.success("Producto creado");
      resetForm();
      setDialogOpen(false);
      fetchProducts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (product: Product) => {
    setPublishingId(product.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No authenticated session");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      toast.loading("Publicando en pantallas...", { id: `publish-${product.id}` });

      const res = await fetch(`${supabaseUrl}/functions/v1/publish-product-ad`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ product_id: product.id, action: "publish" }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }

      const json = await res.json();
      const count: number = json.published_to ?? 0;
      toast.success(`Publicado en ${count} pantalla${count !== 1 ? "s" : ""}`, {
        id: `publish-${product.id}`,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, published_count: count } : p))
      );
    } catch (e: any) {
      toast.error(e.message ?? "Error al publicar", { id: `publish-${product.id}` });
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (product: Product) => {
    setPublishingId(product.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No authenticated session");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      toast.loading("Despublicando...", { id: `unpub-${product.id}` });

      const res = await fetch(`${supabaseUrl}/functions/v1/publish-product-ad`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ product_id: product.id, action: "unpublish" }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }

      toast.success("Producto despublicado", { id: `unpub-${product.id}` });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, published_count: 0 } : p))
      );
    } catch (e: any) {
      toast.error(e.message ?? "Error al despublicar", { id: `unpub-${product.id}` });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.title}"? Esta acción despublica y borra todo.`)) return;
    setDeletingId(product.id);
    try {
      // Unpublish first (removes ads rows)
      if (product.published_count > 0) {
        await handleUnpublish(product);
      }

      // Remove media from storage
      const mediaPath = product.media_url.split("/ad-media/")[1];
      if (mediaPath) {
        await supabase.storage.from("ad-media").remove([mediaPath]);
      }

      // Delete product row
      const { error } = await supabase.from("products" as any).delete().eq("id", product.id);
      if (error) throw error;

      toast.success("Producto eliminado");
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Productos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sube tu creatividad (imagen o video) por producto. El sistema la publica en las pantallas de todos los partners con su QR de afiliado GoAffPro.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay productos aún. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 bg-card border border-border rounded-lg p-4"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {product.media_type === "video" ? (
                  <video
                    src={product.media_url}
                    className="rounded-md object-cover bg-black"
                    style={{ width: 96, height: 96 }}
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={product.media_url}
                    alt={product.title}
                    className="rounded-md object-cover"
                    style={{ width: 96, height: 96 }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{product.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ${Number(product.price).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                  /{product.shopify_handle}
                </p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-3">
                {product.published_count > 0 ? (
                  <>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600/30 bg-green-600/10 whitespace-nowrap gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      En {product.published_count} pantalla{product.published_count !== 1 ? "s" : ""}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpublish(product)}
                      disabled={publishingId === product.id}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap"
                    >
                      {publishingId === product.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Despublicar
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(product)}
                    disabled={publishingId === product.id}
                    className="gap-2 whitespace-nowrap"
                  >
                    {publishingId === product.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Publicar en todas las pantallas
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(product)}
                  disabled={deletingId === product.id}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {deletingId === product.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Sube la creatividad (imagen o video). Deja el espacio inferior derecho libre — el sistema superpone el QR de afiliado de cada partner ahí.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dominican Pride Tee"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="24.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">Shopify handle</Label>
                <Input
                  id="handle"
                  value={shopifyHandle}
                  onChange={(e) => setShopifyHandle(e.target.value)}
                  placeholder="dominican-pride-tee"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              El handle es la última parte de la URL del producto en Shopify: <code>regalove.co/products/<b>dominican-pride-tee</b></code>
            </p>

            <div className="space-y-2">
              <Label>Imagen o video</Label>
              <label className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-md border-2 border-dashed border-border text-sm font-medium cursor-pointer hover:border-primary hover:text-primary transition-colors">
                <Upload className="h-4 w-4" />
                {mediaFile ? mediaFile.name : "Subir imagen o video"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setMediaFile(f);
                  }}
                />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
