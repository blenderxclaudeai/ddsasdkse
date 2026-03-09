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

// ── Price extraction ──

/** Extract a clean price string from raw text, e.g. "$49.99", "199 kr", "€29,90" */
function cleanPrice(raw: string): string | null {
  // Match common price patterns: $49.99, 49.99, 49,99, 199 kr, €29.90, £19.99
  const match = raw.match(
    /(?:[\$€£¥₹])\s?\d[\d\s,.]*\d|\d[\d\s,.]*\d\s?(?:kr|sek|eur|usd|gbp|dkk|nok|SEK|EUR|USD|GBP)/i
  );
  if (match) return match[0].trim();

  // Simpler: just a currency symbol followed by digits
  const simple = raw.match(/[\$€£¥₹]\s?\d+[.,]?\d{0,2}/);
  if (simple) return simple[0].trim();

  // Digits with decimal/comma that look like prices
  const digits = raw.match(/\d+[.,]\d{2}/);
  if (digits) return digits[0].trim();

  return null;
}

/** Scrape price with priority chain: JSON-LD → Microdata → Meta → CSS selectors */
function scrapePrice(): string | null {
  // 1. JSON-LD
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of jsonLdScripts) {
    try {
      const data = JSON.parse(s.textContent || "");
      const price = extractPriceFromJsonLd(data);
      if (price) return price;
    } catch { /* ignore */ }
  }

  // 2. Microdata — [itemprop="price"]
  const priceEl = document.querySelector('[itemprop="price"]');
  if (priceEl) {
    const val =
      (priceEl as HTMLElement).getAttribute("content") ||
      (priceEl as HTMLElement).textContent?.trim();
    if (val) {
      const currencyEl = document.querySelector('[itemprop="priceCurrency"]');
      const currency = currencyEl?.getAttribute("content") || currencyEl?.textContent?.trim() || "";
      const cleaned = cleanPrice(val) || val.trim();
      if (cleaned) return currency ? `${currency} ${cleaned}` : cleaned;
    }
  }

  // 3. Meta tags
  for (const prop of ["product:price:amount", "og:price:amount"]) {
    const amount = getMeta(prop);
    if (amount) {
      const currency = getMeta("product:price:currency") || getMeta("og:price:currency") || "";
      return currency ? `${currency} ${amount}` : amount;
    }
  }

  // 4. CSS selectors — common price patterns on retailer sites
  const priceSelectors = [
    "[data-price]",
    "[class*='product-price'] [class*='current']",
    "[class*='product-price'] [class*='sale']",
    "[class*='product-price']",
    "[class*='ProductPrice']",
    "[class*='productPrice']",
    "[class*='price-current']",
    "[class*='price--current']",
    "[class*='sale-price']",
    "[class*='salePrice']",
    "[class*='current-price']",
    "[class*='Price'] [class*='current']",
    "[class*='Price'] [class*='sale']",
    ".price .now",
    ".price-box .price",
    "[class*='price'] [class*='now']",
    "[class*='price']",
  ];

  for (const sel of priceSelectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        // Check data-price attribute first
        const dataPrice = el.getAttribute("data-price");
        if (dataPrice) {
          const cleaned = cleanPrice(dataPrice);
          if (cleaned) return cleaned;
        }

        const text = el.textContent?.trim();
        if (text) {
          const cleaned = cleanPrice(text);
          if (cleaned) return cleaned;
        }
      }
    } catch { /* invalid selector, skip */ }
  }

  return null;
}

/** Recursively extract price from JSON-LD data (handles @graph, arrays, nested offers) */
function extractPriceFromJsonLd(data: any): string | null {
  if (!data) return null;

  // Handle @graph arrays
  if (data["@graph"]) {
    for (const item of Array.isArray(data["@graph"]) ? data["@graph"] : [data["@graph"]]) {
      const p = extractPriceFromJsonLd(item);
      if (p) return p;
    }
  }

  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      const p = extractPriceFromJsonLd(item);
      if (p) return p;
    }
    return null;
  }

  // Check if this is a Product type
  const type = data["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product"));

  if (isProduct && data.offers) {
    const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
    for (const offer of offers) {
      const price = offer.price ?? offer.lowPrice ?? offer.highPrice;
      if (price != null) {
        const currency = offer.priceCurrency || "";
        const priceStr = String(price);
        return currency ? `${currency} ${priceStr}` : priceStr;
      }
    }
  }

  return null;
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

  // Scrape breadcrumbs for extra category signals
  const breadcrumbs = document.querySelectorAll(
    '[class*="breadcrumb"] a, nav[aria-label*="bread"] a, nav[aria-label*="Bread"] a, ol li a'
  );
  let breadcrumbText = "";
  breadcrumbs.forEach((a) => { breadcrumbText += " " + (a.textContent || ""); });

  const combined = (text + " " + jsonLdText + " " + breadcrumbText).toLowerCase();

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
    [/\b(swimwear|bikini|swim trunks|badkläder|baddräkt|bikini|Badeanzug|Badehose)\b/, "bottom"],
    [/\b(shirt|blouse|top|t.shirt|tee|hoodie|sweater|jacket|coat|blazer|vest|tröja|jacka|kappa|skjorta|blus|väst|chemise|veste|manteau|Hemd|Jacke|Mantel|camisa|chaqueta|abrigo)\b/, "top"],
    [/\b(dress|gown|romper|jumpsuit|klänning|robe|Kleid|vestido)\b/, "dress"],
    [/\b(pants|trousers|jeans|shorts|skirt|leggings|byxor|kjol|pantalon|jupe|Hose|Rock|pantalones|falda)\b/, "bottom"],
    [/\b(shoe|shoes|sneakers|boots|sandals|heels|loafers|footwear|skor|stövlar|sandaler|chaussures|bottes|Schuhe|Stiefel|zapatos|botas)\b/, "shoes"],
    [/\b(socks|stockings|strumpor|sockor|chaussettes|Socken|calcetines)\b/, "shoes"],
    [/\b(bag|handbag|purse|backpack|tote|clutch|väska|ryggsäck|sac|Tasche|Rucksack|bolso|mochila)\b/, "bag"],
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
    product_price: scrapePrice() ?? undefined,
    retailer_domain: location.hostname.replace(/^www\./, ""),
  };
}
