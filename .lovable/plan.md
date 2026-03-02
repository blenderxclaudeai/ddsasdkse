

## Problem

The `tryon-request` edge function is **still crashing** with `SyntaxError: Identifier 'wearableCategories' has already been declared`. The file in the repo is correct (duplicates were removed), but the **deployed version** still has the old buggy code — the previous deployment either failed silently or used a stale cache.

## Fix

**Redeploy `tryon-request`** — no code changes needed. The file is already correct. Just need to force a fresh deployment of the edge function.

