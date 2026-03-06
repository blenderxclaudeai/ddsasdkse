/**
 * Lightweight product-grid detection and on-click extraction.
 *
 * Design: findCardContainers() returns raw DOM elements only — no data
 * extraction happens until the user clicks a specific card.
 */

import type { ProductData } from "@ext/lib/types";

// ── URL patterns that indicate listing / collection pages ──

const LISTING_PATH_RE =
  /\/(collections?|categor(y|ies)|shop|search|c|pl|browse|products?|catalog(ue)?|department|brand|s)\b/i;

// ── Selectors likely to match individual product cards ──

const CARD_SELECTORS = [
  "[data-product-id]",
  "[data-product]",
  "[data-testid*='product']",
  "[class*='product-card']",
  "[class*='product-item']",
  "[class*='product_card']",
  "[class*='product_item']",
  "[class*='productCard']",
  "[class*='productItem']",
  "[class*='product-tile']",
  "[class*='ProductCard']",
  "[class*='ProductTile']",
  "li[class*='product']",
];

// Grid-like parent containers
const GRID_SELECTORS = [
  "[class*='grid']",
  "[class*='product-list']",
  "[class*='product_list']",
  "[class*='productList']",
  "[class*='ProductList']",
  "[class*='collection']",
  "ul[class*='product']",
  "[role='list']",
];

const MIN_CARD_SIZE = 80;

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/** Returns true if the current page looks like a product listing. */
export function isListingPage(): boolean {
  // URL heuristic
  if (LISTING_PATH_RE.test(location.pathname)) return true;

  // DOM heuristic: 4+ card-like elements on the page
  const count = countCardElements();
  return count >= 4;
}

/**
 * Returns raw container elements that look like product cards.
 * No product data is extracted — just DOM references.
 */
export function findCardContainers(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const results: HTMLElement[] = [];

  // Strategy 1: direct card selectors
  for (const sel of CARD_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (!seen.has(el) && isLargeEnough(el)) {
        seen.add(el);
        results.push(el);
      }
    });
  }

  // Strategy 2: <article> elements inside grids
  for (const gridSel of GRID_SELECTORS) {
    document.querySelectorAll<HTMLElement>(gridSel).forEach((grid) => {
      grid.querySelectorAll<HTMLElement>("article").forEach((el) => {
        if (!seen.has(el) && isLargeEnough(el)) {
          seen.add(el);
          results.push(el);
        }
      });
    });
  }

  // Strategy 3: <a> tags containing <img> inside grid containers
  if (results.length < 4) {
    for (const gridSel of GRID_SELECTORS) {
      document.querySelectorAll<HTMLElement>(gridSel).forEach((grid) => {
        grid.querySelectorAll<HTMLElement>("a").forEach((a) => {
          if (a.querySelector("img") && !seen.has(a) && isLargeEnough(a)) {
            seen.add(a);
            results.push(a);
          }
        });
      });
    }
  }

  return results;
}

/**
 * Extract product data from a specific card container.
 * Called ONLY on user click — never during page scan.
 */
export function extractFromCard(card: HTMLElement): ProductData | null {
  const img = findPrimaryImage(card);
  if (!img) return null;

  const link = findPrimaryLink(card);
  const title = scrapeCardTitle(card);

  return {
    product_url: link || location.href,
    product_title: title,
    product_image: img,
    product_category: detectCardCategory(card),
  };
}

/**
 * Fallback: if extractFromCard returns null (no image), try to
 * at least get the product page URL from the card's link.
 */
export function extractFallbackFromLink(card: HTMLElement): string | null {
  return findPrimaryLink(card);
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function countCardElements(): number {
  let total = 0;
  for (const sel of CARD_SELECTORS) {
    total += document.querySelectorAll(sel).length;
    if (total >= 4) return total;
  }
  return total;
}

function isLargeEnough(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width >= MIN_CARD_SIZE && rect.height >= MIN_CARD_SIZE;
}

function findPrimaryImage(card: HTMLElement): string | null {
  // Prefer the first visible <img> with a real src
  const imgs = card.querySelectorAll<HTMLImageElement>("img");
  for (const img of imgs) {
    const src = img.src || img.dataset.src || img.getAttribute("data-lazy-src") || "";
    if (src && !src.startsWith("data:") && !src.includes("pixel") && !src.includes("spacer")) {
      return src;
    }
  }

  // Check for background-image on the card or a child
  const bgEl = card.querySelector<HTMLElement>("[style*='background-image']");
  if (bgEl) {
    const match = bgEl.style.backgroundImage.match(/url\(["']?(.+?)["']?\)/);
    if (match?.[1]) return match[1];
  }

  return null;
}

function findPrimaryLink(card: HTMLElement): string | null {
  // If the card itself is an <a>
  if (card.tagName === "A" && (card as HTMLAnchorElement).href) {
    return (card as HTMLAnchorElement).href;
  }

  const a = card.querySelector<HTMLAnchorElement>("a[href]");
  return a?.href || null;
}

function scrapeCardTitle(card: HTMLElement): string {
  // Try common title patterns
  const titleEl =
    card.querySelector("[class*='title'], [class*='name'], [class*='Title'], [class*='Name'], h2, h3, h4") as HTMLElement | null;

  if (titleEl?.textContent?.trim()) {
    return titleEl.textContent.trim().slice(0, 200);
  }

  // Fall back to img alt text
  const img = card.querySelector<HTMLImageElement>("img[alt]");
  if (img?.alt?.trim()) return img.alt.trim().slice(0, 200);

  // Fall back to link text
  const a = card.querySelector<HTMLAnchorElement>("a");
  if (a?.textContent?.trim()) return a.textContent.trim().slice(0, 200);

  return "";
}

/**
 * Lightweight category detection from card text only.
 * Reuses the same keyword patterns as productExtract.ts but scoped to card content.
 */
function detectCardCategory(card: HTMLElement): string | undefined {
  const text = (card.textContent || "").toLowerCase();
  const imgAlt = (card.querySelector<HTMLImageElement>("img")?.alt || "").toLowerCase();
  const combined = text + " " + imgAlt;

  // Simplified category patterns (most specific first)
  const patterns: [RegExp, string][] = [
    [/\b(ring|rings)\b/, "ring"],
    [/\b(bracelet|bangle|watch|watches)\b/, "bracelet"],
    [/\b(necklace|pendant|chain|choker)\b/, "necklace"],
    [/\b(earring|earrings|studs|hoops)\b/, "earring"],
    [/\b(glasses|sunglasses|eyewear)\b/, "glasses"],
    [/\b(hat|cap|beanie)\b/, "hat"],
    [/\b(shirt|blouse|top|t.shirt|hoodie|sweater|jacket|coat|blazer)\b/, "top"],
    [/\b(dress|gown|jumpsuit)\b/, "dress"],
    [/\b(pants|trousers|jeans|shorts|skirt|leggings)\b/, "bottom"],
    [/\b(shoe|shoes|sneakers|boots|sandals|heels)\b/, "shoes"],
    [/\b(bag|handbag|purse|backpack|tote)\b/, "bag"],
  ];

  for (const [regex, category] of patterns) {
    if (regex.test(combined)) return category;
  }

  return undefined;
}
