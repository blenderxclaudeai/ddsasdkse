

## Deep Analysis: Why Things Keep Breaking and What to Do About It

### The Three Core Problems

---

### Problem 1: Coupon Scraping — Google Blocks Server Requests

The edge function fetches `google.com/search?q=...` from a Deno server. Google detects this is not a browser and returns either a CAPTCHA page, a 429, or stripped-down HTML with no real snippets. Even with a spoofed User-Agent, Google's anti-bot detection is far more sophisticated. The regex patterns and blocklist are fine — the input HTML is garbage.

**The opportunity**: This project has Firecrawl available as a connector. Firecrawl is literally built to solve this — it handles anti-bot measures, renders JavaScript, and returns clean content. Instead of fighting Google's bot detection, use Firecrawl's search API to find coupon codes reliably.

**Plan**:
- Connect Firecrawl connector
- Replace the raw `fetch(google.com/search...)` in `scrape-coupons/index.ts` with a Firecrawl search call: `POST https://api.firecrawl.dev/v1/search` with query `"{domain} coupon code 2026"`
- Firecrawl returns actual page content that the existing regex extraction can work on
- Keep AI as Tier 3 fallback
- Keep all existing validation (blocklist + `isValidCouponCode`) — those are solid

---

### Problem 2: Variant Extraction — The Flow Is Backwards

The current flow:
```text
User on listing page → clicks "Add to Cart" on card
→ Item saved to session (NO variants — listing pages don't have them)
→ Later clicks "Add all to retailer cart"
→ Variant modal opens → tries to find pre-stored variants → EMPTY
→ Falls back: opens foreground tab → waits 3s → extracts → closes tab
→ User selects variants in modal → THEN opens product page AGAIN to click "Add to Cart"
```

This opens the product page TWICE — once to extract variants, once to click add-to-cart. It's slow, disruptive, and the extraction often fails because the first tab is closed before hydration completes.

**The opportunity**: Merge variant extraction and add-to-cart into ONE tab visit. The retailer page is already being opened to click "Add to Cart" — extract variants from THAT page, show selection, then click add-to-cart on the same tab.

**New flow**:
```text
User clicks "Add all to retailer cart"
→ For each item (sequentially):
  1. Open product page in foreground tab
  2. Wait for hydration → extract variants
  3. If variants found: show selection modal in side panel (tab stays open)
  4. User picks size/color → extension selects on the live page → clicks "Add to Cart"
  5. Close tab after 2s → move to next item
```

This is ONE tab visit per item instead of two, and variants are extracted from a live, hydrated page — guaranteed to work.

**Implementation**:
- Move the variant extraction + selection INTO the `handleAddToRetailerCart` flow in `background/index.ts`
- After the product tab loads and content script is injected, send `CARTIFY_EXTRACT_VARIANTS` to that tab
- If variants are found, store them and notify the UI (via `chrome.storage`) to show the selection modal
- UI waits for user selection, then sends `CARTIFY_ADD_TO_RETAILER_CART` with the variant to the same tab
- Remove the separate `startVariantFlow` / `fetchVariantsForItem` / pre-extraction — no longer needed

---

### Problem 3: Variant Selectors Miss Real UI Elements

The compound selectors like `[class*='size' i][class*='selector' i]` are too specific for many stores. H&M uses `[data-testid="size-selector"]`, Zara uses custom web components, ASOS uses `[data-id="sizeSelect"]`. The universal fallback (`select`, `radiogroup`, `fieldset`) is good but the label inference (`inferLabelFor`) often can't match because stores use non-standard labeling.

**The opportunity**: Instead of trying to enumerate every store's class names, use a simpler heuristic: find ALL interactive elements (select, button groups, radio groups) in the product area, and classify them by their visual label text. If a heading/label near a group says "Size" or "Storlek" or "Taille", it's sizes. This is what the universal fallback attempts, but it should be the PRIMARY strategy, not the last resort.

**Implementation**:
- Make `extractUniversalFallback` the FIRST DOM extraction method (after JSON-LD)
- Expand `inferLabelFor` to also check: grandparent headings, `aria-labelledby`, `data-testid` attributes containing size/color keywords, and the closest heading (`h1`-`h6`) or `span` with font-weight > 500
- Add more label keywords per language: "Größe", "Talla", "Maat" (Dutch), "Storlek"

---

### Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/scrape-coupons/index.ts` | Replace Google fetch with Firecrawl search API call |
| `extension/src/background/index.ts` | Merge variant extraction into add-to-retailer-cart flow (one tab visit) |
| `extension/src/shared/CartifyApp.tsx` | Remove pre-flow variant modal; add inline variant selection during add-to-cart |
| `extension/src/content/productExtract.ts` | Promote universal fallback to primary strategy, expand label inference |
| `extension/src/content/index.ts` | Remove `preExtractAndStoreVariants` (no longer needed) |

### Prerequisites
- Connect Firecrawl connector for reliable coupon search

