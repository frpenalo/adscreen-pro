/**
 * get-shopify-products — Fetches active products from the Shopify store
 * using the Storefront API (GraphQL) so the admin can pick a product and
 * autofill title / price / handle instead of typing them manually.
 *
 * Secrets required (set in Supabase dashboard):
 *   SHOPIFY_STORE_DOMAIN      e.g. "yourshop.myshopify.com" (internal domain, NOT the custom domain)
 *   SHOPIFY_STOREFRONT_TOKEN  Public Storefront API token from the Headless sales channel app
 *
 * Auth: admin only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const PRODUCTS_QUERY = `
  {
    products(first: 250, query: "status:active") {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
          priceRange { minVariantPrice { amount } }
        }
      }
    }
  }
`;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const shopDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const storefrontToken = Deno.env.get("SHOPIFY_STOREFRONT_TOKEN");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Server configuration error (supabase env)" }, 500);
  }
  if (!shopDomain || !storefrontToken) {
    return jsonResponse(
      { error: "Shopify not configured: set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN secrets" },
      500,
    );
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

  // Query Shopify Storefront API
  const shopifyRes = await fetch(
    `https://${shopDomain}/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({ query: PRODUCTS_QUERY }),
    },
  );

  if (!shopifyRes.ok) {
    const text = await shopifyRes.text();
    return jsonResponse(
      { error: `Shopify API error (${shopifyRes.status})`, detail: text.slice(0, 500) },
      502,
    );
  }

  const shopifyJson = await shopifyRes.json();
  if (shopifyJson.errors) {
    return jsonResponse({ error: "Shopify GraphQL errors", detail: shopifyJson.errors }, 502);
  }

  interface ShopifyEdge {
    node: {
      id: string;
      title: string;
      handle: string;
      featuredImage?: { url: string } | null;
      priceRange?: { minVariantPrice?: { amount: string } };
    };
  }

  const edges: ShopifyEdge[] = shopifyJson?.data?.products?.edges ?? [];

  const products = edges.map((edge) => {
    const n = edge.node;
    // gid://shopify/Product/123456 → "123456"
    const numericId = n.id.split("/").pop() ?? n.id;
    return {
      id: numericId,
      title: n.title,
      handle: n.handle,
      image_url: n.featuredImage?.url ?? null,
      price: n.priceRange?.minVariantPrice?.amount ?? "0.00",
    };
  });

  return jsonResponse({ products });
});
