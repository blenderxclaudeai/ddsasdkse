

## Issues Identified

1. **Try On button not appearing after login**: The `webAppSync.ts` content script checks for `sb-*-auth-token` in localStorage, but `@lovable.dev/cloud-auth-js` may store the session under a different key. Also, the script sends the session to background, but the content script on retailer pages checks auth via `VTO_GET_AUTH` message -- this part looks correct, so the issue is likely in `webAppSync.ts` not finding the session key.

2. **Try-on only uses `full_body` photo**: The edge function hardcodes `category = "full_body"`. It needs to accept a `category` param from the content script and match the product type to the correct profile photo (e.g., ring -> fingers, necklace -> upper_body).

3. **No "missing photo" error handling**: If the user hasn't uploaded the matching photo category, the try-on silently falls back to a generic model instead of telling the user which photo they need.

4. **Emojis in UI**: `"Try On"` button has sparkle emoji, login pill has lock emoji, showroom empty state has sparkle emoji, "Add to Cart" has cart emoji, and there's a duplicate `const initial` line causing a build error.

5. **Duplicate variable in Popup.tsx**: Line 361-362 has `const initial = ...` declared twice -- this will cause a build error.

## Plan

### 1. Fix `webAppSync.ts` session detection
The Lovable auth module may not use standard `sb-*-auth-token` localStorage keys. Add fallback detection: also look for any key containing `supabase` or `auth-token`, and also listen to `onAuthStateChange`-style events by polling more aggressively. Additionally, the `@lovable.dev/cloud-auth-js` module stores auth differently -- read the actual localStorage keys after OAuth completes.

### 2. Fix content script `content/index.ts` -- add product category detection
Extend `extractProduct()` to detect the product category (clothing, ring, glasses, furniture, etc.) using page signals like JSON-LD product type, title keywords, and meta tags. Pass the category to the background try-on request.

### 3. Update `tryon-request` edge function
- Accept a `category` parameter from the request body
- Map category to the correct profile photo (e.g., `ring` -> `fingers`, `glasses` -> `face`, `shirt` -> `upper_body`, `sofa` -> `living_room`)
- If no matching photo exists, return a clear error: `"Please upload a photo of your [hands/face/etc.] in your VTO profile to try on this product"`

### 4. Remove all emojis from UI
- `ui.ts`: Remove sparkle from "Try On" button, lock from login pill
- `Popup.tsx`: Remove sparkle from showroom empty state, cart emoji from "Add to Cart"
- Fix the duplicate `const initial` line

### 5. Update `productExtract.ts` to detect product category
Add heuristics to determine what kind of product is on the page (jewelry, clothing, home decor, etc.) and include it in the `ProductData` type.

### 6. Update error handling in content script modal
- Show specific error messages when a profile photo is missing
- Show a link/instruction to open the extension popup and upload the required photo

## Files to change

- **`extension/src/content/webAppSync.ts`** -- fix session key detection
- **`extension/src/content/ui.ts`** -- remove emojis, improve error messages
- **`extension/src/content/productExtract.ts`** -- add category detection
- **`extension/src/lib/types.ts`** -- add `category` field to `ProductData`
- **`extension/src/content/index.ts`** -- pass category to try-on request
- **`extension/src/background/index.ts`** -- pass category to edge function
- **`extension/src/popup/Popup.tsx`** -- remove emojis, fix duplicate variable
- **`supabase/functions/tryon-request/index.ts`** -- accept category, map to correct profile photo, return missing-photo error
- **`src/pages/Showroom.tsx`** -- remove emojis if any

