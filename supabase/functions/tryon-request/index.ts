// Virtual Try-On Edge Function — server-side category fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/** Server-side category detection from product title + URL (fallback when extension doesn't provide one) */
function detectCategoryFromTitle(title: string, url: string): string | undefined {
  const combined = ((title || "") + " " + (url || "")).toLowerCase();

  const patterns: [RegExp, string][] = [
    [/\b(ring|rings|engagement ring|wedding band|ringar|förlovningsring)\b/, "ring"],
    [/\b(bracelet|bangle|wristband|armband)\b/, "bracelet"],
    [/\b(watch|watches|klocka|montre|reloj|Uhr)\b/, "watch"],
    [/\b(necklace|pendant|chain|choker|halsband|collier|Halskette|Kette|collar)\b/, "necklace"],
    [/\b(earring|earrings|studs|hoops|örhängen|örhänge|boucles d'oreilles|Ohrringe|pendientes)\b/, "earring"],
    [/\b(nail polish|nail art|manicure|press.on nails|nagellack|naglar)\b/, "nails"],
    [/\b(lipstick|lip gloss|lip liner|lip stain|lip balm|lip tint|läppstift)\b/, "lips"],
    [/\b(eyeshadow|eyeliner|mascara|eye cream|contact lens|false lashes|lash|ögonskugga|ögonfärg)\b/, "eyes"],
    [/\b(eyebrow|brow pencil|brow gel|brow pomade|ögonbryn)\b/, "brows"],
    [/\b(glasses|sunglasses|eyeglasses|eyewear|frames|glasögon|solglasögon|lunettes|Brille|Sonnenbrille|gafas)\b/, "glasses"],
    [/\b(hat|cap|beanie|headband|headwear|mössa|hatt|keps|chapeau|Mütze|Hut|sombrero|gorro)\b/, "hat"],
    [/\b(hair|wig|hair extension|hair clip|hairpin|peruk|hårförlängning)\b/, "hair"],
    [/\b(underwear|boxers|briefs|lingerie|panties|bra|underkläder|kalsonger|trosor|bh|sous-vêtements|Unterwäsche)\b/, "bottom"],
    [/\b(swimwear|bikini|swim trunks|badkläder|baddräkt|Badeanzug|Badehose)\b/, "bottom"],
    [/\b(shirt|blouse|top|t.shirt|tee|hoodie|sweater|jacket|coat|blazer|vest|tröja|jacka|kappa|skjorta|blus|väst|chemise|veste|manteau|Hemd|Jacke|Mantel|camisa|chaqueta|abrigo)\b/, "top"],
    [/\b(dress|gown|romper|jumpsuit|klänning|robe|Kleid|vestido)\b/, "dress"],
    [/\b(pants|trousers|jeans|shorts|skirt|leggings|byxor|kjol|pantalon|jupe|Hose|Rock|pantalones|falda)\b/, "bottom"],
    [/\b(shoe|shoes|sneakers|boots|sandals|heels|loafers|footwear|skor|stövlar|sandaler|chaussures|bottes|Schuhe|Stiefel|zapatos|botas)\b/, "shoes"],
    [/\b(socks|stockings|strumpor|sockor|chaussettes|Socken|calcetines)\b/, "socks"],
    [/\b(gloves|mittens|handskar|vantar|gants|Handschuhe|guantes)\b/, "gloves"],
    [/\b(belt|belts|bälte|ceinture|Gürtel|cinturón)\b/, "belt"],
    [/\b(sleeve|arm warmer|armband|arm|armbågsskydd)\b/, "arms_product"],
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
  hat: "head",
  hair: "hair",
  top: "upper_body",
  dress: "full_body",
  bottom: "lower_body",
  shoes: "feet",
  bag: "upper_body",
  eyes: "eyes",
  lips: "lips",
  brows: "brows",
  socks: "feet",
  gloves: "hands",
  watch: "hands",
  back_product: "back",
  belt: "lower_body",
  arms_product: "arms",
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
  lower_body: "lower body",
  ears: "ears",
  nails: "nails",
  face: "face",
  eyes: "eyes",
  lips: "lips",
  brows: "brows",
  hair: "hair",
  head: "head",
  full_body: "full body",
  feet: "feet",
  arms: "arms",
  back: "back",
  lower_back: "lower back",
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

    // ===== STEP 1: Product Extraction (wearable categories only) =====
    const cat = effectiveCategory || "";
    const productLabel = title ? ` The product is: "${title}".` : "";

    let cleanProductImage = productImageDataUrl; // fallback to original

    if (wearableCategories.has(cat) || !effectiveCategory) {
      console.log("Step 1: Extracting product from store image...");
      const extractionPrompt = `Extract ONLY the product/clothing item from this image. Remove the person, mannequin, model, and background completely. Output JUST the item on a plain white background, as if it were a flat-lay product photo or a cutout PNG. Do not add any person, body parts, or mannequin. Only the product itself.${productLabel}`;

      try {
        const extractController = new AbortController();
        const extractTimeout = setTimeout(() => extractController.abort(), 45_000);

        const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: extractController.signal,
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            modalities: ["image", "text"],
            messages: [{
              role: "user",
              content: [
                { type: "text", text: extractionPrompt },
                { type: "image_url", image_url: { url: productImageDataUrl } },
              ],
            }],
          }),
        });

        clearTimeout(extractTimeout);

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          const extractMsg = extractData.choices?.[0]?.message;

          let extractedUrl: string | null = null;
          if (extractMsg?.images?.[0]?.image_url?.url) {
            extractedUrl = extractMsg.images[0].image_url.url;
          }
          if (!extractedUrl && Array.isArray(extractMsg?.content)) {
            for (const part of extractMsg.content) {
              if (part.type === "image_url" && part.image_url?.url) {
                extractedUrl = part.image_url.url;
                break;
              }
            }
          }
          if (!extractedUrl && typeof extractMsg?.content === "string") {
            const match = extractMsg.content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
            if (match) extractedUrl = match[0];
          }

          if (extractedUrl) {
            cleanProductImage = extractedUrl;
            console.log("Step 1 success: product extracted to clean image");
          } else {
            console.warn("Step 1: no image returned, using original product image");
          }
        } else {
          console.warn("Step 1 failed:", extractResponse.status, await extractResponse.text());
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          console.warn("Step 1 timed out, using original product image");
        } else {
          console.warn("Step 1 error:", err);
        }
      }
    }

    // ===== STEP 2: Try-On Compositing =====
    const step2PromptMode = roomCategories.has(cat) ? "room" :
      wearableCategories.has(cat) ? "wearable" :
      cat === "pet" ? "pet" : cat === "car_interior" ? "car" : cat === "garden" ? "garden" : "wearable(default)";
    console.log(`Step 2: compositing. Category: "${effectiveCategory}", promptMode: "${step2PromptMode}", usedExtractedProduct: ${cleanProductImage !== productImageDataUrl}`);

    let promptText: string;

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
      // Wearable — simplified prompt since product image is now clean (no other person)
      promptText = `You are a virtual fitting room. Your job is a simple image compositing task: place the product from Image 2 onto the person in Image 1.

Image 1: The customer. Preserve their EXACT appearance: face, skin tone, body shape, hair, and every physical feature.

Image 2: A clean product image on a plain background. This is the item to place on the customer.

Task: Generate a realistic photo of the person from Image 1 wearing/using the product from Image 2. The product must be:
- Correctly sized and fitted to the customer's body
- Shown with realistic fabric draping, shadows, and lighting matching Image 1
- Naturally integrated as if the customer is actually wearing/using it

CRITICAL RULES:
1. You MUST output an image. Never return text-only.
2. Do NOT alter the customer's face, skin color, body shape, hair, or any physical feature.
3. The output should look like the customer took a photo while wearing the product.${productLabel}`;
    }

    const PER_ATTEMPT_TIMEOUT_MS = 55_000;
    resultImageUrl = null;
    aiRefusal = null;

    // Try compositing (1 attempt with extracted image, 1 retry if needed)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`Step 2 attempt ${attempt + 1}/2`);
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
            model: "google/gemini-3-pro-image-preview",
            modalities: ["image", "text"],
            messages: [{
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: userPhotoUrl } },
                { type: "image_url", image_url: { url: cleanProductImage } },
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
            if (dataUriMatch) resultImageUrl = dataUriMatch[0];
          }

          if (resultImageUrl) {
            console.log(`Step 2 success on attempt ${attempt + 1}`);
            break;
          }
          // Diagnostics: log full response structure when no image found
          const contentTypes = Array.isArray(message?.content)
            ? message.content.map((p: any) => p.type)
            : [typeof message?.content];
          const textContent = Array.isArray(message?.content)
            ? message.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
            : (typeof message?.content === "string" ? message.content : "");
          console.error(`Step 2 attempt ${attempt + 1}: no image. Refusal:`, JSON.stringify(message?.refusal),
            `Content types:`, JSON.stringify(contentTypes),
            `Text content:`, textContent.slice(0, 500),
            `Message keys:`, JSON.stringify(Object.keys(message || {})));
        } else {
          console.error(`Step 2 attempt ${attempt + 1} error:`, aiResponse.status, await aiResponse.text());
        }
      } catch (aiErr: any) {
        if (aiErr?.name === "AbortError") {
          console.error(`Step 2 attempt ${attempt + 1} timed out`);
        } else {
          console.error(`Step 2 attempt ${attempt + 1} failed:`, aiErr);
        }
      }
    }
    if (!resultImageUrl) {
      const errorMsg = typeof aiRefusal === "string" && aiRefusal
        ? `The AI declined: ${aiRefusal}`
        : "The AI model's safety filters blocked this try-on. This can happen when the AI detects differences in gender or ethnicity between you and the product image — a limitation of the current AI model, not something we agree with. We're working on it. Please try a different product or photo.";
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
