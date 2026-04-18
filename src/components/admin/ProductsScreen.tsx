import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Loader2, ShoppingBag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  price: string;
  image_url: string | null;
}

interface ProductWithStatus extends ShopifyProduct {
  publishedCount: number;
  loadingPublish: boolean;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublishedCount = async (productId: string): Promise<number> => {
    const { count } = await supabase
      .from("ads")
      .select("id", { count: "exact" })
      .eq("type", "product")
      .eq("status", "published")
      .filter("metadata->>shopify_product_id", "eq", productId);
    return count ?? 0;
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        const body = await res.text();
        throw new Error(body || `Error ${res.status}`);
      }

      const json = await res.json();
      const raw: ShopifyProduct[] = json.products ?? json ?? [];

      // Fetch published counts in parallel
      const withStatus: ProductWithStatus[] = await Promise.all(
        raw.map(async (p) => ({
          ...p,
          publishedCount: await fetchPublishedCount(String(p.id)),
          loadingPublish: false,
        }))
      );

      setProducts(withStatus);
    } catch (err: any) {
      setError(err?.message ?? "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handlePublish = async (product: ProductWithStatus) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, loadingPublish: true } : p))
    );

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
        body: JSON.stringify({ ...product, action: "publish" }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Error ${res.status}`);
      }

      const json = await res.json();
      const count: number = json.screens ?? json.count ?? 0;

      toast.success(`Publicado en ${count} pantallas`, { id: `publish-${product.id}` });

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, publishedCount: count, loadingPublish: false } : p
        )
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Error al publicar", { id: `publish-${product.id}` });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, loadingPublish: false } : p))
      );
    }
  };

  const handleUnpublish = async (product: ProductWithStatus) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, loadingPublish: true } : p))
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No authenticated session");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      toast.loading("Despublicando...", { id: `unpublish-${product.id}` });

      const res = await fetch(`${supabaseUrl}/functions/v1/publish-product-ad`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ ...product, action: "unpublish" }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Error ${res.status}`);
      }

      toast.success("Producto despublicado", { id: `unpublish-${product.id}` });

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, publishedCount: 0, loadingPublish: false } : p
        )
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Error al despublicar", { id: `unpublish-${product.id}` });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, loadingPublish: false } : p))
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Productos Shopify
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Publica productos de tu tienda en las pantallas de socios
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchProducts}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Cargando productos desde Shopify...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 opacity-30" />
          <p className="text-sm">No se encontraron productos</p>
        </div>
      )}

      {/* Product list */}
      {!loading && !error && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 bg-card border border-border rounded-lg p-4"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="rounded-md object-cover"
                    style={{ width: 80, height: 80 }}
                  />
                ) : (
                  <div
                    className="rounded-md bg-muted flex items-center justify-center"
                    style={{ width: 80, height: 80 }}
                  >
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{product.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ${parseFloat(product.price).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                  {product.handle}
                </p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-3">
                {product.publishedCount > 0 ? (
                  <>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600/30 bg-green-600/10 whitespace-nowrap"
                    >
                      Publicado en {product.publishedCount} pantalla{product.publishedCount !== 1 ? "s" : ""}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpublish(product)}
                      disabled={product.loadingPublish}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap"
                    >
                      {product.loadingPublish && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Despublicar
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(product)}
                    disabled={product.loadingPublish}
                    className="gap-2 whitespace-nowrap"
                  >
                    {product.loadingPublish ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShoppingBag className="h-3.5 w-3.5" />
                    )}
                    Publicar en todas las pantallas
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
