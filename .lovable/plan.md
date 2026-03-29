## ✅ Implemented: Coupons, Variants, Price Detection — Bulletproof

All items from the approved plan have been implemented.

### Changes Made

1. **Coupon Discovery** — Google search scraping added as free Tier 2 before AI fallback
2. **Strict Coupon Validation** — Codes must contain letters+digits (e.g. SAVE20) or be ≥5 uppercase letters; 500+ word blocklist filters garbage
3. **Variant Extraction at Product Page Visit** — Variants pre-extracted when user visits a product page (not at add-to-cart on listing pages where selectors don't exist)
4. **CARTIFY_STORE_VARIANTS** — New message type stores pre-extracted variants in chrome.storage.local
5. **Foreground Tab Fallback** — When no pre-stored variants exist, opens product page in visible (foreground) tab instead of unreliable background tab
6. **Listing Page Fix** — Removed useless extractVariants() call from handleCartClick on listing pages
