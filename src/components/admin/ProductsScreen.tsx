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
  ChevronLeft,
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

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  price: string;
  image_url: string | null;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog steps: 1 = pick from Shopify, 2 = upload creative + confirm
  const [step, setStep] = useState<1 | 2>(1);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);
  const [selectedShopify, setSelectedShopify] = useState<ShopifyProduct | null>(null);
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

  const fetchShopifyProducts = useCallback(async () => {
    setShopifyLoading(true);
    setShopifyError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No authenticated session");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/get-shopify-products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const json = await res.json();
      setShopifyProducts((json.products ?? []) as ShopifyProduct[]);
    } catch (e: any) {
      setShopifyError(e.message ?? "Error al cargar productos de Shopify");
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  const openDialog = () => {
    setStep(1);
    setSelectedShopify(null);
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDialogOpen(true);
    fetchShopifyProducts();
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setStep(1);
    setSelectedShopify(null);
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!selectedShopify || !mediaFile) {
      toast.error("Selecciona un producto de Shopify y sube tu creatividad");
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
      const path = `products/${Date.now()}-${mediaFile.name.replace(/\s/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("ad-media")
        .upload(path, mediaFile, { contentType: mediaFile.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("ad-media").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("products" as any).insert({
        title: selectedShopify.title,
        price: parseFloat(selectedShopify.price),
        shopify_handle: selectedShopify.handle,
        media_url: urlData.publicUrl,
        media_type: isImage ? "image" : "video",
      });
      if (insertErr) throw insertErr;

      toast.success("Producto creado");
      closeDialog();
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
      if (product.published_count > 0) {
        await handleUnpublish(product);
      }

      const mediaPath = product.media_url.split("/ad-media/")[1];
      if (mediaPath) {
        await supabase.storage.from("ad-media").remove([mediaPath]);
      }

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

  // Filter out Shopify products already created locally so the admin doesn't
  // duplicate them by accident.
  const existingHandles = new Set(products.map((p) => p.shopify_handle));
  const availableShopify = shopifyProducts.filter((sp) => !existingHandles.has(sp.handle));

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
            Elige un producto de Shopify, sube tu creatividad (imagen o video) y publícalo en las pantallas. Cada partner recibe su QR de afiliado GoAffPro.
          </p>
        </div>
        <Button onClick={openDialog} className="gap-2">
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

              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{product.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ${Number(product.price).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                  /{product.shopify_handle}
                </p>
              </div>

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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl">
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Elegir producto de Shopify</DialogTitle>
                <DialogDescription>
                  Selecciona el producto que quieres anunciar. El título, precio y handle se autocompletan.
                </DialogDescription>
              </DialogHeader>

              {shopifyLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Cargando productos de Shopify...</p>
                </div>
              ) : shopifyError ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
                  <p className="text-sm text-center">{shopifyError}</p>
                  <Button variant="outline" size="sm" onClick={fetchShopifyProducts}>
                    Reintentar
                  </Button>
                </div>
              ) : availableShopify.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 opacity-30" />
                  <p className="text-sm text-center">
                    {shopifyProducts.length === 0
                      ? "No se encontraron productos activos en Shopify."
                      : "Ya creaste anuncios para todos los productos de Shopify."}
                  </p>
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
                  {availableShopify.map((sp) => (
                    <button
                      key={sp.id}
                      onClick={() => {
                        setSelectedShopify(sp);
                        setStep(2);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-colors text-left"
                    >
                      {sp.image_url ? (
                        <img
                          src={sp.image_url}
                          alt={sp.title}
                          className="rounded object-cover flex-shrink-0"
                          style={{ width: 56, height: 56 }}
                        />
                      ) : (
                        <div
                          className="rounded bg-muted flex items-center justify-center flex-shrink-0"
                          style={{ width: 56, height: 56 }}
                        >
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sp.title}</p>
                        <p className="text-sm text-muted-foreground">
                          ${parseFloat(sp.price).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground/60 font-mono truncate">
                          /{sp.handle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Volver"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  Subir creatividad
                </DialogTitle>
                <DialogDescription>
                  Sube la imagen o video publicitario. Deja el espacio inferior derecho libre — el sistema superpone el QR de afiliado de cada partner ahí.
                </DialogDescription>
              </DialogHeader>

              {selectedShopify && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  {selectedShopify.image_url ? (
                    <img
                      src={selectedShopify.image_url}
                      alt={selectedShopify.title}
                      className="rounded object-cover"
                      style={{ width: 48, height: 48 }}
                    />
                  ) : (
                    <div
                      className="rounded bg-muted flex items-center justify-center"
                      style={{ width: 48, height: 48 }}
                    >
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedShopify.title}</p>
                    <p className="text-xs text-muted-foreground">
                      ${parseFloat(selectedShopify.price).toFixed(2)} · /{selectedShopify.handle}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Imagen o video publicitario</Label>
                <label className="flex items-center justify-center gap-2 w-full h-14 px-4 rounded-md border-2 border-dashed border-border text-sm font-medium cursor-pointer hover:border-primary hover:text-primary transition-colors">
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
                <p className="text-xs text-muted-foreground">
                  Recomendado: 1920×1080 (16:9). Deja ~120×120px libres abajo a la derecha para el QR.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                  Atrás
                </Button>
                <Button onClick={handleCreate} disabled={saving || !mediaFile} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
