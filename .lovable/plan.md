

## Revised Plan: Inline Cartify Buttons on Product Listing Pages

### Architecture: Lightweight Scan, Smart on Click

The content script stays lightweight during page scan. It only identifies likely product card containers and places a small Cartify button. No product data extraction happens until the user clicks.

### User Flow

```text
Browse product grid
  → Cartify detects card-like containers (lightweight DOM scan)
  → Small Cartify icon appears on each card
  → User clicks icon on an interesting item
  → Extraction runs for that card only (image, title, URL, category)
  → If extraction is incomplete, fall back to navigating/fetching the product page URL
  → Try-on request fires in the background (no modal)
  → Toast confirms "Try-on queued!"
  → Result saved to showroom
  → User keeps browsing
```

---

### New File: `extension/src/content/productGrid.ts`

**`isListingPage(): boolean`**
- Checks URL patterns: `/collections/`, `/category/`, `/shop/`, `/search`, `/c/`, `/pl/`
- Checks for grid-like structures: 4+ elements matching broad card selectors
- Returns `true` if the page looks like a product listing

**`findCardContainers(): HTMLElement[]`**
- Returns raw DOM element references only — no data extraction
- Scans for common card patterns:
  - `[class*="product-card"]`, `[class*="product-item"]`, `[data-product-id]`, `[data-product]`
  - `article` elements inside grid containers
  - `<a>` tags containing `<img>` inside `[class*="grid"]` or list layouts
- Filters out containers smaller than 80x80px
- Returns the container elements, nothing else

**`extractFromCard(card: HTMLElement): ProductData | null`**
- Called only on click, not during scan
- Extracts from the clicked card: finds the primary `<img>` src, the `<a>` href, and text content for title
- Runs category detection using existing keyword patterns from `productExtract.ts`
- Returns `null` if insufficient data (no image found)

**`extractFallbackFromLink(card: HTMLElement): string | null`**
- If `extractFromCard` returns null, find the card's primary `<a>` href
- Returns the product page URL so the background can attempt a server-side or deferred extraction

---

### Changes to `extension/src/content/ui.ts`

**`injectCardButton(container: HTMLElement, onClick: () => void): HTMLElement`**
- Creates a 30px circular button with a small Cartify icon (SVG hanger or shirt outline)
- Positioned `absolute` top-right of the container (sets container to `position: relative` if not already)
- Visual states:
  - **Default**: semi-transparent (`opacity: 0.6`), full opacity on hover
  - **Loading**: spinning border animation
  - **Done**: green checkmark, reverts after 2s
  - **Error**: red X, reverts after 2s
- Uses a data attribute (`data-cartify-card-btn`) for easy cleanup

**`showToastNotification(message: string, type?: "success" | "error")`**
- Small fixed toast at bottom-left, auto-dismisses after 3s
- Non-blocking, does not interrupt browsing

**`removeAllCardButtons()`**
- Removes all injected card buttons (cleanup on navigation)

---

### Changes to `extension/src/content/index.ts`

Update `evaluatePage()` to add a listing-page branch:

1. **Product pages remain primary.** If `isProductPage()` returns true AND `isListingPage()` returns false, use the existing single-product flow (fixed "Try On" button + modal). No change to current behavior.

2. **Listing pages get card buttons.** If `isListingPage()` returns true AND the user is logged in:
   - Call `findCardContainers()` to get raw elements
   - For each container, call `injectCardButton(container, onClick)`
   - `onClick` handler: calls `extractFromCard(card)` at click time. If extraction succeeds, send `CARTIFY_TRYON_REQUEST` to background with `background: true` flag. If extraction fails, try `extractFallbackFromLink(card)` and send with the URL for server-side extraction. Show toast feedback.
   - Use `IntersectionObserver` to only inject buttons on cards visible in viewport
   - Extend the existing `MutationObserver` to detect new cards from infinite scroll — debounce with 500ms, re-run `findCardContainers()` for new elements only

3. **Mixed pages** (both product page and listing-like): Keep the product-page try-on flow as primary. Only add listing-card buttons if the page clearly has a product grid alongside the main product (e.g., "related products" sections). Do not automatically override the product-page experience.

4. **Cleanup**: On URL change, call `removeAllCardButtons()` alongside existing cleanup. Also track which containers already have buttons to avoid duplicates.

5. **Logged-out state**: On listing pages, show login pills on cards (or skip card buttons entirely and rely on the existing fixed login pill).

---

### Changes to `extension/src/background/index.ts`

Minimal changes to support concurrent inline requests:

- **`background` flag**: When `CARTIFY_TRYON_REQUEST` payload includes `background: true`, skip writing to `cartify_last_result` (only append to `cartify_recent_tryons`). This prevents multiple concurrent requests from overwriting each other.
- **Duplicate protection**: Before calling the edge function, check `cartify_recent_tryons` for a matching `product_url` submitted within the last 60 seconds. If found, return `{ ok: true, duplicate: true }` without re-requesting.
- The `cartify_recent_tryons` array and showroom save flow remain unchanged.

---

### What stays the same

- Inline Cartify buttons on product cards
- Background generation with no blocking modal
- Toast feedback on click
- Results saved to showroom via `cartify_recent_tryons`
- Infinite scroll handling via MutationObserver
- IntersectionObserver for performance
- Existing product-page "Try On" button (unchanged)

---

### Site support

The card detection uses broad CSS selectors and structural heuristics. This provides a reasonable first-pass across many e-commerce sites. When card extraction is incomplete (no image or URL found in the card DOM), the system falls back gracefully to the product page link for deferred extraction. Detection accuracy will improve iteratively as we encounter more site structures.

---

### Files Summary

| File | Change |
|------|--------|
| `extension/src/content/productGrid.ts` | **New** — `isListingPage()`, `findCardContainers()`, `extractFromCard()`, `extractFallbackFromLink()` |
| `extension/src/content/ui.ts` | Add `injectCardButton()`, `showToastNotification()`, `removeAllCardButtons()` |
| `extension/src/content/index.ts` | Add listing-page branch in `evaluatePage()`, IntersectionObserver + MutationObserver for cards |
| `extension/src/background/index.ts` | Add `background` flag handling, duplicate-click protection |

