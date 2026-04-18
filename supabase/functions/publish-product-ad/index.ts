import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  shopify_product_id: string;
  title: string;
  handle: string;
  image_url: string;
  price: string;
  action: "publish" | "unpublish";
}

interface Partner {
  id: string;
  goaffpro_referral_link: string;
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

  // Require authentication
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

  // Verify the calling user's JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Check admin status via DB function — uses the user's own JWT so RLS applies
  const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_admin");
  if (adminCheckError) {
    return jsonResponse({ error: "Failed to verify admin status", detail: adminCheckError.message }, 500);
  }
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden: admin access required" }, 403);
  }

  // Parse and validate request body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { shopify_product_id, title, handle, image_url, price, action } = body;

  if (!shopify_product_id || !action) {
    return jsonResponse({ error: "Missing required fields: shopify_product_id, action" }, 400);
  }

  if (action !== "publish" && action !== "unpublish") {
    return jsonResponse({ error: 'action must be "publish" or "unpublish"' }, 400);
  }

  // Use the service role client for all DB write operations
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ── UNPUBLISH ────────────────────────────────────────────────────────────────
  if (action === "unpublish") {
    const { data: deletedRows, error: deleteError } = await adminClient
      .from("ads")
      .delete()
      .eq("type", "product")
      .eq("metadata->>shopify_product_id", shopify_product_id)
      .select("id");

    if (deleteError) {
      return jsonResponse({ error: "Failed to delete product ads", detail: deleteError.message }, 500);
    }

    return jsonResponse({ success: true, deleted: deletedRows?.length ?? 0 });
  }

  // ── PUBLISH ──────────────────────────────────────────────────────────────────

  // Validate required publish fields
  if (!title || !handle || !image_url || !price) {
    return jsonResponse(
      { error: "Missing required fields for publish: title, handle, image_url, price" },
      400,
    );
  }

  // 1. Delete any existing product ads for this product (clean slate)
  const { error: cleanupError } = await adminClient
    .from("ads")
    .delete()
    .eq("type", "product")
    .eq("metadata->>shopify_product_id", shopify_product_id);

  if (cleanupError) {
    return jsonResponse({ error: "Failed to clean up existing product ads", detail: cleanupError.message }, 500);
  }

  // 2. Fetch all approved partners with a referral link
  const { data: partners, error: partnersError } = await adminClient
    .from("partners")
    .select("id, goaffpro_referral_link")
    .eq("status", "approved")
    .not("goaffpro_referral_link", "is", null);

  if (partnersError) {
    return jsonResponse({ error: "Failed to fetch partners", detail: partnersError.message }, 500);
  }

  if (!partners || partners.length === 0) {
    return jsonResponse({ success: true, published_to: 0 });
  }

  // 3. Build one ad row per partner
  const adRows = (partners as Partner[]).flatMap((partner) => {
    const refCode = extractRefCode(partner.goaffpro_referral_link);
    if (!refCode) {
      // Skip partners whose referral link has no parseable ref param
      return [];
    }

    const affiliateUrl = `https://regalove.co/products/${handle}?ref=${refCode}`;

    return [{
      advertiser_id: null,
      type: "product",
      status: "published",
      final_media_path: image_url,
      qr_url: affiliateUrl,
      screen_id: partner.id,
      metadata: {
        shopify_product_id,
        title,
        handle,
        price,
        image_url,
      },
    }];
  });

  if (adRows.length === 0) {
    return jsonResponse({ success: true, published_to: 0 });
  }

  // 4. Bulk-insert all ad rows
  const { error: insertError } = await adminClient.from("ads").insert(adRows);

  if (insertError) {
    return jsonResponse({ error: "Failed to insert product ads", detail: insertError.message }, 500);
  }

  return jsonResponse({ success: true, published_to: adRows.length });
});
