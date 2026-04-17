import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

serve(async () => {
  try {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not set" }), { status: 500, headers: { "Content-Type": "application/json" } });

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-08-27.basil",
  });

  const projectRef = "qrlzbveaoibyidpwlwmz";
  const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/stripe-webhook`;

  const events = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ];

  // Check if webhook already exists
  const existing = await stripe.webhookEndpoints.list({ limit: 20 });
  const alreadyExists = existing.data.find((w) => w.url === webhookUrl);
  if (alreadyExists) {
    return new Response(JSON.stringify({
      message: "Webhook already exists",
      id: alreadyExists.id,
      url: alreadyExists.url,
      note: "Cannot retrieve signing secret from existing webhook. Delete and re-run to get a new one.",
    }), { headers: { "Content-Type": "application/json" } });
  }

  const webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
    description: "AdScreenPro subscription events",
  });

  return new Response(JSON.stringify({
    id: webhook.id,
    url: webhook.url,
    signing_secret: webhook.secret,
  }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
