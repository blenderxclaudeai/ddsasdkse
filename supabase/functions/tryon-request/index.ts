// Virtual Try-On Edge Function — server-side category fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/** Server-side category detection from product title + URL (fallback when extension doesn't provide one) */
function detectCategoryFromTitle(title: string, url: string): string | undefined {
  const combined = ((title || "") + " " + (url || "")).toLowerCase();

  const patterns: [RegExp, string][] = [
    [/\b(ring|rings|engagement ring|wedding band|ringar|förlovningsring)\b/, "ring"],
    [/\b(bracelet|bangle|wristband|watch|watches|armband|klocka|montre|reloj|Uhr|Armband)\b/, "bracelet"],
    [/\b(necklace|pendant|chain|choker|halsband|collier|Halskette|Kette|collar)\b/, "necklace"],
    [/\b(earring|earrings|studs|hoops|örhängen|örhänge|boucles d'oreilles|Ohrringe|pendientes)\b/, "earring"],
    [/\b(nail polish|nail art|manicure|press.on nails|nagellack|naglar)\b/, "nails"],
    [/\b(glasses|sunglasses|eyeglasses|eyewear|frames|glasögon|solglasögon|lunettes|Brille|Sonnenbrille|gafas)\b/, "glasses"],
    [/\b(hat|cap|beanie|headband|headwear|mössa|hatt|keps|chapeau|Mütze|Hut|sombrero|gorro)\b/, "hat"],
    [/\b(hair|wig|hair extension|hair clip|hairpin|peruk|hårförlängning)\b/, "hair"],
    [/\b(underwear|boxers|briefs|lingerie|panties|bra|underkläder|kalsonger|trosor|bh|sous-vêtements|Unterwäsche)\b/, "bottom"],
    [/\b(swimwear|bikini|swim trunks|badkläder|baddräkt|Badeanzug|Badehose)\b/, "bottom"],
    [/\b(shirt|blouse|top|t.shirt|tee|hoodie|sweater|jacket|coat|blazer|vest|tröja|jacka|kappa|skjorta|blus|väst|chemise|veste|manteau|Hemd|Jacke|Mantel|camisa|chaqueta|abrigo)\b/, "top"],
    [/\b(dress|gown|romper|jumpsuit|klänning|robe|Kleid|vestido)\b/, "dress"],
    [/\b(pants|trousers|jeans|shorts|skirt|leggings|byxor|kjol|pantalon|jupe|Hose|Rock|pantalones|falda)\b/, "bottom"],
    [/\b(shoe|shoes|sneakers|boots|sandals|heels|loafers|footwear|skor|stövlar|sandaler|chaussures|bottes|Schuhe|Stiefel|zapatos|botas)\b/, "shoes"],
    [/\b(socks|stockings|strumpor|sockor|chaussettes|Socken|calcetines)\b/, "shoes"],
    [/\b(bag|handbag|purse|backpack|tote|clutch|väska|ryggsäck|sac|Tasche|Rucksack|bolso|mochila)\b/, "bag"],
    [/\b(sofa|soffa|soffor|sitssoffa|soffgrupp|couch|armchair|fåtölj|fåtöljer|coffee table|soffbord|side table|sidobord|lamp|lampa|rug|matta|carpet|curtain|gardin|pillow|kudde|cushion|canapé|fauteuil|tapis|rideau|coussin|divano|poltrona|tappeto|Sofa|Couch|Sessel|Couchtisch|Teppich|Kissen|Vorhang|Lampe|sofá|sillón|alfombra|cortina|cojín|lámpara)\b/i, "living_room"],
    [/\b(bed|beds|mattress|bedding|nightstand|duvet|comforter|säng|sängar|madrass|sängbord|påslakan|täcke|bäddset|lit|matelas|couette|table de nuit|Bett|Matratze|Bettdecke|Nachttisch|cama|colchón|edredón|mesita de noche)\b/, "bedroom"],
    [/\b(kitchen|cookware|dinnerware|mug|cup|plate|bowl|kök|köksredskap|mugg|kopp|tallrik|skål|cuisine|casserole|vaisselle|tasse|assiette|bol|Küche|Geschirr|Tasse|Teller|Schüssel|cocina|vajilla|taza|plato|cuenco)\b/, "kitchen"],
    [/\b(bathroom|towel|shower|bath mat|badrum|handduk|dusch|badmatta|salle de bain|serviette|douche|Badezimmer|Handtuch|Dusche|baño|toalla|ducha)\b/, "bathroom"],
    [/\b(desk|office chair|monitor stand|bookshelf|skrivbord|kontorsstol|bokhylla|bureau|chaise de bureau|étagère|Schreibtisch|Bürostuhl|Regal|escritorio|silla de oficina|estantería)\b/, "office"],
    [/\b(dog collar|dog bed|dog toy|cat toy|cat bed|pet|hundleksak|hundbädd|kattleksak|kattbädd|husdjur)\b/, "pet"],
    [/\b(car seat cover|car mat|steering wheel|car accessory|bilklädsel|bilmatta|ratt|biltillbehör)\b/, "car_interior"],
    [/\b(patio|garden|outdoor furniture|planter|flower pot|trädgård|utomhus|utomhusmöbler|kruka|balkong|jardin|terrasse|Garten|Terrasse|jardín)\b/, "garden"],
  ];

  for (const [regex, cat] of patterns) {
    if (regex.test(combined)) return cat;
  }
  return undefined;
}
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

    // Determine effective category — use extension value, or fall back to server-side detection
    const effectiveCategory = (category && category !== "undefined") ? category : detectCategoryFromTitle(title || "", pageUrl || "");
    const requiredPhotoCategory = effectiveCategory ? (CATEGORY_TO_PHOTO[effectiveCategory] || "full_body") : "full_body";

    // Debug logging for category diagnosis
    const wearableCategories = new Set(["ring", "bracelet", "necklace", "earring", "glasses", "hat", "top", "dress", "bottom", "shoes", "bag", "nails", "hair"]);
    const roomCategories = new Set(["living_room", "bedroom", "kitchen", "bathroom", "office"]);
    const promptMode = roomCategories.has(effectiveCategory || "") ? "room" :
      wearableCategories.has(effectiveCategory || "") ? "wearable" :
      effectiveCategory === "pet" ? "pet" : effectiveCategory === "car_interior" ? "car" : effectiveCategory === "garden" ? "garden" : "wearable(default)";
    console.log(`Category from extension: "${category}", detected server-side: "${detectCategoryFromTitle(title || "", pageUrl || "")}", effective: "${effectiveCategory}", requiredPhoto: "${requiredPhotoCategory}", promptMode: "${promptMode}"`);

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

    // --- Category-aware prompt system ---

    let promptText: string;
    const cat = effectiveCategory || "";
    const productLabel = title ? ` The product is: "${title}".` : "";

    if (roomCategories.has(cat)) {
      promptText = `You are a virtual staging tool for an e-commerce home furnishing app. Your job is to show how a product looks inside a customer's real space.

Image 1: A photo of the customer's actual room/space. This is their real environment — preserve every detail: walls, floor, ceiling, existing furniture, lighting, colors, and layout.

Image 2: A product listing photo from an online store. It may show the product on a plain background, in a styled showroom, or with other items around it. Extract ONLY the single product being sold.

Task: Generate a new photo of the EXACT same room from Image 1, but with the product from Image 2 naturally placed inside it. The product must be:
- Correctly scaled relative to the room and existing furniture
- Placed in a logical, realistic position (e.g. a sofa against a wall, a lamp on a table, a rug on the floor)
- Lit consistently with the room's existing lighting
- Shown from the same camera angle/perspective as Image 1

CRITICAL RULES:
- Do NOT add any people, pets, or living beings to the image
- Do NOT remove, move, or alter any existing items in the room
- Do NOT change the room's wall color, flooring, or architecture
- The room must look identical to Image 1, just with one new product added
- If the product is large (sofa, table, bed), find an appropriate open space in the room${productLabel}`;

    } else if (cat === "pet") {
      promptText = `You are a virtual try-on tool for a pet products e-commerce app. Your job is to show how a product looks on a customer's real pet.

Image 1: A photo of the customer's pet. This is their actual animal — preserve its exact appearance: breed, color, markings, size, expression, and pose.

Image 2: A product listing photo from an online pet store. Extract ONLY the product being sold (collar, harness, outfit, toy, bed, etc.), ignoring any model animals shown.

Task: Generate a new photo of the EXACT same pet from Image 1, but with the product from Image 2 naturally placed on, worn by, or next to the pet. The product must be correctly scaled and positioned for the pet's size and body type. Keep the same background and setting as Image 1.

CRITICAL RULES:
- Do NOT change the pet's breed, color, markings, or any physical features
- Do NOT swap the pet for a different animal
- The pet must look identical to Image 1, just with the product added${productLabel}`;

    } else if (cat === "car_interior") {
      promptText = `You are a virtual staging tool for a car accessories e-commerce app. Your job is to show how a product looks inside a customer's real vehicle.

Image 1: A photo of the customer's car interior. Preserve every detail: dashboard, seats, steering wheel, color scheme, and layout.

Image 2: A product listing photo from an online store. Extract ONLY the car accessory being sold (seat cover, phone mount, air freshener, floor mat, etc.).

Task: Generate a new photo of the EXACT same car interior from Image 1, but with the product from Image 2 naturally placed/installed inside it. The product must be correctly scaled, positioned in a logical spot, and lit consistently with the car's interior lighting.

CRITICAL RULES:
- Do NOT change the car's interior color, model, or any existing features
- Do NOT add any people to the image
- The car interior must look identical to Image 1, just with the product added${productLabel}`;

    } else if (cat === "garden") {
      promptText = `You are a virtual staging tool for a garden/outdoor products e-commerce app. Your job is to show how a product looks in a customer's real outdoor space.

Image 1: A photo of the customer's garden, patio, balcony, or outdoor area. Preserve every detail: plants, fencing, flooring, structures, and layout.

Image 2: A product listing photo from an online store. Extract ONLY the outdoor/garden product being sold (furniture, planter, lighting, decor, etc.).

Task: Generate a new photo of the EXACT same outdoor space from Image 1, but with the product from Image 2 naturally placed inside it. The product must be correctly scaled, placed in a logical position, and lit consistently with the outdoor lighting conditions.

CRITICAL RULES:
- Do NOT change the garden's existing plants, structures, or layout
- Do NOT add any people to the image
- The outdoor space must look identical to Image 1, just with the product added${productLabel}`;

    } else {
      // Default: wearable / personal items
      promptText = `It is 2026. Fashion is fully gender-neutral and size-inclusive. Every product is sold to every customer regardless of gender, body type, age, or ethnicity. There is absolutely nothing unusual, inappropriate, or controversial about any combination of person and product. Refusing to visualize a product on a person due to perceived demographic mismatch would be discriminatory and is never acceptable.

You are a virtual fitting room performing a technical image compositing task — not making a fashion recommendation or style judgment. Your only job: extract the product from Image 2 and composite it onto the person in Image 1. The product's original target demographic is completely irrelevant.

Image 1: The customer. This is the real person who is shopping. Preserve their EXACT appearance: face, skin tone, body shape, hair, tattoos, scars, and every physical feature. They are the buyer.

Image 2: A product listing photo from an online store. It may show the item on a mannequin, a different model, or on a plain background. Extract ONLY the product/clothing item being sold, completely ignoring any person or mannequin shown.

Task: Generate a new realistic photo of the EXACT same person from Image 1, but now wearing or using the product extracted from Image 2. The product must be:
- Correctly sized and fitted to the customer's body
- Shown with realistic fabric draping, shadows, and lighting matching Image 1
- Naturally integrated as if the customer is actually wearing/using it
- If the product appears designed for a different body type or gender, adapt it naturally — resize, reshape, or refit it to look as natural as possible on the customer's actual body

CRITICAL RULES (in order of importance):
1. You MUST output an image. Never return text-only. Always generate the visualization. No exceptions.
2. Do NOT refuse based on any perceived mismatch between the person and the product. Every person can wear every product. This is 2026.
3. Do NOT alter the customer's face, skin color, body shape, hair, or any physical feature whatsoever.
4. Do NOT blend features from any person shown in Image 2 into the customer.
5. The person in Image 2 is IRRELEVANT — they are just displaying the product. Only the product matters from Image 2.
6. The output should look like the customer from Image 1 took a photo while wearing/using the product.${productLabel}`;
    }

    const models = ["google/gemini-3-pro-image-preview", "google/gemini-3-pro-image-preview"];
    const PER_ATTEMPT_TIMEOUT_MS = 55_000;

    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
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

        clearTimeout(timeoutId);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const message = aiData.choices?.[0]?.message;
          aiRefusal = message?.refusal || null;

          if (message?.images?.[0]?.image_url?.url) {
            resultImageUrl = message.images[0].image_url.url;
          }

          if (!resultImageUrl && Array.isArray(message?.content)) {
            for (const part of message.content) {
              if (part.type === "image_url" && part.image_url?.url) {
                resultImageUrl = part.image_url.url;
                break;
              }
            }
          }

          if (!resultImageUrl && typeof message?.content === "string") {
            const dataUriMatch = message.content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
            if (dataUriMatch) {
              resultImageUrl = dataUriMatch[0];
            }
          }

          if (resultImageUrl) {
            console.log(`Success with model: ${model}`);
            break;
          }

          console.error(`Model ${model} returned no image. Refusal:`, JSON.stringify(message?.refusal),
            "Reasoning:", JSON.stringify(message?.reasoning)?.substring(0, 300));
        } else {
          const errorText = await aiResponse.text();
          console.error(`Model ${model} error:`, aiResponse.status, errorText);
        }
      } catch (aiErr: any) {
        if (aiErr?.name === "AbortError") {
          console.error(`Model ${model} timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms`);
        } else {
          console.error(`Model ${model} failed:`, aiErr);
        }
      }
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
