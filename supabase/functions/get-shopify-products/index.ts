import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ShopifyImage { src: string; }
interface ShopifyVariant { price: string; }
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
}
interface NormalizedProduct {
  id: string;
  title: string;
  handle: string;
  image_url: string | null;
  price: string;
}

// Request a fresh access token via Client Credentials grant (expires in 24h)
async function getShopifyAccessToken(domain: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shopify OAuth failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token in Shopify OAuth response");
  return json.access_token;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Require authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the user's JWT
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Shopify credentials
  const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const clientId      = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret  = Deno.env.get("SHOPIFY_CLIENT_SECRET");

  if (!shopifyDomain || !clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "Shopify credentials not configured (SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET)" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Get fresh access token
  let accessToken: string;
  try {
    accessToken = await getShopifyAccessToken(shopifyDomain, clientId, clientSecret);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Failed to obtain Shopify access token", detail: err.message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Fetch active products from Shopify Admin API
  let shopifyResponse: Response;
  try {
    shopifyResponse = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`,
      { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to reach Shopify API", detail: String(err) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (!shopifyResponse.ok) {
    const body = await shopifyResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "Shopify API error", status: shopifyResponse.status, detail: body }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const shopifyData: { products: ShopifyProduct[] } = await shopifyResponse.json();

  const products: NormalizedProduct[] = (shopifyData.products ?? []).map((p) => ({
    id: String(p.id),
    title: p.title,
    handle: p.handle,
    image_url: p.images?.[0]?.src ?? null,
    price: p.variants?.[0]?.price ?? "0.00",
  }));

  return new Response(
    JSON.stringify({ products }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
