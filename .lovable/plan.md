

## Fix: Step 2 Silent Failure — Add Diagnostics + Fallback Model

### Problem
The logs show:
- Step 1 success ✓ (product extracted to clean image)
- Step 2 attempt 1: no image, Refusal: null ✗
- Step 2 attempt 2: no image, Refusal: null ✗

The model returns a 200 OK but produces no image. We have no visibility into what it *does* return, and no fallback.

### Changes — `supabase/functions/tryon-request/index.ts`

1. **Add response logging** — After parsing the AI response in Step 2, log the actual response structure (content types, text content if any) so we can diagnose *why* there's no image. This is critical for debugging.

2. **Fallback to `google/gemini-2.5-flash` on attempt 2** — If the first attempt with `gemini-3-pro-image-preview` returns no image, the second attempt should use a different model (`google/gemini-2.5-flash`) which may have different safety thresholds. The prompt stays the same.

3. **Simplify the wearable prompt further for the fallback** — On the retry attempt, use an ultra-minimal prompt like: `"Place the clothing item from Image 2 onto the person in Image 1. Output a photo."` to minimize any content the model might flag.

### Technical detail

```text
Attempt 1: gemini-3-pro-image-preview + standard prompt
  ↓ fails
Attempt 2: gemini-2.5-flash + minimal prompt
```

Both attempts keep the 55s timeout. Total budget stays under 110s (45s extraction + 55s × 1 primary + potential 55s fallback, but in practice the failures return fast since the model responds quickly when it refuses silently).

