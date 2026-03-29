## ✅ Implemented: Coupons, Variants, Price Detection — Bulletproof

All items from the approved plan have been implemented.

### Changes Made

1. **Coupon Discovery** — Google search scraping added as free Tier 2 before AI fallback
2. **Variant Extraction at Add-to-Cart** — Variants extracted immediately when user adds to cart, stored in chrome.storage
3. **Bulletproof Variant Selectors** — Removed bare selectors, added universal fallback (select/radiogroup/fieldset detection with label inference)
4. **Price Detection** — Added product-area-restricted selectors, nested testid patterns
5. **Pre-stored Variants in UI** — CartifyApp checks chrome.storage before falling back to background-tab extraction
