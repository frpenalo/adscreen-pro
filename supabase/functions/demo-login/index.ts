import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "demo@adscreenpro.com";
const DEMO_PASSWORD = "demo-adscreenpro-2024-secure";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if demo user exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const demoUser = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      // Create demo user
      const { error: createErr } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: "advertiser",
          customer_name: "Demo User",
          business_name: "Demo Business",
          category: "Tecnología",
          phone: "555-0000",
        },
      });
      if (createErr) throw createErr;

      // Wait for trigger to create profile
      await new Promise((r) => setTimeout(r, 1000));

      // Create advertiser record
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", DEMO_EMAIL)
        .single();

      if (profile) {
        await adminClient.from("advertisers").upsert({
          id: profile.id,
          customer_name: "Demo User",
          business_name: "Demo Business",
          category: "Tecnología",
          phone: "555-0000",
          is_active: true,
          activated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }
    }

    // Sign in with the anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signInErr) throw signInErr;

    return new Response(JSON.stringify({
      access_token: session.session?.access_token,
      refresh_token: session.session?.refresh_token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Demo login error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
