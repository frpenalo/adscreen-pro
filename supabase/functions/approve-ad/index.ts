import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const yodeckApiKey = Deno.env.get("YODECK_API_KEY");

    // --- Auth check: require valid JWT and admin role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ad_id, action, reason } = await req.json();

    if (!ad_id || !action) {
      return new Response(JSON.stringify({ error: "Missing ad_id or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ad details
    const { data: ad, error: adErr } = await supabase
      .from("ads")
      .select("*")
      .eq("id", ad_id)
      .single();
    if (adErr || !ad) {
      return new Response(JSON.stringify({ error: "Ad not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      await supabase
        .from("ads")
        .update({ status: "rejected", rejected_reason: reason || null })
        .eq("id", ad_id);

      await supabase.from("advertiser_notifications").insert({
        advertiser_id: ad.advertiser_id,
        message: `Tu anuncio fue rechazado.${reason ? ` Motivo: ${reason}` : ""}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APPROVE FLOW
    // Step 1: Simulate normalization (2s)
    await new Promise((r) => setTimeout(r, 2000));

    let yodeckAssetId: string | null = null;
    let yodeckPlaylistItemId: string | null = null;
    let yodeckDebug: any = null;

    // Step 2: Get playlist ID from settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("yodeck_playlist_id")
      .eq("id", "singleton")
      .maybeSingle();

    const playlistId = settings?.yodeck_playlist_id;

    // Step 3: YoDeck integration (if API key and playlist configured)
    if (yodeckApiKey && playlistId && ad.final_media_path) {
      console.log("YoDeck integration active. Playlist:", playlistId, "Media:", ad.final_media_path);
      
      // YoDeck API v2 uses "Token label:value" format
      // The stored key should already be in "label:value" format
      const authHeader = yodeckApiKey.includes(":") 
        ? `Token ${yodeckApiKey}` 
        : `Token api:${yodeckApiKey}`;
      
      try {
        // Step 3a: Create media in YoDeck via URL import
        const mediaType = ad.type === "video" ? "video" : "image";
        console.log("Creating media in YoDeck via URL import...");
        
        const createMediaRes = await fetch("https://app.yodeck.com/api/v2/media", {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `AdScreenPro-${ad_id}`,
            media_origin: {
              type: mediaType,
              source: "url",
            },
            arguments: {
              download_from_url: ad.final_media_path,
            },
            default_duration: 10,
          }),
        });

        const createBody = await createMediaRes.text();
        console.log("YoDeck create media response:", createMediaRes.status, createBody);

        if (createMediaRes.ok || createMediaRes.status === 201) {
          const mediaData = JSON.parse(createBody);
          yodeckAssetId = mediaData.id?.toString() ?? null;
          console.log("YoDeck media ID:", yodeckAssetId);

          // Step 3b: Get current playlist to read existing items
          console.log("=== YODECK PLAYLIST DEBUG ===");
          console.log("Playlist ID:", playlistId);
          console.log("Asset ID:", yodeckAssetId);

          const getPlaylistUrl = `https://app.yodeck.com/api/v2/playlists/${playlistId}`;
          console.log("Fetching current playlist:", getPlaylistUrl);

          const getPlaylistRes = await fetch(getPlaylistUrl, {
            headers: { Authorization: authHeader },
          });
          const getPlaylistBody = await getPlaylistRes.text();
          console.log("GET playlist status:", getPlaylistRes.status);
          console.log("GET playlist body:", getPlaylistBody);

          if (!getPlaylistRes.ok) {
            console.error("FAILED to fetch playlist:", getPlaylistRes.status, getPlaylistBody);
            yodeckDebug = {
              step: "GET playlist",
              playlist_id: playlistId,
              asset_id: yodeckAssetId,
              response_status: getPlaylistRes.status,
              response_body: getPlaylistBody,
            };
          } else {
            const playlistData = JSON.parse(getPlaylistBody);
            const existingItems = playlistData.items || [];
            console.log("Existing playlist items:", existingItems.length);

            // Add new media item
            // Calculate max priority to ensure new item goes at the end
            const maxPriority = existingItems.reduce(
              (max: number, item: any) => Math.max(max, item.priority || 0), 0
            );
            const newItem = {
              id: parseInt(yodeckAssetId!),
              type: "media",
              duration: mediaType === "video" ? 30 : 10,
              priority: maxPriority + 1,
            };
            const updatedItems = [...existingItems, newItem];
            console.log("Max existing priority:", maxPriority, "New item priority:", maxPriority + 1);

            // Step 3c: PATCH playlist with updated items
            const patchUrl = `https://app.yodeck.com/api/v2/playlists/${playlistId}`;
            const patchBody = { items: updatedItems };
            console.log("PATCH URL:", patchUrl);
            console.log("PATCH body:", JSON.stringify(patchBody, null, 2));

            const patchRes = await fetch(patchUrl, {
              method: "PATCH",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(patchBody),
            });

            const patchResBody = await patchRes.text();
            console.log("=== YODECK PLAYLIST PATCH RESPONSE ===");
            console.log("Status code:", patchRes.status);
            console.log("Response body:", patchResBody);

            yodeckDebug = {
              playlist_id: playlistId,
              asset_id: yodeckAssetId,
              existing_items: existingItems.length,
              patch_url: patchUrl,
              patch_body: patchBody,
              response_status: patchRes.status,
              response_body: patchResBody,
            };

            if (patchRes.ok) {
              yodeckPlaylistItemId = yodeckAssetId;
              console.log("Successfully added to playlist! Item ID:", yodeckPlaylistItemId);
            } else {
              console.error("FAILED to patch playlist:", patchRes.status, patchResBody);
            }
          }
        }
      } catch (yodeckErr) {
        console.error("YoDeck error:", yodeckErr);
        // Continue with approval even if YoDeck fails
      }
    } else {
      console.log("YoDeck skipped. apiKey:", !!yodeckApiKey, "playlistId:", playlistId, "mediaPath:", ad.final_media_path);
    }

    // Step 6: Update ad status
    await supabase
      .from("ads")
      .update({
        status: "published",
        yodeck_asset_id: yodeckAssetId,
        yodeck_playlist_item_id: yodeckPlaylistItemId,
      })
      .eq("id", ad_id);

    // Step 7: Notify advertiser
    await supabase.from("advertiser_notifications").insert({
      advertiser_id: ad.advertiser_id,
      message: "Tu anuncio fue aprobado y ya está publicándose en pantallas. 🎉",
    });

    return new Response(JSON.stringify({ success: true, yodeck_asset_id: yodeckAssetId, yodeck_debug: yodeckDebug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
