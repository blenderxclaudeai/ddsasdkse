

## Problem

The fallback model `google/gemini-2.5-flash` doesn't support image generation (404 error). The primary model `google/gemini-3-pro-image-preview` sometimes fails silently (reasons correctly but returns null content).

## Fix

### `supabase/functions/tryon-request/index.ts`

Change the models array to retry the **same top-tier model** twice instead of falling back to a weaker model:

```typescript
const models = ["google/gemini-3-pro-image-preview", "google/gemini-3-pro-image-preview"];
```

This retries the best available image generation model on failure, since the issue is intermittent (the model reasons correctly but sometimes fails to produce output). A second attempt often succeeds.

### File to change
- `supabase/functions/tryon-request/index.ts` — line 174, change `"google/gemini-2.5-flash"` to `"google/gemini-3-pro-image-preview"`

