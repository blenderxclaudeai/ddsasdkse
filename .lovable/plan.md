

## Problem

The extension popup (`extension/src/popup/Popup.tsx`) renders an email/password login form (image-6), but the project only supports Google and Apple OAuth (image-7). The popup auth should not have its own login form — it should direct users to the web app to sign in via OAuth, then sync the session back.

## Why email/password won't work

Chrome extension popups cannot handle OAuth redirects. The `lovable.auth.signInWithOAuth()` flow redirects the browser, which closes the popup. The correct pattern is:

1. User signs in via the **web app** (Google/Apple OAuth)
2. The extension detects the session (already implemented via `chrome.storage.local` token sync)
3. The popup shows logged-in state

## Plan

### 1. Redesign the logged-out popup state

Replace the email/password form in `Popup.tsx` with:
- VTO header + "Try before you buy" tagline (matching web app style)
- A single **"Sign in on VTO"** button that opens the web app login page in a new tab (`chrome.tabs.create({ url: ... })`)
- Disclosure text at the bottom

Remove `email`, `password`, `authMode`, `authError` state and the `handleAuth` function entirely.

### 2. Keep the logged-in state as-is

The authenticated view (showroom link, recent try-ons, sign out) is already correct and stays unchanged.

### Technical detail

- The "Sign in" button calls `chrome.tabs.create({ url: "${APP_URL}/login" })` to open the web app
- Once the user completes OAuth on the web app, the existing `onAuthStateChange` listener in the popup will pick up the session on next popup open
- The extension's `supabase` client will detect the session if the user has already logged in on the web app domain

