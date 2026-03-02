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
    let aiRefusal: string | null = null;

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

    // --- Convert product image to base64 ---
    let productImageDataUrl = imageUrl;
    try {
      const productRes = await fetch(imageUrl);
      if (productRes.ok) {
        const productContentType = productRes.headers.get("content-type") || "image/jpeg";
        const productBuf = new Uint8Array(await productRes.arrayBuffer());
        let productBinary = "";
        for (let i = 0; i < productBuf.length; i++) productBinary += String.fromCharCode(productBuf[i]);
        productImageDataUrl = `data:${productContentType};base64,${btoa(productBinary)}`;
      } else {
        console.warn("Could not fetch product image, using raw URL. Status:", productRes.status);
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch product image for base64 conversion:", fetchErr);
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

    const promptText = `You are a fashion and lifestyle visualization assistant. I'm providing two images: a reference photo showing a person (or space), and a product photo. Create a new composite image that realistically shows how this product would look when styled on someone with a similar appearance (or placed in a similar space). ${title ? `The product is: ${title}.` : ""} Focus on realistic lighting, proportions, and natural integration. The output should look like a professional product photo.`;

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
              { type: "image_url", image_url: { url: productImageDataUrl } },
            ],
          }],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const message = aiData.choices?.[0]?.message;
        aiRefusal = message?.refusal || null;

        // Check 1: images array
        if (message?.images?.[0]?.image_url?.url) {
          resultImageUrl = message.images[0].image_url.url;
        }

        // Check 2: content as array with image_url parts
        if (!resultImageUrl && Array.isArray(message?.content)) {
          for (const part of message.content) {
            if (part.type === "image_url" && part.image_url?.url) {
              resultImageUrl = part.image_url.url;
              break;
            }
          }
        }

        // Check 3: content as string containing base64 data URI
        if (!resultImageUrl && typeof message?.content === "string") {
          const dataUriMatch = message.content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
          if (dataUriMatch) {
            resultImageUrl = dataUriMatch[0];
          }
        }

        if (!resultImageUrl) {
          const contentPreview = typeof message?.content === "string"
            ? message.content.substring(0, 500)
            : JSON.stringify(message?.content)?.substring(0, 500);
          console.error("AI returned no image. Keys:", JSON.stringify(Object.keys(message || {})),
            "Content preview:", contentPreview,
            "Refusal:", JSON.stringify(message?.refusal),
            "Reasoning:", JSON.stringify(message?.reasoning)?.substring(0, 500));
        }
      } else {
        const errorText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errorText);
      }
    } catch (aiErr) {
      console.error("AI try-on generation failed:", aiErr);
    }

    if (!resultImageUrl) {
      const errorMsg = typeof aiRefusal === "string" && aiRefusal
        ? `The AI declined: ${aiRefusal}`
        : "AI could not generate a try-on image. Please try again.";
      return new Response(JSON.stringify({ error: errorMsg }), {
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
