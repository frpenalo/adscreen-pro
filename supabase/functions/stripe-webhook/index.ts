import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("Signature verification failed", { error: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  logStep("Event received", { type: event.type });

  const getAdvertiserByCustomerId = async (customerId: string) => {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;
    if (!email) { logStep("No email on customer", { customerId }); return null; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (!profile) { logStep("Profile not found", { email }); return null; }

    const { data: advertiser } = await supabase
      .from("advertisers")
      .select("id, referred_partner_id")
      .eq("id", profile.id)
      .single();

    return advertiser ?? null;
  };

  const setActive = async (customerId: string, active: boolean) => {
    const advertiser = await getAdvertiserByCustomerId(customerId);
    if (!advertiser) return;

    const { error } = await supabase
      .from("advertisers")
      .update({ is_active: active, ...(active ? { activated_at: new Date().toISOString() } : {}) })
      .eq("id", advertiser.id);

    if (error) logStep("DB update error", { error: error.message });
    else logStep(`is_active = ${active}`, { advertiser_id: advertiser.id });
  };

  // Record 20% referral commission for the partner when an invoice is paid
  const recordReferralCommission = async (customerId: string, amountPaid: number) => {
    const advertiser = await getAdvertiserByCustomerId(customerId);
    if (!advertiser?.referred_partner_id) return;

    const commission = parseFloat((amountPaid * 0.20).toFixed(2));
    const month = new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01

    // Upsert to avoid double-counting if webhook fires twice
    const { error } = await supabase
      .from("partner_referral_earnings_manual")
      .upsert({
        partner_id: advertiser.referred_partner_id,
        advertiser_id: advertiser.id,
        month,
        amount_usd: commission,
      }, { onConflict: "partner_id,advertiser_id,month" });

    if (error) logStep("Commission insert error", { error: error.message });
    else logStep("Commission recorded", { partner_id: advertiser.referred_partner_id, commission, month });
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const isActive = sub.status === "active" || sub.status === "trialing";
      await setActive(sub.customer as string, isActive);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setActive(sub.customer as string, false);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.customer) break;
      const amountPaid = (invoice.amount_paid ?? 0) / 100; // Stripe sends cents
      await setActive(invoice.customer as string, true);
      await recordReferralCommission(invoice.customer as string, amountPaid);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) await setActive(invoice.customer as string, false);
      break;
    }
    default:
      logStep("Unhandled event, ignoring");
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
