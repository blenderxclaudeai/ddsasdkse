

## Revised Plan: Fix Variant Modal, Coupons, Add-to-Cart, Image Extraction + Tab Auto-Close

All items below are under the existing "Debug and stabilize retailer cart regressions" requirement.

---

### 1. Remove free text inputs from variant modal
**File:** `CartifyApp.tsx`
- Delete the `<input type="text">` fields for size and color
- Users can only click the extracted chip options
- If no variants extracted, show "No options found" and allow proceeding

### 2. Accumulate coupons by domain across session
**File:** `background/index.ts`, `CartifyApp.tsx`
- Change storage from single `cartify_active_coupons` array to `cartify_coupons_by_domain` map (`Record<string, coupon[]>`)
- Navigating to a new store adds that store's coupons without erasing previous ones
- UI groups coupons by retailer domain

### 3. Add potential savings calculator
**File:** `CartifyApp.tsx`
- Show "Potential savings" summary below coupons
- For each domain: pick best discount coupon, calculate savings on subtotal
- Free shipping coupons shown as combinable with discount codes

### 4. Fix add-to-cart timing
**File:** `background/index.ts`, `manifest.json`
- After `chrome.tabs.create`, use `chrome.scripting.executeScript` to inject content script programmatically (not just rely on manifest)
- Add `"scripting"` permission to manifest
- Longer initial delay (2s) before first attempt, then 3 retries at 1.5s

### 5. Auto-close retailer tabs after add-to-cart (ADDED)
**File:** `background/index.ts`
- After successful `CARTIFY_ADD_TO_RETAILER_CART` response (`ok: true`), wait 2 seconds then call `chrome.tabs.remove(tabId)` with try/catch
- Verify the pending cart array is properly cleaned up after tab close
- Also close tabs opened for variant extraction after extraction completes

### 6. Fix Ellos image extraction
**File:** `productExtract.ts`
- Add selectors: `[class*='ProductImage'] img`, `img[data-src]`, `img[data-lazy-src]`
- Check `dataset.src` / `dataset.lazySrc` when `img.src` is empty or a placeholder
- Handle `loading="lazy"` pattern

---

### Files changed

| File | Changes |
|------|---------|
| `extension/src/shared/CartifyApp.tsx` | Remove free text inputs; coupon grouping by domain; savings calculator |
| `extension/src/background/index.ts` | Coupon storage by domain; scripting injection for add-to-cart; tab auto-close after add-to-cart and variant extraction |
| `extension/src/content/productExtract.ts` | Ellos-specific image selectors, `data-src` handling |
| `extension/manifest.json` | Add `scripting` permission |

