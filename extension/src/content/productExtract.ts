import type { ProductData } from "@ext/lib/types";

function getMeta(property: string): string | null {
  const el =
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ??
    document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
  return el?.content?.trim() || null;
}

function scrapeImage(): string | null {
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of jsonLdScripts) {
    try {
      const data = JSON.parse(s.textContent || "");
      const img = extractImageFromJsonLd(data);
      if (img) return img;
    } catch { /* ignore */ }
  }

  const ogImage = getMeta("og:image");
  if (ogImage) return ogImage;
  const twImage = getMeta("twitter:image");
  if (twImage) return twImage;

  const productSelectors = [
    "[class*='product-image'] img",
    "[class*='product-detail'] img",
    "[class*='ProductImage'] img",
    "[class*='product-gallery'] img:first-child",
    "[class*='product-hero'] img",
    "[class*='gallery'] img:first-child",
    "[data-testid*='product-image'] img",
    "[data-testid*='product'] img",
    "[id*='product-image'] img",
    "[id*='product'] img:first-child",
    "main img[src]:first-of-type",
    "img[data-src]",
    "img[data-lazy-src]",
  ];
  for (const sel of productSelectors) {
    try {
      const el = document.querySelector<HTMLImageElement>(sel);
      if (!el) continue;
      const imgSrc = el.src || el.dataset.src || el.dataset.lazySrc || el.getAttribute("data-lazy-src") || "";
      if (imgSrc && !imgSrc.startsWith("data:")) return imgSrc;
    } catch { /* skip */ }
  }

  const ellosImgs = document.querySelectorAll<HTMLImageElement>("[data-product-media] img, [class*='media'] picture img, [class*='product-media'] img");
  for (const img of ellosImgs) {
    const src = img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || "";
    if (src && !src.startsWith("data:")) return src;
  }

  const pictures = document.querySelectorAll("picture");
  for (const pic of pictures) {
    const parent = pic.closest("[class*='product'], [class*='gallery'], [id*='product'], main, article, [class*='detail'], [class*='hero'], [class*='media']");
    if (!parent && pictures.length > 8) continue;
    const sources = pic.querySelectorAll<HTMLSourceElement>("source[srcset]");
    for (const source of sources) {
      const srcset = source.getAttribute("srcset");
      if (srcset) {
        const url = parseSrcsetLargest(srcset);
        if (url) return url;
      }
    }
    const img = pic.querySelector<HTMLImageElement>("img");
    if (img?.currentSrc && !img.currentSrc.startsWith("data:")) return img.currentSrc;
    if (img?.src && !img.src.startsWith("data:")) return img.src;
    if (img?.dataset.src && !img.dataset.src.startsWith("data:")) return img.dataset.src;
  }

  const imgWithSrcset = document.querySelector<HTMLImageElement>("img[srcset]");
  if (imgWithSrcset) {
    const url = parseSrcsetLargest(imgWithSrcset.getAttribute("srcset") || "");
    if (url) return url;
    if (imgWithSrcset.src && !imgWithSrcset.src.startsWith("data:")) return imgWithSrcset.src;
  }

  let largestArea = 0;
  let largestSrc = "";
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const area = w * h;
    if (w < 200 || h < 200) return;
    if (w / h > 3 || h / w > 3) return;
    const src = img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || "";
    if (area > largestArea && src && !src.startsWith("data:")) {
      largestArea = area;
      largestSrc = src;
    }
  });
  return largestSrc || null;
}

function parseSrcsetLargest(srcset: string): string | null {
  const entries = srcset.split(",").map((s) => s.trim()).filter(Boolean);
  let bestUrl: string | null = null;
  let bestWidth = 0;
  for (const entry of entries) {
    const parts = entry.split(/\s+/);
    const url = parts[0];
    if (!url || url.startsWith("data:")) continue;
    const descriptor = parts[1] || "";
    const widthMatch = descriptor.match(/(\d+)w/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 0;
    if (width >= bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }
  return bestUrl || (entries.length > 0 ? entries[entries.length - 1].split(/\s+/)[0] : null);
}

function extractImageFromJsonLd(data: any): string | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = extractImageFromJsonLd(item);
      if (img) return img;
    }
    return null;
  }
  if (data["@graph"]) {
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data["@graph"]];
    for (const item of graph) {
      const img = extractImageFromJsonLd(item);
      if (img) return img;
    }
    return null;
  }
  const type = data["@type"];
  const isProduct = type === "Product" || type === "ProductGroup" ||
    (Array.isArray(type) && (type.includes("Product") || type.includes("ProductGroup")));
  if (!isProduct) return null;
  if (data.image) {
    if (typeof data.image === "string") return data.image;
    if (Array.isArray(data.image) && data.image.length > 0) {
      return typeof data.image[0] === "string" ? data.image[0] : data.image[0]?.url || null;
    }
    if (data.image.url) return data.image.url;
  }
  return null;
}

function scrapeTitle(): string {
  return getMeta("og:title") ?? getMeta("twitter:title") ?? document.title ?? "";
}

function cleanPrice(raw: string): string | null {
  const match = raw.match(
    /(?:[\$€£¥₹]\s?\d[\d\s,.]*\d|\b(?:USD|EUR|SEK|NOK|DKK|GBP|CAD|AUD|CHF|JPY|INR|KR)\s?\d[\d\s,.]*\d|\d[\d\s,.]*\d\s?(?:kr|usd|eur|sek|nok|dkk|gbp|cad|aud|chf|jpy|inr))/i
  );
  if (match) return match[0].trim();
  const simple = raw.match(/[\$€£¥₹]\s?\d+[.,]?\d{0,2}/);
  if (simple) return simple[0].trim();
  const digits = raw.match(/\d[\d\s,.]*[.,]\d{2}/);
  if (digits) return digits[0].trim();
  return null;
}

function scrapePrice(): string | null {
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of jsonLdScripts) {
    try {
      const data = JSON.parse(s.textContent || "");
      const price = extractPriceFromJsonLd(data);
      if (price) return price;
    } catch { /* ignore */ }
  }

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

  for (const prop of ["product:price:amount", "og:price:amount"]) {
    const amount = getMeta(prop);
    if (amount) {
      const currency = getMeta("product:price:currency") || getMeta("og:price:currency") || "";
      return currency ? `${currency} ${amount}` : amount;
    }
  }

  const priceSelectors = [
    "[data-price]",
    "[data-testid*='price' i]",
    "[data-testid*='current-price' i]",
    "[data-testid*='product'] [data-testid*='price']",
    "[data-qa*='price' i]",
    "[id*='price' i]:not(nav *, footer *, header *)",
    "[class*='product-price'] [class*='current']",
    "[class*='product-price'] [class*='sale']",
    "[class*='product-price']",
    "[class*='ProductPrice']",
    "[class*='productPrice']",
    "[class*='price-current']",
    "[class*='price--current']",
    "[class*='price__amount']",
    "[class*='sale-price']",
    "[class*='salePrice']",
    "[class*='current-price']",
    "[class*='Price'] [class*='current']",
    "[class*='Price'] [class*='sale']",
    "[class*='money']:not(nav *, footer *, header *)",
    "[class*='amount']:not(nav *, footer *, header *)",
    ".price .now",
    ".price-box .price",
    "[class*='price'] [class*='now']",
    "main [class*='price' i]",
    "article [class*='price' i]",
    "[class*='product' i] [class*='price' i]",
    "[class*='price']",
  ];

  for (const sel of priceSelectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
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

  const fallbackNodes = document.querySelectorAll<HTMLElement>(
    "[data-price], [data-testid*='price' i], [aria-label*='price' i], [class*='price' i], [id*='price' i], [class*='money' i], [class*='amount' i]"
  );
  for (const node of Array.from(fallbackNodes).slice(0, 120)) {
    const candidate = [
      node.getAttribute("data-price") || "",
      node.getAttribute("aria-label") || "",
      node.textContent || "",
    ]
      .join(" ")
      .trim();
    if (!candidate) continue;
    const cleaned = cleanPrice(candidate);
    if (cleaned) return cleaned;
  }

  const ariaNodes = document.querySelectorAll<HTMLElement>("[aria-label]");
  for (const node of Array.from(ariaNodes).slice(0, 60)) {
    const label = node.getAttribute("aria-label") || "";
    if (/price|pris|prix|preis|precio/i.test(label)) {
      const cleaned = cleanPrice(label);
      if (cleaned) return cleaned;
      const text = node.textContent?.trim();
      if (text) {
        const fromText = cleanPrice(text);
        if (fromText) return fromText;
      }
    }
  }

  const shortTextNodes = document.querySelectorAll<HTMLElement>("span, p, div");
  for (const node of Array.from(shortTextNodes).slice(0, 200)) {
    const text = node.textContent?.trim();
    if (!text || text.length > 30 || text.length < 3) continue;
    if (node.children.length > 2) continue;
    const cleaned = cleanPrice(text);
    if (cleaned) return cleaned;
  }

  return null;
}

function extractPriceFromJsonLd(data: any): string | null {
  if (!data) return null;
  if (data["@graph"]) {
    for (const item of Array.isArray(data["@graph"]) ? data["@graph"] : [data["@graph"]]) {
      const p = extractPriceFromJsonLd(item);
      if (p) return p;
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const p = extractPriceFromJsonLd(item);
      if (p) return p;
    }
    return null;
  }
  const type = data["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
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

  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  let jsonLdText = "";
  jsonLdScripts.forEach((s) => {
    try {
      const data = JSON.parse(s.textContent || "");
      const cat = data?.category || data?.productGroupID || "";
      jsonLdText += " " + (typeof cat === "string" ? cat : JSON.stringify(cat));
    } catch { /* ignore */ }
  });

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
    product_image: scrapeImage() || "",
    product_category: detectCategory(),
    product_price: scrapePrice() ?? undefined,
    retailer_domain: location.hostname.replace(/^www\./, ""),
  };
}
