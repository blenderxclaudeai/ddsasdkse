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

  let largest: HTMLImageElement | null = null;
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
      largest = img;
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

export interface ProductVariants {
  sizes: string[];
  colors: string[];
}

/** Poll DOM for up to `timeoutMs` looking for size/color variant containers */
export async function waitForVariantElements(timeoutMs = 3000): Promise<void> {
  const POLL_INTERVAL = 500;
  const deadline = Date.now() + timeoutMs;

  const variantSelectors = [
    "select[name*='size' i]", "select[id*='size' i]",
    "[class*='size' i][class*='selector' i]", "[class*='size' i][class*='option' i]",
    "[class*='size' i][class*='picker' i]", "[data-testid*='size' i]",
    "[role='radiogroup'][aria-label*='size' i]",
    "select[name*='color' i]", "select[name*='colour' i]",
    "[class*='color' i][class*='selector' i]", "[class*='colour' i][class*='selector' i]",
    "[class*='color' i][class*='picker' i]", "[data-testid*='color' i]",
    "[role='radiogroup'][aria-label*='color' i]",
    // Universal fallback: select/radiogroup/fieldset inside product areas
    "main select", "article select", "form select",
    "main [role='radiogroup']", "article [role='radiogroup']",
    "main fieldset", "article fieldset",
  ];

  while (Date.now() < deadline) {
    for (const sel of variantSelectors) {
      try {
        if (document.querySelector(sel)) return;
      } catch { /* invalid selector */ }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

/** Extract available variant options (sizes, colors) from JSON-LD, microdata, and DOM */
export function extractVariants(): ProductVariants {
  const sizes = new Set<string>();
  const colors = new Set<string>();

  // 1. JSON-LD: Product → offers → availability variants
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of jsonLdScripts) {
    try {
      const data = JSON.parse(s.textContent || "");
      extractVariantsFromJsonLd(data, sizes, colors);
    } catch { /* ignore */ }
  }

  // 2. Universal heuristic (PRIMARY strategy — scans all interactive groups by label)
  // Run this BEFORE the specific DOM selectors so it catches non-standard stores
  if (sizes.size === 0 && colors.size === 0) {
    extractUniversalFallback(sizes, colors);
  }

  // 3. DOM: specific size selectors (supplement if universal didn't find sizes)
  if (sizes.size === 0) {
    extractSizesFromDom(sizes);
  }

  // 4. DOM: specific color selectors (supplement if universal didn't find colors)
  if (colors.size === 0) {
    extractColorsFromDom(colors);
  }

  return {
    sizes: Array.from(sizes),
    colors: Array.from(colors),
  };
}

function extractVariantsFromJsonLd(data: any, sizes: Set<string>, colors: Set<string>): void {
  if (!data) return;

  if (Array.isArray(data)) {
    data.forEach((d) => extractVariantsFromJsonLd(d, sizes, colors));
    return;
  }

  if (data["@graph"]) {
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data["@graph"]];
    graph.forEach((d: any) => extractVariantsFromJsonLd(d, sizes, colors));
    return;
  }

  const type = data["@type"];
  const isProduct = type === "Product" || type === "ProductGroup" ||
    (Array.isArray(type) && (type.includes("Product") || type.includes("ProductGroup")));

  if (!isProduct) return;

  if (data.hasVariant) {
    const variants = Array.isArray(data.hasVariant) ? data.hasVariant : [data.hasVariant];
    for (const v of variants) {
      if (v.size) sizes.add(String(v.size).trim());
      if (v.color) colors.add(String(v.color).trim());
      if (v.additionalProperty) {
        const props = Array.isArray(v.additionalProperty) ? v.additionalProperty : [v.additionalProperty];
        for (const p of props) {
          const name = (p.name || "").toLowerCase();
          const val = String(p.value || "").trim();
          if (!val) continue;
          if (name.includes("size") || name === "taille" || name === "größe" || name === "storlek") sizes.add(val);
          if (name.includes("color") || name.includes("colour") || name === "couleur" || name === "farbe" || name === "färg") colors.add(val);
        }
      }
    }
  }

  if (data.offers) {
    const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
    for (const offer of offers) {
      if (offer.size) sizes.add(String(offer.size).trim());
      if (offer.color) colors.add(String(offer.color).trim());
      if (offer.itemOffered) {
        const item = offer.itemOffered;
        if (item.size) sizes.add(String(item.size).trim());
        if (item.color) colors.add(String(item.color).trim());
      }
    }
  }

  if (data.size) {
    const s = Array.isArray(data.size) ? data.size : [data.size];
    s.forEach((v: any) => sizes.add(String(v).trim()));
  }
  if (data.color) {
    const c = Array.isArray(data.color) ? data.color : [data.color];
    c.forEach((v: any) => colors.add(String(v).trim()));
  }

  if (data.additionalProperty) {
    const props = Array.isArray(data.additionalProperty) ? data.additionalProperty : [data.additionalProperty];
    for (const p of props) {
      const name = (p.name || "").toLowerCase();
      const val = String(p.value || "").trim();
      if (!val) continue;
      if (name.includes("size")) sizes.add(val);
      if (name.includes("color") || name.includes("colour")) colors.add(val);
    }
  }
}

// Blocklist: skip elements whose text matches these patterns
const VARIANT_TEXT_BLOCKLIST = /försäljning|villkor|leverans|retur|policy|guide|reviews|faq|kundtjänst|storleksguide|care|details|cookie|shipping|terms|integritet|privacy|conditions|copyright|nyhetsbrev|newsletter|kundservice|customer service|kontakt|contact|om oss|about us/i;

// Elements inside these ancestors are never variant containers
const EXCLUDED_ANCESTORS = "nav, footer, header, [class*='footer' i], [class*='policy' i], [class*='delivery' i], [class*='cookie' i], [class*='newsletter' i], [class*='legal' i]";

// Product area restriction — only search inside these
const PRODUCT_AREA_SELECTORS = "main, article, form, [class*='product' i], [id*='product' i], [class*='pdp' i], [id*='pdp' i], section";

function isInsideExcludedArea(el: HTMLElement): boolean {
  return !!el.closest(EXCLUDED_ANCESTORS);
}

function isInsideProductArea(el: HTMLElement): boolean {
  return !!el.closest(PRODUCT_AREA_SELECTORS);
}

function isValidSizeValue(val: string): boolean {
  if (val.length > 10) return false;
  if (VARIANT_TEXT_BLOCKLIST.test(val)) return false;
  return true;
}

function isValidColorValue(val: string): boolean {
  if (val.length > 30) return false;
  if (VARIANT_TEXT_BLOCKLIST.test(val)) return false;
  return true;
}

const SIZE_SELECTORS = [
  "select[name*='size' i]",
  "select[id*='size' i]",
  "select[data-testid*='size' i]",
  "select[aria-label*='size' i]",
  "[data-testid*='size' i] select",
];

const COLOR_SELECTORS = [
  "select[name*='color' i]", "select[name*='colour' i]",
  "select[id*='color' i]", "select[id*='colour' i]",
  "select[aria-label*='color' i]", "select[aria-label*='colour' i]",
  "[data-testid*='color' i] select", "[data-testid*='colour' i] select",
];

function extractSizesFromDom(sizes: Set<string>): void {
  for (const sel of SIZE_SELECTORS) {
    const elems = document.querySelectorAll<HTMLSelectElement>(sel);
    for (const select of elems) {
      if (isInsideExcludedArea(select)) continue;
      for (const opt of select.options) {
        const val = opt.text.trim();
        if (val && !opt.disabled && val !== "" && !/select|choose|pick|välj|wähle/i.test(val) && isValidSizeValue(val)) {
          sizes.add(val);
        }
      }
      if (sizes.size > 0) return;
    }
  }

  const sizeContainers = document.querySelectorAll<HTMLElement>(
    "[class*='size' i][class*='selector' i], [class*='size' i][class*='option' i], [class*='size' i][class*='picker' i], [class*='size' i][class*='list' i], [data-testid*='size' i], fieldset[class*='size' i], [role='radiogroup'][aria-label*='size' i]"
  );
  for (const container of sizeContainers) {
    if (isInsideExcludedArea(container)) continue;
    if (!isInsideProductArea(container)) continue;
    const btns = container.querySelectorAll<HTMLElement>("button, [role='radio'], label, a[data-value], li");
    for (const btn of btns) {
      const text = (btn.textContent || "").trim();
      const dataValue = btn.getAttribute("data-value")?.trim();
      const val = dataValue || text;
      if (val && isValidSizeValue(val) && !/size guide|storleksguide|størrelse/i.test(val)) {
        sizes.add(val);
      }
    }
    if (sizes.size > 0) return;
  }

  const sizeButtons = document.querySelectorAll<HTMLElement>("[aria-label*='size' i] button, button[aria-label*='size' i]");
  for (const btn of sizeButtons) {
    if (isInsideExcludedArea(btn)) continue;
    if (!isInsideProductArea(btn)) continue;
    const text = (btn.textContent || btn.getAttribute("aria-label") || "").trim();
    const dataValue = btn.getAttribute("data-value")?.trim();
    const val = dataValue || text;
    if (val && isValidSizeValue(val)) sizes.add(val);
  }
}

function extractColorsFromDom(colors: Set<string>): void {
  for (const sel of COLOR_SELECTORS) {
    const elems = document.querySelectorAll<HTMLSelectElement>(sel);
    for (const select of elems) {
      if (isInsideExcludedArea(select)) continue;
      for (const opt of select.options) {
        const val = opt.text.trim();
        if (val && !opt.disabled && val !== "" && !/select|choose|pick|välj|wähle/i.test(val) && isValidColorValue(val)) {
          colors.add(val);
        }
      }
      if (colors.size > 0) return;
    }
  }

  const colorContainers = document.querySelectorAll<HTMLElement>(
    "[class*='color' i][class*='selector' i], [class*='color' i][class*='option' i], [class*='colour' i][class*='selector' i], [class*='colour' i][class*='option' i], [class*='color' i][class*='picker' i], [class*='color' i][class*='swatch' i], [data-testid*='color' i], [data-testid*='colour' i], fieldset[class*='color' i], [role='radiogroup'][aria-label*='color' i]"
  );
  for (const container of colorContainers) {
    if (isInsideExcludedArea(container)) continue;
    if (!isInsideProductArea(container)) continue;
    const btns = container.querySelectorAll<HTMLElement>("button, [role='radio'], label, a[data-value], li");
    for (const btn of btns) {
      const text = (btn.textContent || "").trim();
      const ariaLabel = btn.getAttribute("aria-label")?.trim();
      const title = btn.getAttribute("title")?.trim();
      const dataValue = btn.getAttribute("data-value")?.trim();
      const val = dataValue || ariaLabel || title || text;
      if (val && isValidColorValue(val)) {
        colors.add(val);
      }
    }
    if (colors.size > 0) return;
  }

  const colorButtons = document.querySelectorAll<HTMLElement>("[aria-label*='color' i] button, [aria-label*='colour' i] button, button[aria-label*='color' i], button[aria-label*='colour' i]");
  for (const btn of colorButtons) {
    if (isInsideExcludedArea(btn)) continue;
    if (!isInsideProductArea(btn)) continue;
    const ariaLabel = btn.getAttribute("aria-label")?.trim();
    const title = btn.getAttribute("title")?.trim();
    const dataValue = btn.getAttribute("data-value")?.trim();
    const val = dataValue || ariaLabel || title || (btn.textContent || "").trim();
    if (val && isValidColorValue(val)) colors.add(val);
  }
}

// Expanded size/color label keywords for multi-language support
const SIZE_LABEL_RE = /size|storlek|taille|größe|grösse|talla|maat|rozmiar|dimensione|tamanho|サイズ/i;
const COLOR_LABEL_RE = /colo[u]?r|färg|couleur|farbe|kleur|kolor|colore|cor|色|カラー/i;

/** Universal fallback: scan select, radiogroup, fieldset, button groups inside product areas */
function extractUniversalFallback(sizes: Set<string>, colors: Set<string>): void {
  const productAreas = document.querySelectorAll<HTMLElement>(PRODUCT_AREA_SELECTORS);
  
  for (const area of productAreas) {
    // Find selects
    const selects = area.querySelectorAll<HTMLSelectElement>("select");
    for (const sel of selects) {
      if (isInsideExcludedArea(sel)) continue;
      const label = inferLabelFor(sel);
      const isSize = SIZE_LABEL_RE.test(label);
      const isColor = COLOR_LABEL_RE.test(label);
      if (!isSize && !isColor) continue;
      
      for (const opt of sel.options) {
        const val = opt.text.trim();
        if (!val || opt.disabled || /select|choose|pick|välj|wähle/i.test(val)) continue;
        if (isSize && isValidSizeValue(val)) sizes.add(val);
        if (isColor && isValidColorValue(val)) colors.add(val);
      }
    }
    
    // Find radiogroups and fieldsets
    const radioGroups = area.querySelectorAll<HTMLElement>("[role='radiogroup'], fieldset");
    for (const group of radioGroups) {
      if (isInsideExcludedArea(group)) continue;
      const label = inferLabelFor(group);
      const isSize = SIZE_LABEL_RE.test(label);
      const isColor = COLOR_LABEL_RE.test(label);
      if (!isSize && !isColor) continue;
      
      const children = group.querySelectorAll<HTMLElement>("button, [role='radio'], label, li, a[data-value]");
      for (const child of children) {
        const dataValue = child.getAttribute("data-value")?.trim();
        const ariaLabel = child.getAttribute("aria-label")?.trim();
        const title = child.getAttribute("title")?.trim();
        const text = (child.textContent || "").trim();
        const val = dataValue || ariaLabel || title || text;
        if (!val) continue;
        if (isSize && isValidSizeValue(val)) sizes.add(val);
        if (isColor && isValidColorValue(val)) colors.add(val);
      }
    }

    // Find div/section containers with button groups (common in modern SPAs)
    const buttonGroups = area.querySelectorAll<HTMLElement>("div, section, ul");
    for (const group of buttonGroups) {
      if (isInsideExcludedArea(group)) continue;
      // Only consider groups that have 2+ interactive children and a detectable label
      const buttons = group.querySelectorAll<HTMLElement>(":scope > button, :scope > a[data-value], :scope > label, :scope > li > button, :scope > li > a");
      if (buttons.length < 2 || buttons.length > 30) continue;
      
      const label = inferLabelFor(group);
      if (!label) continue;
      const isSize = SIZE_LABEL_RE.test(label);
      const isColor = COLOR_LABEL_RE.test(label);
      if (!isSize && !isColor) continue;
      
      for (const btn of buttons) {
        const dataValue = btn.getAttribute("data-value")?.trim();
        const ariaLabel = btn.getAttribute("aria-label")?.trim();
        const title = btn.getAttribute("title")?.trim();
        const text = (btn.textContent || "").trim();
        const val = dataValue || ariaLabel || title || text;
        if (!val) continue;
        if (isSize && isValidSizeValue(val)) sizes.add(val);
        if (isColor && isValidColorValue(val)) colors.add(val);
      }
    }
  }
}

/** Try to find a text label for a form element — expanded heuristics */
function inferLabelFor(el: HTMLElement): string {
  // aria-label on element itself
  const aria = el.getAttribute("aria-label") || "";
  if (aria) return aria;
  
  // aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent || "";
  }
  
  // legend inside fieldset
  const legend = el.querySelector("legend");
  if (legend) return legend.textContent || "";
  
  // Associated <label>
  const id = el.id;
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label) return label.textContent || "";
  }
  
  // data-testid containing size/color keywords
  const testId = el.getAttribute("data-testid") || "";
  if (testId) return testId;
  
  // Previous sibling: label, heading, span, p
  const prev = el.previousElementSibling;
  if (prev && /^(LABEL|SPAN|P|H1|H2|H3|H4|H5|H6|LEGEND|STRONG)$/.test(prev.tagName)) {
    const text = prev.textContent || "";
    if (text.length < 40) return text;
  }
  
  // Check parent's data-testid, aria-label
  const parent = el.parentElement;
  if (parent) {
    const parentLabel = parent.getAttribute("aria-label") || parent.getAttribute("data-testid") || "";
    if (parentLabel) return parentLabel;
    
    // Check parent's previous sibling (heading above the container)
    const parentPrev = parent.previousElementSibling;
    if (parentPrev && /^(LABEL|SPAN|P|H1|H2|H3|H4|H5|H6|LEGEND|STRONG)$/.test(parentPrev.tagName)) {
      const text = parentPrev.textContent || "";
      if (text.length < 40) return text;
    }
  }
  
  // Grandparent label check (for deeply nested components)
  const grandparent = parent?.parentElement;
  if (grandparent) {
    const gpLabel = grandparent.getAttribute("aria-label") || grandparent.getAttribute("data-testid") || "";
    if (gpLabel) return gpLabel;
    
    const gpPrev = grandparent.previousElementSibling;
    if (gpPrev && /^(LABEL|SPAN|P|H1|H2|H3|H4|H5|H6|LEGEND|STRONG)$/.test(gpPrev.tagName)) {
      const text = gpPrev.textContent || "";
      if (text.length < 40) return text;
    }
  }
  
  // Closest heading within reasonable distance
  const closestHeading = findClosestHeading(el);
  if (closestHeading) return closestHeading;
  
  // name attribute for selects
  return el.getAttribute("name") || "";
}

/** Walk up the DOM to find the nearest heading (h1-h6) or bold span near the element */
function findClosestHeading(el: HTMLElement): string {
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && depth < 5) {
    // Check previous siblings for headings
    let sib = current.previousElementSibling;
    let sibCount = 0;
    while (sib && sibCount < 3) {
      if (/^(H[1-6]|LABEL|LEGEND)$/.test(sib.tagName)) {
        const text = (sib.textContent || "").trim();
        if (text.length < 40) return text;
      }
      // Check for bold/strong spans that act as labels
      if (sib.tagName === "SPAN" || sib.tagName === "DIV" || sib.tagName === "P") {
        const strong = sib.querySelector("strong, b");
        if (strong) {
          const text = (strong.textContent || "").trim();
          if (text.length < 40) return text;
        }
        // Check font-weight
        try {
          const style = getComputedStyle(sib);
          if (parseInt(style.fontWeight) >= 500 || style.fontWeight === "bold") {
            const text = (sib.textContent || "").trim();
            if (text.length < 40) return text;
          }
        } catch { /* skip */ }
      }
      sib = sib.previousElementSibling;
      sibCount++;
    }
    current = current.parentElement;
    depth++;
  }
  return "";
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
