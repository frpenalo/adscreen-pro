import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Verify the user's JWT using service role key (supports ES256)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.replace("Bearer ", "").trim();
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Shopify Storefront API credentials
  const shopifyDomain      = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const storefrontToken    = Deno.env.get("SHOPIFY_STOREFRONT_TOKEN");

  if (!shopifyDomain || !storefrontToken) {
    return new Response(
      JSON.stringify({ error: "SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Use Storefront API (GraphQL) to fetch products
  const query = `{
    products(first: 250, query: "status:active") {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
          priceRange {
            minVariantPrice { amount }
          }
        }
      }
    }
  }`;

  let shopifyResponse: Response;
  try {
    shopifyResponse = await fetch(
      `https://${shopifyDomain}/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Storefront-Access-Token": storefrontToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to reach Shopify Storefront API", detail: String(err) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (!shopifyResponse.ok) {
    const body = await shopifyResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "Shopify Storefront API error", status: shopifyResponse.status, detail: body }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const json = await shopifyResponse.json();

  if (json.errors) {
    return new Response(
      JSON.stringify({ error: "Shopify GraphQL error", detail: json.errors }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const edges = json?.data?.products?.edges ?? [];

  const products: NormalizedProduct[] = edges.map((edge: any) => {
    const node = edge.node;
    // Storefront API returns gid://shopify/Product/123456 — extract numeric ID
    const numericId = node.id.split("/").pop() ?? node.id;
    return {
      id: numericId,
      title: node.title,
      handle: node.handle,
      image_url: node.featuredImage?.url ?? null,
      price: node.priceRange?.minVariantPrice?.amount ?? "0.00",
    };
  });

  return new Response(
    JSON.stringify({ products }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
