/**
 * goaffpro-webhook — Receives GoAffPro sale notifications and records
 * 10% commission for the referring partner.
 *
 * Configure in GoAffPro → Settings → Webhooks → Order Created
 * URL: https://<project>.supabase.co/functions/v1/goaffpro-webhook
 *
 * Deploy: npx supabase functions deploy goaffpro-webhook --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMMISSION_RATE = 0.10; // 10%

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goaffpro-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("GOAFFPRO_WEBHOOK_SECRET"); // optional validation

    // Optional: verify GoAffPro webhook token
    if (webhookSecret) {
      const incomingToken = req.headers.get("x-goaffpro-token");
      if (incomingToken !== webhookSecret) {
        console.error("Invalid GoAffPro webhook token");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    console.log("GoAffPro webhook payload:", JSON.stringify(payload).slice(0, 1000));

    // GoAffPro sends different shapes depending on plan — normalize
    const order = payload.order ?? payload.data ?? payload;
    const affiliate = payload.affiliate ?? order.affiliate ?? {};

    const orderId   = String(order.id ?? order.order_id ?? order.order_number ?? "");
    const orderTotal = parseFloat(order.total ?? order.order_total ?? order.amount ?? "0");
    const affiliateId = String(
      affiliate.id ?? affiliate.affiliate_id ?? order.affiliate_id ?? ""
    );

    if (!orderId || !affiliateId || isNaN(orderTotal) || orderTotal <= 0) {
      console.warn("Missing required fields", { orderId, affiliateId, orderTotal });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find partner by GoAffPro affiliate ID
    const { data: partner, error: partnerErr } = await supabase
      .from("partners")
      .select("id")
      .eq("goaffpro_affiliate_id", affiliateId)
      .maybeSingle();

    if (partnerErr || !partner) {
      console.warn("Partner not found for affiliate_id:", affiliateId);
      // Return 200 so GoAffPro doesn't retry — this affiliate might not be in our system
      return new Response(JSON.stringify({ received: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commissionUsd = parseFloat((orderTotal * COMMISSION_RATE).toFixed(2));

    // Upsert on order_id to prevent double-counting if GoAffPro retries
    const { error: insertErr } = await supabase
      .from("partner_goaffpro_commissions")
      .upsert({
        partner_id: partner.id,
        order_id: orderId,
        order_total_usd: orderTotal,
        commission_usd: commissionUsd,
        goaffpro_affiliate_id: affiliateId,
      }, { onConflict: "order_id" });

    if (insertErr) {
      console.error("Insert error:", insertErr.message);
      throw new Error(insertErr.message);
    }

    console.log(`Commission recorded: partner=${partner.id} order=${orderId} commission=$${commissionUsd}`);

    return new Response(JSON.stringify({ received: true, matched: true, commission: commissionUsd }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("goaffpro-webhook error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
