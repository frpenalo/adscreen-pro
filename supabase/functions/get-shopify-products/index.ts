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

  // Supabase validates the apikey/JWT automatically before the request reaches here.
  // We just need the service role client for DB operations.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Shopify Storefront API credentials
  const shopifyDomain   = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const storefrontToken = Deno.env.get("SHOPIFY_STOREFRONT_TOKEN");

  if (!shopifyDomain || !storefrontToken) {
    return new Response(
      JSON.stringify({ error: "SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Storefront API GraphQL query
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
    const numericId = node.id.split("/").pop() ?? node.id;
    return {
      id: numericId,
      title: node.title,
      handle: node.handle,
      image_url: node.featuredImage?.url ?? null,
      price: node.priceRange?.minVariantPrice?.amount ?? "0.00",
    };
  });

  console.log(`Returning ${products.length} products`);

  return new Response(
    JSON.stringify({ products }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
