import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_SCREENS = "price_1UYcTuFCkjgus2pTH73yEfd0"; // $79/mes
const PRICE_RALEIGH360 = "price_1UYcYgFCkjgus2pTXtWc9pPS"; // $99/mes, pantallas + Kultura Radio

// Stripe solo acepta [A-Za-z0-9_-] (máx. 200) en client_reference_id.
const REF_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan ?? user.user_metadata?.plan;
    const isRaleigh360 = plan === "raleigh360";
    const rawRef = body?.ref ?? user.user_metadata?.kultura_ref;
    const ref = typeof rawRef === "string" && REF_PATTERN.test(rawRef) ? rawRef : undefined;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: isRaleigh360 ? PRICE_RALEIGH360 : PRICE_SCREENS, quantity: 1 }],
      mode: "subscription",
      success_url: isRaleigh360
        ? "https://kulturaradio.com/tu-cuna.html?s={CHECKOUT_SESSION_ID}"
        : `${origin}/dashboard/advertiser?checkout=success`,
      cancel_url: `${origin}/dashboard/advertiser?checkout=cancel`,
      ...(isRaleigh360
        ? {
            metadata: { plan: "raleigh360" },
            ...(ref ? { client_reference_id: ref } : {}),
          }
        : {}),
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
