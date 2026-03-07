

## Plan: Fix Cart Silent Failures + Stale Auth State

### Root Cause

The auth logs confirm **"Refresh Token Not Found"** — the stored refresh token is permanently invalid (revoked or rotated by the backend). Two bugs stem from this:

**1. "Sign in" shown despite being logged in:**
`getAuthState()` detects the expired access token, tries `refreshToken()`, it fails (invalid refresh token), returns `loggedIn: false`. This is actually *correct* — the session is dead. But the stale tokens remain in storage, so the extension never shows a clean login state. The user needs to re-authenticate but doesn't get a clear prompt.

**Fix:** When `refreshToken()` fails, clear all stale auth data from storage so the extension shows the login screen cleanly. This forces a proper re-login flow.

**2. Cart shows green checkmark but nothing saves:**
The `CARTIFY_ADD_TO_CART` handler calls `addSessionItem()` but responds `{ok: true}` **immediately** without waiting for the result. The content script sees `ok: true` and plays the green animation, but `addSessionItem` silently fails because `getAuthHeaders()` returns null (dead session).

**Fix:** Make `addSessionItem` return a boolean. Propagate it to `sendResponse` so the content script only shows success when the item was actually saved.

### Changes

**`extension/src/background/index.ts`:**

1. **`refreshToken()`** — on failure (invalid refresh token), clear all stale auth data:
   ```ts
   if (!res.ok) {
     // Refresh token is dead — clear stale auth to force re-login
     await chrome.storage.local.remove(["cartify_auth_token", "cartify_refresh_token", "cartify_user"]);
     return false;
   }
   ```

2. **`addSessionItem()`** — return `boolean` indicating success/failure instead of `void`

3. **`CARTIFY_ADD_TO_CART` handler** — await the result and respond accordingly:
   ```ts
   addSessionItem(msg.payload, "cart", true).then((ok) => {
     sendResponse({ ok });
   });
   ```

4. **`CARTIFY_SAVE_PRODUCT` handler** — same fix

### Files

| File | Change |
|------|--------|
| `extension/src/background/index.ts` | Fix `refreshToken` to clear stale creds on failure; make `addSessionItem` return boolean; fix cart/save handlers to propagate success/failure |

No DB or UI changes needed. After this fix, when the refresh token is dead, the extension will cleanly show the login screen, and the cart button will show an error instead of a false success.

