

## Why "Authorization page could not be loaded"

The error occurs because of how `chrome.identity.launchWebAuthFlow` works. It requires the OAuth provider's redirect URI to match `chrome.identity.getRedirectURL()` — but the **Supabase OAuth flow** redirects to Supabase's own callback (`/auth/v1/callback`) first, which then redirects to the `redirectTo` URL. This intermediate redirect breaks `launchWebAuthFlow` because Supabase's callback page isn't a simple redirect — it's an HTML page that processes tokens.

Additionally, the Lovable Cloud managed OAuth is configured for the **web app domain** (e.g., `ddsasdkse.lovable.app`), not for Chrome extension redirect URIs (`https://<extension-id>.chromiumapp.org/...`). Google's OAuth client won't accept this redirect URI since it's not registered.

## The core problem

`chrome.identity.launchWebAuthFlow` + Supabase OAuth is fundamentally incompatible because:
1. Supabase's `/auth/v1/callback` is an intermediate HTML page, not a direct redirect
2. The Lovable Cloud managed Google/Apple OAuth credentials only allow the web app domain as a redirect URI, not `chromiumapp.org`
3. You cannot register `chromiumapp.org` redirect URIs without your own Google OAuth client credentials

## Solution: Use the web app login + token sync

The only reliable approach for Lovable Cloud OAuth in a Chrome extension is:

1. **Open the web app login page** in a new tab (not `launchWebAuthFlow`)
2. User completes Google/Apple OAuth on the web app (which works perfectly)
3. **Sync the session back** to the extension via a messaging mechanism

### Implementation plan

### 1. Replace `signInWithOAuth` in `extension/src/lib/auth.ts`
- Remove `chrome.identity.launchWebAuthFlow` entirely
- `signInWithOAuth()` opens `chrome.tabs.create({ url: APP_URL + "/login" })`
- Add a **content script listener** on the web app domain that detects successful login and sends the session tokens back to the extension via `chrome.runtime.sendMessage`

### 2. Add a small content script snippet for the web app domain
- In `extension/src/content/index.ts` (or a separate script), when on the VTO web app domain, check for a Supabase session
- On detecting a valid session, send `{ type: "VTO_SESSION_FROM_WEB", session }` to the background
- Background persists it to `chrome.storage.local`

### 3. Background listener in `extension/src/background/index.ts`
- Listen for `VTO_SESSION_FROM_WEB` messages
- Persist `access_token`, `refresh_token`, `user` to `chrome.storage.local`
- This triggers `chrome.storage.onChanged` in the popup, updating UI to logged-in state

### 4. Update Popup UI
- Logged-out screen: Show "Continue with Google" / "Continue with Apple" buttons
- On click: open web app login page in new tab, show "Completing sign-in..." state
- Listen to `chrome.storage.onChanged` for `vto_auth_token` — when it appears, switch to Profile screen
- Remove the error-prone `authError` display for `launchWebAuthFlow` failures

### 5. Content script on web app domain
- After successful OAuth on the web app, the content script reads the Supabase session from localStorage
- Sends it to the background script
- The login tab can optionally auto-close

### Technical detail

```text
User clicks "Continue with Google" in popup
  → chrome.tabs.create({ url: "https://ddsasdkse.lovable.app/login" })
  → User completes OAuth on web app (works perfectly with managed credentials)
  → Content script on web app detects session in localStorage
  → chrome.runtime.sendMessage({ type: "VTO_SESSION_FROM_WEB", ... })
  → Background persists to chrome.storage.local
  → Popup detects storage change → shows Profile screen
```

This approach uses the working web OAuth flow and avoids the `launchWebAuthFlow` incompatibility entirely. The UX is: click button → new tab opens → sign in → tab closes → popup is logged in.

