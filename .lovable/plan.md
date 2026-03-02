

## Bug: Edge Function Boot Failure

The `tryon-request` function is crashing on startup with `Identifier 'wearableCategories' has already been declared` because the two-step pipeline implementation added a second `const wearableCategories` (line 220) and `const roomCategories` (line 221) when they were already declared at lines 127-128.

Similarly, `promptMode` is declared at line 129 and again at line 297.

## Fix

**File:** `supabase/functions/tryon-request/index.ts`

1. **Remove the duplicate declarations at lines 220-221** — the `wearableCategories` and `roomCategories` sets already exist from line 127-128. Just use the existing variables.
2. **Remove the duplicate `promptMode` at line 297** — rename it or reuse the one from line 129. Since the value is identical, just drop the redeclaration.
3. **Rename `cat` at line 222** or use `effectiveCategory` directly, since that's what the earlier block already references.

Essentially: lines 218-222 and 297-299 need to reference the already-declared variables instead of re-declaring them. Then redeploy.

