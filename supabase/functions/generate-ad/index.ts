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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiyiKey = Deno.env.get("APIYI_API_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

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

    const { imageBase64, mimeType, prompt, category, template, lang } = await req.json();

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

    const templateStyles: Record<string, string> = {
      impacto: "Style: Dark dramatic background, bold vivid contrasting colors (neon or bright on dark), large impactful typography, intense lighting effects, high energy.",
      premium: "Style: Clean minimalist design, lots of white space, elegant sophisticated typography, muted premium color palette, luxury aesthetic. IMPORTANT: Do NOT add white panels, boxes, or overlays on top of the image. Integrate text directly into the composition.",
      oferta: "Style: Bright festive colors, include a promotional badge or starburst element, eye-catching discount callout, energetic and attention-grabbing.",
      moderno: "Style: Contemporary gradient backgrounds, modern sans-serif typography, sleek professional look, trendy color combinations.",
    };

    const templateStyle = templateStyles[template] ?? templateStyles.impacto;

    // Step 1: GPT-4o analyzes the image and writes a precise diffusion prompt
    const systemPrompt = `Act as an elite Prompt Engineer for image diffusion models (Nano Banana 2). Your output must be ONE SINGLE CONTINUOUS TEXT STRING.

Prompt Construction Protocol:

1. Central Subject: Describe the object or person in the photo with surgical precision (e.g. 'A glass bottle of professional shampoo' or 'A barber meticulously fading hair').

2. Studio Lighting: Always add 'Rim lighting, softbox overhead, 4k cinematic highlights'.

3. Environment: Describe a premium blurred (bokeh) background related to the business category in Raleigh, NC.

4. Visual Style: Apply the style provided by the user. Interpret it as lighting, color palette, and composition direction.

5. Text Integration: If the user provides ad text, describe it as 'Sharp, bold 3D typography integrated into the scene layout displaying: [text]'. If no text is provided, skip this step.

6. Technical Quality: End strictly with: 'photorealistic, 16:9, shot on 35mm, f/2.8, high-end commercial grade, 8k'.

PROHIBITIONS:
- Do NOT give options (Version A, B, C)
- Do NOT use bullet points or line breaks
- Do NOT include introductions like 'Here is your prompt'
- Do NOT invent registered trademarks or brand names
- Do NOT add text that was not explicitly provided by the user

REQUIRED OUTPUT: Only the prompt text in English.`;

    const userMessage = [
      `Business Context: This is a local ${category || "business"} in Raleigh, NC.`,
      `Visual Directive: The style must be ${templateStyle}.`,
      prompt ? `Ad Copy: "${prompt}"` : "No ad copy.",
      `Instruction: Analyze the provided image. Identify the central product or person and reimagine it using the specified style, maintaining the original composition but elevating it to a high-end TV commercial look.`,
    ].join("\n\n");

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
    console.log("GPT-4o prompt:", generatedPrompt.slice(0, 200));

    // Step 2: nano-banana transforms the image using Claude's prompt
    const userPrompt = `Completely reimagine this photo as a high-budget professional TV commercial. DO NOT add text or graphics on top of the original photo — fully transform the scene.

${generatedPrompt}

CRITICAL: Create a completely new commercial image. Do NOT overlay graphics or stickers on the original photo. Do NOT invent logos or brand names. Only show text that is explicitly in the prompt above. 16:9 horizontal format.`;

    const apiResponse = await fetch("https://api.apiyi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiyiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("APIYI error:", apiResponse.status, errText);
      throw new Error(`APIYI error ${apiResponse.status}: ${errText}`);
    }

    const data = await apiResponse.json();

    let imageData: string | null = null;
    let imageMime = "image/png";

    const content = data.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const url: string = part.image_url.url;
          if (url.startsWith("data:")) {
            const matches = url.match(/^data:([^;]+);base64,(.+)$/s);
            if (matches) {
              imageMime = matches[1];
              imageData = matches[2];
            }
          } else {
            const imgRes = await fetch(url);
            const imgBuf = await imgRes.arrayBuffer();
            imageMime = imgRes.headers.get("content-type") || "image/png";
            imageData = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
          }
          break;
        }
      }
    } else if (typeof content === "string") {
      const matches = content.match(/data:([^;]+);base64,([A-Za-z0-9+/=\n]+)/);
      if (matches) {
        imageMime = matches[1];
        imageData = matches[2].replace(/\n/g, "");
      }
    }

    if (!imageData) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 1000));
      throw new Error("AI did not return an image. Try a different prompt.");
    }

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
