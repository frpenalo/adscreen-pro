import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface ShopifyImage {
  src: string;
}

interface ShopifyVariant {
  price: string;
}

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Require authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Verify the user's JWT with the admin client
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

  // Read Shopify credentials
  const shopifyDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const shopifyToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");

  if (!shopifyDomain || !shopifyToken) {
    return new Response(
      JSON.stringify({ error: "Shopify credentials not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Fetch products from Shopify
  const shopifyUrl =
    `https://${shopifyDomain}/admin/api/2024-01/products.json?status=active&limit=250`;

  let shopifyResponse: Response;
  try {
    shopifyResponse = await fetch(shopifyUrl, {
      headers: {
        "X-Shopify-Access-Token": shopifyToken,
        "Content-Type": "application/json",
      },
    });
  } catch (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to reach Shopify API", detail: String(fetchError) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (!shopifyResponse.ok) {
    const body = await shopifyResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "Shopify API returned an error",
        status: shopifyResponse.status,
        detail: body,
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let shopifyData: { products: ShopifyProduct[] };
  try {
    shopifyData = await shopifyResponse.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse Shopify API response" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Normalize to the expected shape
  const products: NormalizedProduct[] = (shopifyData.products ?? []).map(
    (product: ShopifyProduct) => ({
      id: String(product.id),
      title: product.title,
      handle: product.handle,
      image_url: product.images?.[0]?.src ?? null,
      price: product.variants?.[0]?.price ?? "0.00",
    }),
  );

  return new Response(
    JSON.stringify({ products }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
