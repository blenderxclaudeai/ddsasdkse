

## Problem

The logs show: `AI returned no image. Keys: ["role","content","refusal","reasoning","reasoning_details"] Content preview: null`

The `content` is **null** and the response includes a `refusal` field. This means the model is **refusing** to generate the image — likely due to safety filters triggered by the combination of a person photo + "try-on" prompt. The code never logs the `refusal` or `reasoning` fields, so we can't see the exact reason.

## Plan

### Update `supabase/functions/tryon-request/index.ts`

Two changes:

1. **Log refusal and reasoning**: When no image is found, also log `message.refusal` and `message.reasoning` so we can see exactly why the model refused.

2. **Rework the prompt to avoid safety filter triggers**: The current prompt says "Generate a realistic virtual try-on image" and "Show the person wearing/using this product." This likely triggers person-manipulation safety filters. Instead, use a more indirect prompt like:
   ```
   You are a fashion visualization assistant. I'm providing two images: a reference photo of a person and a product photo. Create a new image showing how this product would look when styled on someone with a similar appearance. Focus on realistic lighting and proportions.
   ```
   This frames it as creative styling rather than person manipulation, which is less likely to trigger refusals.

3. **Return the refusal message to the user** instead of the generic "AI could not generate" error, so users get actionable feedback.

### File to change
- `supabase/functions/tryon-request/index.ts`

