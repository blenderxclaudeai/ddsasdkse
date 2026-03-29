

## What's Actually Broken — Root Cause Analysis

### 1. Coupons: Google Scraper Extracts Garbage Words

The screenshot proves it: "code", "auf", "first", "cookies", "Page", "welt" — these aren't coupon codes, they're random words from Google search snippets. The regex `(?:code|coupon)[:\s]+([A-Z0-9]{3,20})` matches text like "coupon **Code** for..." → captures "Code". The false-positive blocklist only has 18 words — way too small.

**Fix**: Two-part approach:
1. Much stricter code validation: a real coupon code must contain **both letters and digits** (e.g., "SAVE20", "FALL2024"), OR be a well-known pure-letter code pattern (≥5 chars). Single common words are never codes.
2. Expand blocklist massively: block all common English/Swedish/German words that appear in search snippets.
3. Scrape actual coupon aggregator pages instead of Google search (RetailMeNot, Honey-style sites) as a more reliable source.

### 2. Variants: Extracted on Listing Pages (Where They Don't Exist)

When the user is on a **listing page** and clicks the cart button on a product card, `handleCartClick` calls `extractVariants()` on the listing page DOM — but there are no size/color selectors on listing pages. Result: empty variants stored.

Later, the variant flow falls back to background-tab extraction, which fails on SPAs.

**Fix**: 
- **Product pages**: When `evaluatePage()` detects a product page + logged in, proactively extract variants right then (user is already on the page) and store them in `chrome.storage.local`.
- **Listing pages**: Don't attempt extraction. Instead, when the variant flow starts, open the product URL in a **visible** tab and extract variants after it loads. Or better: combine the variant modal with opening the retailer page — the user selects options on the actual retailer site.

### 3. Background Tab Variant Extraction Is Fundamentally Unreliable

SPAs don't hydrate in background tabs. The 3s wait + 3 retries doesn't help if the page never renders variant selectors. This is the core architectural problem.

**Fix**: When pre-stored variants are empty, open the product page in a **foreground** tab for extraction, then bring the extension panel back. This is more intrusive but actually works.

---

## Implementation Plan

### File 1: `supabase/functions/scrape-coupons/index.ts`
- Replace `extractCouponsFromSearchHtml` with much stricter validation:
  - Codes must be ≥4 chars AND contain at least one digit (e.g., "SAVE20") OR be ≥6 uppercase letters (brand codes like "WELCOME")
  - Massive expanded blocklist: ~100+ common English words ("code", "find", "first", "page", "cookies", "germany", "measure", "check", etc.)
  - Deduplicate case-insensitively
- Add Tier 2 alternative: fetch actual coupon aggregator pages (e.g., `https://www.retailmenot.com/view/{domain}`) and parse coupon codes from their structured HTML, which is far more reliable than Google snippets

### File 2: `extension/src/content/index.ts`
- In `evaluatePage()`, when on a product page + logged in, after `storeDetectedProduct()`, also call `extractVariants()` and send variants to background for storage: `chrome.runtime.sendMessage({ type: "CARTIFY_STORE_VARIANTS", ... })`
- In `handleCartClick` (listing page cart button), do NOT call `extractVariants()` — it's useless on listing pages. Remove the `extractVariants()` call from there.

### File 3: `extension/src/background/index.ts`
- Add handler for `CARTIFY_STORE_VARIANTS` — stores variants keyed by product URL
- In `CARTIFY_EXTRACT_VARIANTS` handler, when background tab extraction returns empty, try opening a **foreground** tab instead with `active: true` and retry extraction

### File 4: `extension/src/content/productExtract.ts`
- No major changes needed — the selectors are already scoped. The problem was timing/context, not selector quality.

---

### Files changed

| File | Changes |
|------|---------|
| `supabase/functions/scrape-coupons/index.ts` | Strict code validation, expanded blocklist, aggregator scraping |
| `extension/src/content/index.ts` | Pre-extract variants on product pages, remove useless listing-page extraction |
| `extension/src/background/index.ts` | Add CARTIFY_STORE_VARIANTS handler, foreground tab fallback |

