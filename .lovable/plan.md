

## Rebrand to Cartify + Fix Extension + Auth Redirect Page

### 1. Rename VTO → Cartify everywhere

**Files to change:**
- `src/pages/LandingPage.tsx` — All "VTO" text in nav, hero, descriptions, footer → "Cartify"
- `src/components/ImpactCalculator.tsx` — Any "VTO" references in labels
- `extension/src/popup/Popup.tsx` — Login screen title "VTO" → "Cartify", tagline
- `extension/src/content/ui.ts` — Login pill text "Log in to VTO" → "Log in to Cartify", modal title "VTO Preview" → "Cartify Preview"
- `extension/src/content/webAppSync.ts` — Banner text
- `extension/manifest.json` — Extension name "VTO — Virtual Try-On" → "Cartify — Virtual Try-On"
- `extension/src/content/index.ts` — Console log prefixes `[VTO]`
- `extension/src/background/index.ts` — Console log prefixes `[VTO]`
- FAQ answers referencing "VTO"

### 2. Fix the OAuth redirect / 404 page

The user sees a 404 with a black banner when logging in. Two issues:
- `ProtectedRoute.tsx` still redirects to `/login` (deleted route) → change to redirect to `/`
- The `webAppSync.ts` shows an ugly black banner on whatever page loads after OAuth. Instead, create a proper `/auth/callback` route in `App.tsx` that renders a clean loading page with the Cartify branding and message: "You're being signed in. This page will close automatically."

**Files:**
- `src/components/ProtectedRoute.tsx` — Change `/login` redirects to `/`
- `src/App.tsx` — Add `/auth/callback` route pointing to a new `AuthCallback` page
- Create `src/pages/AuthCallback.tsx` — Clean, minimal page with Cartify logo, spinner, "You're being signed in. This page will close automatically." text. Matches the website's monochrome design.
- `extension/src/content/webAppSync.ts` — Remove the ugly black banner. Instead, let the AuthCallback page handle the UI.

### 3. Fix product image backgrounds

Some product PNGs have gray/transparent backgrounds. The cards already use `bg-background` (white) but the images themselves may have gray pixels. Add `mix-blend-mode: multiply` or simply ensure the container has an explicit white background and the image is rendered on top. If specific images still look gray, the issue is in the PNG files themselves — use `bg-white` on the image wrapper and consider adding a white backdrop filter.

**File:** `src/pages/LandingPage.tsx` — Add `bg-white` class directly to the image container divs in the marquee section.

### 4. Fix extension popup — sticky layout, no scrollbar

The current layout already has `shrink-0` on header/tabs/bottom-nav and `flex-1 overflow-y-auto` on content. The issue is the `popup.css` hides scrollbars globally on the extension BUT the overall popup may still scroll if content overflows. Fix:

- `extension/src/popup/Popup.tsx`:
  - The showroom screen content (title "Showroom" + subtitle) should be part of the sticky header area, not inside the scrollable div
  - Ensure the outer container has `overflow-hidden` (it does: `h-[560px] flex flex-col overflow-hidden`)
  - Move showroom header text outside the scrollable area into a `shrink-0` section
  
- `extension/src/popup/popup.css` — Already has scrollbar hiding. Verify it's applied to the scrollable content div.

### 5. Storage key renaming (optional but clean)

All chrome.storage keys use `vto_` prefix. Rename to `cartify_` for consistency:
- `extension/src/lib/auth.ts`
- `extension/src/popup/Popup.tsx`
- `extension/src/background/index.ts`
- `extension/src/content/webAppSync.ts`
- `extension/src/content/index.ts`

### Files summary

| File | Action |
|------|--------|
| `src/pages/LandingPage.tsx` | Rebrand VTO→Cartify, ensure `bg-white` on product cards |
| `src/components/ImpactCalculator.tsx` | Check for VTO references |
| `src/App.tsx` | Add `/auth/callback` route |
| `src/pages/AuthCallback.tsx` | **Create** — clean auth loading page |
| `src/pages/NotFound.tsx` | Update to use Cartify branding |
| `src/components/ProtectedRoute.tsx` | Change `/login` → `/` |
| `extension/src/popup/Popup.tsx` | Rebrand, fix showroom header sticky, rename storage keys |
| `extension/src/popup/popup.css` | Ensure scrollbar fully hidden |
| `extension/src/content/ui.ts` | Rebrand VTO→Cartify |
| `extension/src/content/webAppSync.ts` | Rebrand, remove black banner, point to `/auth/callback` |
| `extension/src/content/index.ts` | Rebrand log prefixes, rename storage keys |
| `extension/src/background/index.ts` | Rebrand, rename storage keys |
| `extension/src/lib/auth.ts` | Rename storage keys |
| `extension/manifest.json` | Rebrand name |

