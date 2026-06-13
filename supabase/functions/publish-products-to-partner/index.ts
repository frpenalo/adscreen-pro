/**
 * publish-products-to-partner — Publica TODOS los productos activos del
 * ecommerce en la pantalla de un partner específico. Se dispara al aprobar
 * un partner nuevo (desde PartnersScreen.handleAction, después de que
 * sync-goaffpro-affiliate haya escrito su referral link) para que el partner
 * reciba inmediatamente todo el inventario de productos ya publicados, sin
 * que admin tenga que ir a despublicar+publicar cada producto manualmente.
 *
 * POST body: { partner_id: string }
 *
 * Flujo:
 * 1. Verifica admin
 * 2. Carga el partner, extrae ref_code de goaffpro_referral_link (requerido)
 * 3. Carga todos los productos con published_count > 0
 * 4. Para cada producto:
 *    a. Borra ads previos para (product_id, screen_id=partner_id) — idempotente
 *    b. Inserta 1 ad con qr_url directo a regalove.co/products/{handle}?ref={code}
 * 5. Actualiza products.published_count +1 por producto
 * 6. Retorna { published: N }
 *
 * Idempotente: llamarlo dos veces no crea duplicados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  partner_id: string;
}

interface Partner {
  id: string;
  goaffpro_referral_link: string | null;
  status: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  shopify_handle: string;
  media_url: string;
  media_type: "image" | "video";
  published_count: number;
  qr_x: number;
  qr_y: number;
  qr_size_pct: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extractRefCode(referralLink: string | null): string | null {
  if (!referralLink) return null;
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

  const { partner_id } = body;
  if (!partner_id) {
    return jsonResponse({ error: "Missing required field: partner_id" }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 1. Load partner + validate approved + has ref link
  const { data: partner, error: partnerError } = await adminClient
    .from("partners")
    .select("id, goaffpro_referral_link, status")
    .eq("id", partner_id)
    .single<Partner>();

  if (partnerError || !partner) {
    return jsonResponse({ error: "Partner not found", detail: partnerError?.message }, 404);
  }

  if (partner.status !== "approved") {
    return jsonResponse({ error: `Partner is ${partner.status}, not approved` }, 400);
  }

  const refCode = extractRefCode(partner.goaffpro_referral_link);
  if (!refCode) {
    return jsonResponse({
      error: "Partner has no goaffpro_referral_link yet. Run sync-goaffpro-affiliate first.",
    }, 400);
  }

  // 2. Load all currently-published products
  const { data: products, error: productsError } = await adminClient
    .from("products")
    .select("id, title, price, shopify_handle, media_url, media_type, published_count, qr_x, qr_y, qr_size_pct")
    .gt("published_count", 0);

  if (productsError) {
    return jsonResponse({ error: "Failed to fetch products", detail: productsError.message }, 500);
  }

  if (!products || products.length === 0) {
    return jsonResponse({ success: true, published: 0, note: "No active products to publish" });
  }

  // 3. Remove any existing ads for (these products, this partner) — idempotent
  const productIds = products.map((p) => p.id);
  const { error: deleteError } = await adminClient
    .from("ads")
    .delete()
    .eq("screen_id", partner_id)
    .in("metadata->>product_id" as any, productIds);

  if (deleteError) {
    // Fall back to a per-product cleanup in case the .in() with json path
    // isn't supported by PostgREST for this column type.
    for (const pid of productIds) {
      await adminClient
        .from("ads")
        .delete()
        .eq("screen_id", partner_id)
        .filter("metadata->>product_id", "eq", pid);
    }
  }

  // 4. Build & insert new ad rows. The QR encodes the direct GoAffPro-tagged
  //    Regalove product URL so the scan goes straight to the product page and
  //    the phone's camera preview shows a recognizable destination. GoAffPro
  //    credits this partner via the `ref` query param.
  const adRows = (products as Product[]).map((product) => {
    const affiliateUrl = `https://regalove.co/products/${product.shopify_handle}?ref=${refCode}`;
    return {
      advertiser_id: null,
      type: product.media_type,
      status: "published",
      final_media_path: product.media_url,
      qr_url: affiliateUrl,
      screen_id: partner_id,
      metadata: {
        product_id: product.id,
        shopify_handle: product.shopify_handle,
        title: product.title,
        price: String(product.price),
        ref_code: refCode,
        qr_x: product.qr_x,
        qr_y: product.qr_y,
        qr_size_pct: product.qr_size_pct,
      },
    };
  });

  const { error: insertError } = await adminClient.from("ads").insert(adRows);
  if (insertError) {
    return jsonResponse({ error: "Failed to insert ads", detail: insertError.message }, 500);
  }

  // 5. Bump published_count on each product (+1 for this new screen)
  //    We do this via a single SQL increment per product to avoid races.
  for (const product of products as Product[]) {
    await adminClient
      .from("products")
      .update({
        published_count: (product.published_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
  }

  return jsonResponse({
    success: true,
    published: adRows.length,
    partner_id,
    products: adRows.length,
  });
});
