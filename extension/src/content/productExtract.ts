import type { ProductData } from "@ext/lib/types";

function getMeta(property: string): string | null {
  const el =
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ??
    document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
  return el?.content?.trim() || null;
}

function scrapeImage(): string | null {
  const ogImage = getMeta("og:image");
  if (ogImage) return ogImage;
  const twImage = getMeta("twitter:image");
  if (twImage) return twImage;

  let largest: HTMLImageElement | null = null;
  let largestArea = 0;
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const area = img.naturalWidth * img.naturalHeight;
    if (area > largestArea && img.src && !img.src.startsWith("data:")) {
      largestArea = area;
      largest = img;
    }
  });
  return largest ? (largest as HTMLImageElement).src : null;
}

function scrapeTitle(): string {
  return getMeta("og:title") ?? getMeta("twitter:title") ?? document.title ?? "";
}

/** Detect product category from page signals */
function detectCategory(): string | undefined {
  const text = (
    (getMeta("og:title") ?? "") +
    " " +
    document.title +
    " " +
    (getMeta("og:description") ?? "") +
    " " +
    (getMeta("description") ?? "")
  ).toLowerCase();

  // Check JSON-LD for product category hints
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  let jsonLdText = "";
  jsonLdScripts.forEach((s) => {
    try {
      const data = JSON.parse(s.textContent || "");
      const cat = data?.category || data?.productGroupID || "";
      jsonLdText += " " + (typeof cat === "string" ? cat : JSON.stringify(cat));
    } catch { /* ignore */ }
  });
  const combined = (text + " " + jsonLdText).toLowerCase();

  // Category keyword matching — order matters (most specific first)
  const patterns: [RegExp, string][] = [
    [/\b(ring|rings|engagement ring|wedding band)\b/, "ring"],
    [/\b(bracelet|bangle|wristband|watch|watches)\b/, "bracelet"],
    [/\b(necklace|pendant|chain|choker)\b/, "necklace"],
    [/\b(earring|earrings|studs|hoops)\b/, "earring"],
    [/\b(nail polish|nail art|manicure|press.on nails)\b/, "nails"],
    [/\b(glasses|sunglasses|eyeglasses|eyewear|frames)\b/, "glasses"],
    [/\b(hat|cap|beanie|headband|headwear)\b/, "hat"],
    [/\b(hair|wig|hair extension|hair clip|hairpin)\b/, "hair"],
    [/\b(shirt|blouse|top|t.shirt|tee|hoodie|sweater|jacket|coat|blazer|vest)\b/, "top"],
    [/\b(dress|gown|romper|jumpsuit)\b/, "dress"],
    [/\b(pants|trousers|jeans|shorts|skirt|leggings)\b/, "bottom"],
    [/\b(shoe|shoes|sneakers|boots|sandals|heels|loafers|footwear)\b/, "shoes"],
    [/\b(bag|handbag|purse|backpack|tote|clutch)\b/, "bag"],
    [/\b(sofa|couch|armchair|coffee table|side table|lamp|rug|carpet|curtain|pillow|cushion)\b/, "living_room"],
    [/\b(bed|mattress|bedding|nightstand|duvet|comforter)\b/, "bedroom"],
    [/\b(kitchen|cookware|dinnerware|mug|cup|plate|bowl)\b/, "kitchen"],
    [/\b(bathroom|towel|shower|bath mat)\b/, "bathroom"],
    [/\b(desk|office chair|monitor stand|bookshelf)\b/, "office"],
    [/\b(dog collar|dog bed|dog toy|cat toy|cat bed|pet)\b/, "pet"],
    [/\b(car seat cover|car mat|steering wheel|car accessory)\b/, "car_interior"],
    [/\b(patio|garden|outdoor furniture|planter|flower pot)\b/, "garden"],
  ];

  for (const [regex, category] of patterns) {
    if (regex.test(combined)) return category;
  }

  return undefined;
}

export function extractProduct(): ProductData {
  return {
    product_url: location.href,
    product_title: scrapeTitle(),
    product_image: scrapeImage() ?? "",
    product_category: detectCategory(),
  };
}
