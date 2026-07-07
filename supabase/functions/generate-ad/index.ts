import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// (The legacy arrayBufferToBase64 helper was removed when we migrated
// off APIYI/nano-banana-2. The new flow gets b64_json directly from
// OpenAI's response so chunked manual base64-encoding is no longer
// needed.)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    // APIYI_API_KEY was removed when we migrated Step 2 from
    // apiyi.com / nano-banana-2 to OpenAI's /v1/images/edits endpoint
    // with model gpt-image-2. The env var can be deleted from Supabase
    // secrets (it's no longer read).

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: authErr?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // adText was previously accepted in the body but never used —  the
    // image-enhancement step intentionally has NO knowledge of the ad
    // copy (the AI must produce a clean photo with no text overlays;
    // text is composed downstream by Remotion).
    const { imageBase64, mimeType, category } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Category-specific context
    const categoryContext: Record<string, string> = {
      restaurante: "This is for a restaurant or food business. Emphasize appetite appeal, warm inviting colors, and food imagery.",
      comida: "This is for a food business. Make the food look delicious and appetizing.",
      barberia: "This is for a barbershop. Use masculine, clean aesthetics with grooming-related visual cues.",
      farmacia: "This is for a pharmacy or health business. Use clean, trustworthy, professional health aesthetics.",
      gym: "This is for a fitness or gym business. Use energetic, motivational visuals with strong bold typography.",
      salon: "This is for a beauty salon. Use elegant, feminine aesthetics with soft sophisticated colors.",
      tienda: "This is for a retail store. Highlight products clearly with commercial appeal.",
      balloon: "This is for a balloon artist or balloon decoration business. Use festive, playful, colorful aesthetics with vibrant party colors (pinks, golds, purples, bright blues). Convey celebration, joy, and creativity. Ideal for birthdays, weddings, and events.",
      default: "This is for a local business.",
    };

    const categoryKey = (category || "").toLowerCase();
    const categoryHint = Object.entries(categoryContext).find(([key]) =>
      categoryKey.includes(key)
    )?.[1] ?? categoryContext.default;

    // Category drives both the visual style AND the background context
    const categoryStyles: Record<string, string> = {
      barberia:         "Style: Dark masculine atmosphere, dramatic rim lighting, black and gold tones, sharp contrast, premium barbershop aesthetic, cinematic and powerful.",
      barbershop:       "Style: Dark masculine atmosphere, dramatic rim lighting, black and gold tones, sharp contrast, premium barbershop aesthetic, cinematic and powerful.",
      restaurante:      "Style: Warm inviting colors, soft golden hour lighting, rich earthy tones, appetizing and welcoming, makes the viewer want to visit.",
      restaurant:       "Style: Warm inviting colors, soft golden hour lighting, rich earthy tones, appetizing and welcoming, makes the viewer want to visit.",
      comida:           "Style: Vibrant food photography lighting, warm saturated colors, close-up appetite appeal, fresh and delicious atmosphere.",
      belleza:          "Style: Soft elegant aesthetic, pastel or rose gold tones, clean luxury feel, feminine and sophisticated, high-end beauty brand look.",
      salon:            "Style: Soft elegant aesthetic, pastel or rose gold tones, clean luxury feel, feminine and sophisticated, high-end beauty brand look.",
      nail:             "Style: Glamorous close-up lighting, vibrant saturated nail colors, luxury beauty aesthetic, polished and premium.",
      automotriz:       "Style: Bold industrial aesthetic, strong contrast, metallic tones, professional and trustworthy, high-performance energy.",
      automotive:       "Style: Bold industrial aesthetic, strong contrast, metallic tones, professional and trustworthy, high-performance energy.",
      gym:              "Style: High energy, dramatic motivational lighting, bold vivid contrasting colors, powerful and intense, fitness brand aesthetic.",
      fitness:          "Style: High energy, dramatic motivational lighting, bold vivid contrasting colors, powerful and intense, fitness brand aesthetic.",
      salud:            "Style: Clean trustworthy aesthetic, fresh cool tones (blues and whites), calm and professional, healthcare brand look.",
      health:           "Style: Clean trustworthy aesthetic, fresh cool tones (blues and whites), calm and professional, healthcare brand look.",
      farmacia:         "Style: Clean trustworthy aesthetic, fresh cool tones (blues and whites), calm and professional, pharmacy brand look.",
      educacion:        "Style: Inspiring professional look, clean organized composition, motivational colors (blues and greens), academic and trustworthy.",
      education:        "Style: Inspiring professional look, clean organized composition, motivational colors (blues and greens), academic and trustworthy.",
      retail:           "Style: Vibrant commercial look, bright and eye-catching colors, product-forward composition, promotional energy.",
      tienda:           "Style: Vibrant commercial look, bright and eye-catching colors, product-forward composition, promotional energy.",
      balloon:          "Style: Festive and joyful, vibrant party colors (pinks, golds, purples, bright blues), playful and celebratory, event decoration aesthetic.",
      entretenimiento:  "Style: Energetic and exciting, vivid saturated colors, dynamic lighting, entertainment brand feel.",
      default:          "Style: Dark dramatic background, bold vivid contrasting colors, large impactful typography, intense lighting, high-end TV commercial look.",
    };

    const catKey = (category || "").toLowerCase().trim();
    const categoryStyle = Object.entries(categoryStyles).find(([key]) =>
      catKey.includes(key)
    )?.[1] ?? categoryStyles.default;


    // Step 1: GPT-4o analyzes the image and writes a precise prompt for the
    // downstream image-generation model (gpt-image-2 today; was nano-banana-2
    // via APIYI before). The prompt structure is model-agnostic — same
    // subject / lighting / environment / style / technical-quality
    // template works across diffusion- and transformer-based image models.
    const systemPrompt = `Act as an elite Prompt Engineer for a high-end commercial image generation model. Your output must be ONE SINGLE CONTINUOUS TEXT STRING.

Prompt Construction Protocol:

1. Central Subject: Describe the object or person in the photo with surgical precision (e.g. 'A glass bottle of professional shampoo' or 'A barber meticulously fading hair').

2. Studio Lighting: Always add 'Rim lighting, softbox overhead, 4k cinematic highlights'.

3. Environment: Describe a premium blurred (bokeh) background related to the business category in Raleigh, NC.

4. Visual Style: Apply the category style provided. Interpret it as lighting, color palette, and composition direction.

5. Technical Quality: End strictly with: 'photorealistic, 16:9, shot on 35mm, f/2.8, high-end commercial grade, 8k'.

PROHIBITIONS:
- Do NOT give options (Version A, B, C)
- Do NOT use bullet points or line breaks
- Do NOT include introductions like 'Here is your prompt'
- Do NOT invent registered trademarks or brand names
- Do NOT add any text overlays or typography to the image

REQUIRED OUTPUT: Only the prompt text in English.`;

    const userMessage = [
      `Business Category: ${category || "local business"} in Raleigh, NC.`,
      `Visual Directive: ${categoryStyle}`,
      `Instruction: Analyze the provided image. Identify the central subject and reimagine it using the specified style, maintaining the original composition but elevating it to a high-end TV commercial look.`,
    ].join("\n\n");

    const step1StartedAt = Date.now();
    console.log(`[generate-ad] Step 1: posting to GPT-4o. Image base64 length: ${imageBase64.length}, mimeType: ${mimeType}, category: ${category}`);
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" },
              },
              { type: "text", text: userMessage },
            ],
          },
        ],
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error("OpenAI error:", gptResponse.status, errText);
      throw new Error(`OpenAI error ${gptResponse.status}: ${errText}`);
    }

    const gptData = await gptResponse.json();
    const generatedPrompt = gptData.choices?.[0]?.message?.content?.trim() ?? "";
    const step1Ms = Date.now() - step1StartedAt;
    console.log(`[generate-ad] Step 1 (GPT-4o) done in ${step1Ms}ms. Prompt: ${generatedPrompt.slice(0, 200)}`);

    // ── Step 2: gpt-image-2 transforms the image ─────────────────────────────
    // OpenAI's /v1/images/edits endpoint takes the original photo as a
    // multipart upload + a text prompt describing the transformation.
    // Returns one (or more) generated images as base64. We request
    // 1536x1024 (landscape) at quality "medium": the Remotion video is
    // 1920x1080 with objectFit:cover, so a 1024x1024 square source lost
    // ~44% to cropping AND got upscaled 1.9x from a low-quality render —
    // visibly soft on a 50" TV. Landscape+medium keeps the crop minimal
    // and the upscale small. The 90s AbortController below still guards
    // the edge function wall-clock if the slower quality tier drags.
    const userPrompt = `Completely reimagine this photo as a high-budget professional TV commercial. DO NOT add text or graphics on top of the original photo — fully transform the scene.

${generatedPrompt}

CRITICAL: Create a completely new commercial image. Do NOT overlay graphics or stickers on the original photo. Do NOT invent logos or brand names. Do NOT render any words, letters, or signage. Pure visual.`;

    // Build the multipart form payload. Decode the base64 image into bytes
    // and wrap it as a Blob so FormData adds the right content-type and
    // boundary headers automatically.
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: mimeType || "image/jpeg" });
    console.log(`[generate-ad] Step 2: posting to gpt-image-2. Image bytes: ${imageBytes.length}`);

    const formData = new FormData();
    // Using gpt-image-2 (latest). The OpenAI organization is now
    // verified, so the KYC gating that previously forced us back to
    // gpt-image-1 no longer applies. v2 has higher fidelity and
    // better prompt adherence; the slightly higher per-call cost is
    // worth the quality jump for partner-facing ads.
    formData.append("model", "gpt-image-2");
    formData.append("image", imageBlob, "input.jpg");
    formData.append("prompt", userPrompt);
    formData.append("size", "1536x1024");
    formData.append("quality", "medium");
    formData.append("n", "1");

    const step2StartedAt = Date.now();
    // Hard timeout via AbortController so we never let the request hang
    // forever — if gpt-image-2 takes more than 90s, abort and surface
    // a clear error to the client instead of letting the edge function
    // run out of wall clock.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    let apiResponse: Response;
    try {
      apiResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          // Content-Type is intentionally omitted so the runtime sets
          // multipart/form-data with the correct boundary.
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if ((e as Error).name === "AbortError") {
        console.error("[generate-ad] gpt-image-2 timed out after 90s");
        throw new Error("gpt-image-2 timed out after 90s. Try a smaller / simpler photo.");
      }
      throw e;
    }
    clearTimeout(timeoutId);

    const step2Ms = Date.now() - step2StartedAt;
    console.log(`[generate-ad] Step 2 (gpt-image-2) responded in ${step2Ms}ms with status ${apiResponse.status}`);

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("[generate-ad] OpenAI image edit error:", apiResponse.status, errText);
      throw new Error(`OpenAI image edit error ${apiResponse.status}: ${errText}`);
    }

    const data = await apiResponse.json();
    // gpt-image-2 returns { data: [{ b64_json: "..." }] } by default.
    // Output format defaults to PNG.
    const imageData: string | null = data.data?.[0]?.b64_json ?? null;
    const imageMime = "image/png";

    if (!imageData) {
      console.error("[generate-ad] No image in OpenAI response:", JSON.stringify(data).slice(0, 1000));
      throw new Error("OpenAI did not return an image. Try a different prompt.");
    }
    console.log(`[generate-ad] Step 2 image received, b64 length: ${imageData.length}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ext = imageMime.split("/")[1]?.split("+")[0] || "png";
    const path = `${user.id}/ai-generated/${Date.now()}.${ext}`;
    const imageBuffer = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));

    const { error: uploadErr } = await supabase.storage
      .from("ad-media")
      .upload(path, imageBuffer, { contentType: imageMime });

    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage.from("ad-media").getPublicUrl(path);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-ad error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error generating image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
