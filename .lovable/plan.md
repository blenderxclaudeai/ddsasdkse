

## Plan: Remove Pending Product Banner + Fix Cart Issues

### Issues Identified

1. **Pending product banner still showing** (lines 639-661 in `CartifyApp.tsx`): The old product detection banner with "Try On" button is still rendered. Now that inline card buttons exist, this is redundant. Remove it entirely.

2. **Cart total uses hardcoded `$`**: The cart summary section (line 762) shows `~$` instead of using the detected `currencySymbol`. The session total bar (line 1077) correctly uses `currencySymbol` but the cart sub-summary does not.

3. **Cart adding stopped working**: The shopping session for this user was created on March 6 and expires March 7 at 23:41 UTC. Once expired, `ensureSession()` tries to create a new session — but the old one still has `is_active=true`. The creation should work, but there may be a token refresh issue causing silent auth failures. Fix: add error logging to `addSessionItem` responses and ensure `ensureSession` marks old expired sessions as inactive before creating new ones.

### Changes

**`extension/src/shared/CartifyApp.tsx`:**
- Remove the entire pending product banner block (lines 639-661) and the `pendingProduct` state + storage listener
- Fix cart summary to use `currencySymbol` instead of hardcoded `$`

**`extension/src/background/index.ts`:**
- In `ensureSession()`, before creating a new session, mark any expired sessions as `is_active=false` via a PATCH call
- Add response status checking to `addSessionItem` POST/PATCH calls so errors are logged instead of silently swallowed

### Files

| File | Change |
|------|--------|
| `extension/src/shared/CartifyApp.tsx` | Remove pending product banner, fix cart currency symbol |
| `extension/src/background/index.ts` | Fix `ensureSession` to deactivate expired sessions, add error logging |

