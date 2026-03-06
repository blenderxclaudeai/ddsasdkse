

## Fix List: Login, Product Focus, Extension Polish

### 1. Fix login flow — the /login 404 issue

The screenshot shows `/login` returning a 404. The OAuth redirect URL in `extension/src/lib/auth.ts` uses `chrome.identity.getRedirectURL()` which should work for the extension flow. However, the `webAppSync.ts` content script still sends `VTO_SESSION_FROM_WEB` — this suggests the OAuth flow is opening a browser tab to the website instead of using `chrome.identity`. 

**Root cause:** The `chrome.identity.launchWebAuthFlow` redirect URL (`chrome.identity.getRedirectURL()`) must be registered in the backend's OAuth redirect allowlist. If it's not, the provider may fall back to a web redirect. Also, the `redirect_to` parameter in the auth URL needs to match the extension's redirect URL pattern exactly.

**Fix:** Ensure the auth URL includes the correct `redirect_to` for chrome.identity. The current code looks correct — the issue is likely on the backend OAuth config side. We need to verify the redirect URL is whitelisted. But from the code side, the flow should work. The `/login` 404 happens because the old OAuth config redirects to `/login`. We should add `/login` as a catch-all redirect to `/` in `App.tsx` so users never see a 404 there.

**Files:** `src/App.tsx` — add a redirect from `/login` to `/`

### 2. Remove non-person categories from extension

Remove Home, Pets, Vehicle, Garden from `CATEGORY_GROUPS` in `Popup.tsx`. Keep only "You". Remove the tab bar entirely since there's only one group.

**File:** `extension/src/popup/Popup.tsx`

### 3. Update "Try on anything" section — remove home/garden products

Remove: Lamps, Chairs, Vases, Planters, Cushions from both `tryOnCategories` and `tryOnCategories2`. Keep only wearable/person items. The remaining person-focused items with white backgrounds: Dress, Sneakers, Watch, Sunglasses, Handbag, Ring, Jacket, Hat, Boots, Necklace, Blazer, Bracelet, Jeans, Heels.

Update the section subtitle to remove "home decor, garden" language.

Update the FAQ answer about "What kind of products can I try on?" to remove home decor mention.

**File:** `src/pages/LandingPage.tsx`

### 4. Fix content script login pill text

Change "Log in to Cartify to try on" → "Log in" (shorter, cleaner).

**File:** `extension/src/content/ui.ts`

### 5. Add Settings screen to extension

Add a third screen "settings" accessible from the header (gear icon next to Sign Out). Settings page includes:
- **Display mode**: Radio/toggle between "Popup" and "Side Panel" — stores preference in `chrome.storage.local` as `cartify_display_mode`
- Sign Out button moved here

**File:** `extension/src/popup/Popup.tsx`

### 6. Remaining VTO references

`webAppSync.ts` still uses `VTO_SESSION_FROM_WEB` message type and `background/index.ts` listens for it. Rename to `CARTIFY_SESSION_FROM_WEB` for consistency.

**Files:** `extension/src/content/webAppSync.ts`, `extension/src/background/index.ts`

### Files summary

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/login` redirect to `/` |
| `src/pages/LandingPage.tsx` | Remove lamp/chair/vase/planter/cushion, update subtitle & FAQ |
| `extension/src/popup/Popup.tsx` | Remove non-You categories, remove tab bar, add Settings screen with display mode toggle |
| `extension/src/content/ui.ts` | Shorten login pill text to "Log in" |
| `extension/src/content/webAppSync.ts` | Rename VTO_ message types to CARTIFY_ |
| `extension/src/background/index.ts` | Rename VTO_ message types to CARTIFY_ |

