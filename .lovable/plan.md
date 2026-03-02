

## Two-Step Product Extraction Pipeline

### Problem
The AI model sees the store's product photo (often showing a model of a specific gender/ethnicity) alongside the user's photo. This triggers safety filters when there's a demographic mismatch. No amount of prompt engineering can override hardcoded model safety layers.

### Solution: Split into two AI calls

**Step 1 — Product Extraction** (new)
- Send ONLY the product image (Image 2) to the AI
- Prompt: "Extract just the product/clothing item from this image. Remove the person, mannequin, and background completely. Output the item on a plain white background as if it were a flat-lay product photo."
- Use `google/gemini-3-pro-image-preview` for quality
- Result: a clean product-only image with no person visible

**Step 2 — Try-On Compositing** (existing, modified)
- Send the user's photo + the clean extracted product (from Step 1)
- Since the product image no longer contains another person, safety filters have nothing to compare demographics on
- Simplified prompt: "Place this clothing item on this person" — no need for the complex anti-discrimination language

### Timeout Budget
- Current: 2 attempts × 55s = 110s total
- New: Step 1 (45s) + Step 2 (55s) = 100s total, with one retry of Step 2 if needed
- Stays within edge function limits

### Files to change
- `supabase/functions/tryon-request/index.ts`
  - Add Step 1: product extraction call before the try-on loop
  - Use the extracted clean product image as input to Step 2 instead of the raw store image
  - Simplify the wearable prompt since there's no longer a "person in Image 2" to worry about
  - Adjust timeouts: 45s for extraction, 55s for compositing

