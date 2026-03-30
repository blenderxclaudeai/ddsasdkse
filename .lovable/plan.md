

## Simplify Cartify: Pure Virtual Try-On Tool

Strip away all shopping assistant features and focus exclusively on the try-on experience.

---

### What Gets Removed

**Extension UI (CartifyApp.tsx) — massive cleanup:**
- **Session screen** — the entire "Shopping Session" tab with item grid, cart toggles, remove buttons, session summary bar, cart totals, price parsing, currency detection
- **Coupon system** — `couponsByDomain` state, coupon banner UI, coupon expansion, `CARTIFY_CHECK_COUPONS` messaging
- **Variant selection flow** — the entire variant modal overlay, `variantFlow`/`variantSelections`/`extractedVariants` state, `startVariantFlow`, `fetchVariantsForItem`, `handleVariantNext`, `advanceVariantFlow`, `clearCartAfterAdd`
- **Add-to-retailer-cart** — `handleAddToRetailerCart`, `handleToggleCart`, `handleRemoveSessionItem`
- **Session summary footer bar** with cart count and "Add to cart" button
- **Session tab in bottom nav** — replaced with try-on results as the home screen

**Extension content script (index.ts):**
- **Cart button injection** on listing pages (`injectCartButton`, `handleCartClick`, `CART_BTN_ATTR`)
- **Coupon check** (`CARTIFY_CHECK_COUPONS` message in `evaluatePage`)
- **Variant pre-extraction** (`preExtractAndStoreVariants`)
- **Retailer cart automation** (`tryAddToRetailerCart`, `trySelectVariant`, `findRetailerCartAction`, all `RETAILER_CART_*` selectors)

**Extension UI (ui.ts):**
- `injectCartButton`, `setCartButtonDone`, `CART_SVG`, `CART_BTN_ATTR` — remove cart button injection

**Background script (background/index.ts):**
- **Shopping sessions** — `ensureSession`, `addSessionItem`, `touchSessionState`, `updateCartBadge`, session-related storage listeners
- **Coupon handling** — `CARTIFY_CHECK_COUPONS` handler, coupon storage
- **Add-to-retailer-cart** — `handleAddToRetailerCart`, `openRetailerTabWithVariant`, `cartify_pending_retailer_carts`, `tabs.onUpdated` handler
- **Variant storage** — `CARTIFY_STORE_VARIANTS`, `CARTIFY_EXTRACT_VARIANTS` handlers
- **Cart badge** — `updateCartBadge` and related listeners
- `CARTIFY_ADD_TO_CART`, `CARTIFY_SAVE_PRODUCT` handlers

**Edge functions:**
- `scrape-coupons/` — delete entirely
- `admin-cashback/` — delete entirely (cashback is shopping assistant)
- `cleanup-daily/` — delete entirely (cleaned up sessions)

**Web app pages:**
- `AdminPage.tsx` — remove (was for cashback/coupon admin)
- Admin route in `App.tsx`

**Extension manifest:**
- Remove `scripting` permission (no longer injecting scripts for cart automation)

---

### What Stays and Gets Optimized

**Core try-on flow (keep as-is):**
- Product detection on pages (JSON-LD, OG tags, heuristics)
- "Try On" hanger button on listing page cards
- Try-on modal with result display
- `tryon-request` edge function
- `redirect` edge function (for affiliate "View item" links)

**Extension UI — simplified to 2 screens:**
1. **Showroom (home)** — gallery of try-on results with "View item" (affiliate link) + download + share
2. **Profile** — photo uploads for try-on

**Showroom "Add to Cart" button → "View Item":**
- Replace the current "Add to Cart" overlay button on showroom results with "View Item" that opens the affiliate link directly (already have `getAffiliateUrl` logic via redirect function)

**Bottom nav — 2 tabs:**
- Showroom (grid icon) — default/home
- Profile (user icon)
- Settings accessible via gear icon in header (already exists)

---

### Files Changed

| File | Action |
|------|--------|
| `extension/src/shared/CartifyApp.tsx` | Major rewrite: remove session screen, coupons, variants, cart logic. Keep showroom + profile + settings. Default to showroom. Replace "Add to Cart" with "View Item" |
| `extension/src/background/index.ts` | Remove session/cart/coupon/variant handlers. Keep auth + try-on + display mode |
| `extension/src/content/index.ts` | Remove cart button, coupon check, variant pre-extraction, retailer cart automation. Keep product detection + try-on button |
| `extension/src/content/ui.ts` | Remove `injectCartButton`, `setCartButtonDone`, cart-related exports |
| `extension/src/content/productExtract.ts` | Remove variant extraction functions (`extractVariants`, `waitForVariantElements`, etc.). Keep product metadata extraction |
| `extension/src/content/productGrid.ts` | Keep listing page card detection; remove cart-related exports if any |
| `extension/src/lib/types.ts` | Remove cart/coupon/variant message types |
| `extension/manifest.json` | Remove `scripting` permission |
| `src/App.tsx` | Remove admin route |
| `src/pages/Showroom.tsx` | Replace "Add to Cart" with "View Item" |
| `supabase/functions/scrape-coupons/` | Delete |
| `supabase/functions/admin-cashback/` | Delete |
| `supabase/functions/cleanup-daily/` | Delete |

