import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maps product category to the required profile photo category
const CATEGORY_TO_PHOTO: Record<string, string> = {
  ring: "fingers",
  bracelet: "hands",
  necklace: "upper_body",
  earring: "ears",
  nails: "nails",
  glasses: "face",
  hat: "face",
  hair: "hair",
  top: "upper_body",
  dress: "full_body",
  bottom: "full_body",
  shoes: "full_body",
  bag: "upper_body",
  living_room: "living_room",
  bedroom: "bedroom",
  kitchen: "kitchen",
  bathroom: "bathroom",
  office: "office",
  pet: "dog",
  car_interior: "car_interior",
  garden: "garden",
};

// Human-readable labels for missing photo errors
const PHOTO_LABELS: Record<string, string> = {
  fingers: "fingers",
  hands: "hands",
  upper_body: "upper body",
  ears: "ears",
  nails: "nails",
  face: "face",
  hair: "hair",
  full_body: "full body",
  living_room: "living room",
  bedroom: "bedroom",
  kitchen: "kitchen",
  bathroom: "bathroom",
  office: "office",
  dog: "pet",
  car_interior: "car interior",
  garden: "garden/patio",
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

    // Try to get user from JWT
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ") && authHeader.length > 10) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        userId = user.id;
      }
    }

    const body = await req.json();
    const { pageUrl, imageUrl, title, price, retailerDomain, category } = body;

    if (!pageUrl || !imageUrl) {
      return new Response(JSON.stringify({ error: "pageUrl and imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine required photo category
    const requiredPhotoCategory = category ? (CATEGORY_TO_PHOTO[category] || "full_body") : "full_body";

    let resultImageUrl: string | null = null;
    let userPhotoUrl: string | null = null;

    // If authenticated, fetch the correct profile photo
    if (userId) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: photoData } = await serviceClient
        .from("profile_photos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("category", requiredPhotoCategory)
        .limit(1)
        .maybeSingle();

      if (photoData?.storage_path) {
        const { data: signedData } = await serviceClient.storage
          .from("profile-photos")
          .createSignedUrl(photoData.storage_path, 300);
        const signedUrl = signedData?.signedUrl;
        if (signedUrl) {
          // Fetch image and convert to base64 data URL (AI gateway needs MIME type)
          const imgRes = await fetch(signedUrl);
          if (imgRes.ok) {
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            let binary = "";
            for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
            const b64 = btoa(binary);
            userPhotoUrl = `data:${contentType};base64,${b64}`;
          }
        }
      }

      // If no matching photo, return a clear error
      if (!userPhotoUrl) {
        const label = PHOTO_LABELS[requiredPhotoCategory] || requiredPhotoCategory;
        return new Response(JSON.stringify({
          error: `Please upload a photo of your ${label} in your VTO profile to try on this product.`,
          missingPhoto: label,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({
        error: "Please sign in to use virtual try-on.",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- AI Virtual Try-On ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured. Please contact support." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptText = `Generate a realistic virtual try-on image. ${title ? `The product is: ${title}.` : ""} Show the person wearing/using this product in a natural, photorealistic way. The result should look like a real photo, not a collage.`;

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          modalities: ["image", "text"],
          messages: [{
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: userPhotoUrl } },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        // Primary: images array in message
        const images = aiData.choices?.[0]?.message?.images;
        if (images?.[0]?.image_url?.url) {
          resultImageUrl = images[0].image_url.url;
        }
        if (!resultImageUrl) {
          console.error("AI returned no image. Response structure:", JSON.stringify(Object.keys(aiData.choices?.[0]?.message || {})));
        }
      } else {
        const errorText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errorText);
      }
    } catch (aiErr) {
      console.error("AI try-on generation failed:", aiErr);
    }

    if (!resultImageUrl) {
      return new Response(JSON.stringify({ error: "AI could not generate a try-on image. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to DB
    let tryOnId = crypto.randomUUID();
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

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    tryOnId = data.id;

    return new Response(JSON.stringify({
      tryOnId,
      status: "completed",
      resultImageUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
