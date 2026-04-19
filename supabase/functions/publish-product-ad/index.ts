/**
 * publish-product-ad — Publica/despublica un producto en todas las
 * pantallas de partners aprobados.
 *
 * POST body: { product_id: string, action: "publish" | "unpublish" }
 *
 * Flujo publish:
 * 1. Carga el producto desde la tabla `products`
 * 2. Borra ads existentes de ese producto (clean slate — evita duplicados)
 * 3. Inserta 1 ad por partner aprobado con su QR de afiliado GoAffPro
 * 4. Actualiza products.published_count
 *
 * El QR apunta a https://adscreenpro.com/r/{ad_id}/{partner_id} para que
 * cada escaneo quede registrado en ad_clicks antes de redirigir a
 * regalove.co/products/{handle}?ref={partner_ref_code}, donde GoAffPro
 * acredita la compra al partner dueño de la pantalla.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  product_id: string;
  action: "publish" | "unpublish";
}

interface Partner {
  id: string;
  goaffpro_referral_link: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  shopify_handle: string;
  media_url: string;
  media_type: "image" | "video";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extractRefCode(referralLink: string): string | null {
  try {
    const url = new URL(referralLink);
    return url.searchParams.get("ref");
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_admin");
  if (adminCheckError) {
    return jsonResponse({ error: "Failed to verify admin status", detail: adminCheckError.message }, 500);
  }
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden: admin access required" }, 403);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { product_id, action } = body;

  if (!product_id || !action) {
    return jsonResponse({ error: "Missing required fields: product_id, action" }, 400);
  }

  if (action !== "publish" && action !== "unpublish") {
    return jsonResponse({ error: 'action must be "publish" or "unpublish"' }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ── UNPUBLISH ────────────────────────────────────────────────────────────────
  if (action === "unpublish") {
    const { data: deletedRows, error: deleteError } = await adminClient
      .from("ads")
      .delete()
      .filter("metadata->>product_id", "eq", product_id)
      .select("id");

    if (deleteError) {
      return jsonResponse({ error: "Failed to delete product ads", detail: deleteError.message }, 500);
    }

    await adminClient
      .from("products")
      .update({ published_count: 0, updated_at: new Date().toISOString() })
      .eq("id", product_id);

    return jsonResponse({ success: true, deleted: deletedRows?.length ?? 0 });
  }

  // ── PUBLISH ──────────────────────────────────────────────────────────────────

  // 1. Load product
  const { data: product, error: productError } = await adminClient
    .from("products")
    .select("id, title, price, shopify_handle, media_url, media_type")
    .eq("id", product_id)
    .single<Product>();

  if (productError || !product) {
    return jsonResponse({ error: "Product not found", detail: productError?.message }, 404);
  }

  // 2. Clean slate — delete existing ads for this product
  const { error: cleanupError } = await adminClient
    .from("ads")
    .delete()
    .filter("metadata->>product_id", "eq", product_id);

  if (cleanupError) {
    return jsonResponse({ error: "Failed to clean up existing product ads", detail: cleanupError.message }, 500);
  }

  // 3. Fetch all approved partners with a GoAffPro referral link
  const { data: partners, error: partnersError } = await adminClient
    .from("partners")
    .select("id, goaffpro_referral_link")
    .eq("status", "approved")
    .not("goaffpro_referral_link", "is", null);

  if (partnersError) {
    return jsonResponse({ error: "Failed to fetch partners", detail: partnersError.message }, 500);
  }

  if (!partners || partners.length === 0) {
    await adminClient
      .from("products")
      .update({ published_count: 0, updated_at: new Date().toISOString() })
      .eq("id", product_id);
    return jsonResponse({ success: true, published_to: 0 });
  }

  // 4. Build one ad per partner with their individual affiliate QR
  //    We pre-generate the ad id so the QR can point to our trackable
  //    redirect route /r/:adId/:screenId which logs ad_clicks before
  //    forwarding to GoAffPro-tagged Regalove URL.
  const adRows = (partners as Partner[]).flatMap((partner) => {
    const refCode = extractRefCode(partner.goaffpro_referral_link);
    if (!refCode) return [];

    const adId = crypto.randomUUID();
    const trackableUrl = `https://adscreenpro.com/r/${adId}/${partner.id}`;

    return [{
      id: adId,
      advertiser_id: null,
      type: product.media_type, // 'image' or 'video'
      status: "published",
      final_media_path: product.media_url,
      qr_url: trackableUrl,
      screen_id: partner.id,
      metadata: {
        product_id: product.id,
        shopify_handle: product.shopify_handle,
        title: product.title,
        price: String(product.price),
        ref_code: refCode,
      },
    }];
  });

  if (adRows.length === 0) {
    await adminClient
      .from("products")
      .update({ published_count: 0, updated_at: new Date().toISOString() })
      .eq("id", product_id);
    return jsonResponse({ success: true, published_to: 0 });
  }

  const { error: insertError } = await adminClient.from("ads").insert(adRows);

  if (insertError) {
    return jsonResponse({ error: "Failed to insert product ads", detail: insertError.message }, 500);
  }

  // 5. Update published_count on product
  await adminClient
    .from("products")
    .update({ published_count: adRows.length, updated_at: new Date().toISOString() })
    .eq("id", product_id);

  return jsonResponse({ success: true, published_to: adRows.length });
});
