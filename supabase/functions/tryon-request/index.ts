import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Try to get user from JWT if provided, but don't require it
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        userId = data.claims.sub as string;
      }
    }

    const body = await req.json();
    const { pageUrl, imageUrl, title, price, retailerDomain } = body;

    if (!pageUrl || !imageUrl) {
      return new Response(JSON.stringify({ error: "pageUrl and imageUrl required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- AI Virtual Try-On via Lovable AI ---
    // We use Gemini's image generation model to create a try-on composite.
    // The user's profile photo (if available) + product image are described to the model.
    let resultImageUrl: string | null = null;
    let userPhotoUrl: string | null = null;

    // If authenticated, try to get the user's full_body profile photo
    if (userId) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: photoData } = await serviceClient
        .from("profile_photos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("category", "full_body")
        .limit(1)
        .maybeSingle();

      if (photoData?.storage_path) {
        const { data: signedData } = await serviceClient.storage
          .from("profile-photos")
          .createSignedUrl(photoData.storage_path, 300);
        userPhotoUrl = signedData?.signedUrl ?? null;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      // Fallback to placeholder
      resultImageUrl = `https://placehold.co/400x600/7c3aed/white?text=AI+Not+Configured`;
    } else {
      // Build the prompt for AI image generation
      const personDescription = userPhotoUrl
        ? `Here is the person's photo: ${userPhotoUrl}. `
        : "Use a generic fashion model as the person. ";

      const prompt = `Generate a realistic virtual try-on image. ${personDescription}The product to try on is shown here: ${imageUrl}. ${title ? `The product is: ${title}.` : ""} Show the person wearing/using this product in a natural, photorealistic way. The result should look like a real photo, not a collage.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          // Check for inline image data in the response
          const choice = aiData.choices?.[0];
          if (choice?.message?.content) {
            // The image model may return base64 inline_data or a URL
            const content = choice.message.content;
            if (Array.isArray(content)) {
              // Multimodal response: look for image parts
              const imagePart = content.find((p: any) => p.type === "image_url" || p.inline_data);
              if (imagePart?.image_url?.url) {
                resultImageUrl = imagePart.image_url.url;
              } else if (imagePart?.inline_data) {
                resultImageUrl = `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;
              }
            } else if (typeof content === "string" && content.startsWith("data:")) {
              resultImageUrl = content;
            }
          }
          // Also check for inline_data format from Gemini
          const parts = aiData.choices?.[0]?.message?.parts;
          if (!resultImageUrl && Array.isArray(parts)) {
            const imgPart = parts.find((p: any) => p.inline_data);
            if (imgPart?.inline_data) {
              resultImageUrl = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
            }
          }
        } else {
          const errorText = await aiResponse.text();
          console.error("AI gateway error:", aiResponse.status, errorText);
        }
      } catch (aiErr) {
        console.error("AI try-on generation failed:", aiErr);
      }
    }

    // Fallback if AI didn't produce an image
    if (!resultImageUrl) {
      resultImageUrl = `https://placehold.co/400x600/7c3aed/white?text=Try-On+Preview`;
    }

    // Only save to DB if we have a user
    let tryOnId = crypto.randomUUID();
    if (userId) {
      const { data, error } = await supabase.from("tryon_requests").insert({
        user_id: userId,
        page_url: pageUrl,
        image_url: imageUrl,
        title: title || null,
        price: price || null,
        retailer_domain: retailerDomain || null,
        status: "completed",
        result_image_url: resultImageUrl,
      }).select().single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      tryOnId = data.id;
    }

    return new Response(JSON.stringify({
      tryOnId,
      status: "completed",
      resultImageUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
