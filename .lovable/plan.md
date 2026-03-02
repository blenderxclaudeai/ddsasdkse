

## Problem

The AI model's safety filters trigger when it detects a mismatch between the user's appearance (gender, skin color) and the person modeling the product in the product photo. It interprets the request as "change this person's race/gender," which hits safety guardrails.

The root cause is the prompt — it asks the model to show the product "on someone with a similar appearance" while providing two photos of different-looking people. The model gets confused about what's being asked.

## Fix

### Update prompt in `supabase/functions/tryon-request/index.ts`

Rewrite the prompt to make it crystal clear that:
- The first image is **the user** — keep them exactly as they are
- The second image is **only a product reference** — extract just the item, ignore the model wearing it
- The task is to place the **product** onto the **user's photo**, not to alter the user's appearance

New prompt:
```
I'm providing two images. Image 1 is a photo of a person (the customer). Image 2 is a product listing photo — extract ONLY the product/item from it, ignore any model or mannequin shown. Generate a new realistic photo of the SAME person from Image 1, keeping their exact appearance unchanged, but wearing/using the product extracted from Image 2. Do not alter the person's face, skin, body, or identity in any way. Only add the product to them naturally with correct lighting and proportions.
```

This explicitly tells the model:
- Don't change the person
- The product photo model is irrelevant — just extract the item
- This avoids any "transform person A into person B" interpretation

Also add a retry with `google/gemini-2.5-flash-image` as fallback if the primary model still refuses.

### File to change
- `supabase/functions/tryon-request/index.ts`

