

## Problem

The logs show: `AI returned no image. Response structure: ["role","content","refusal","reasoning","reasoning_details","annotations"]`

Two issues:

1. **Product image URL not accessible to AI gateway**: The `imageUrl` from the retailer (e.g., Zalando) is passed as a raw URL. The AI gateway may not be able to fetch it (CORS, auth cookies, CDN restrictions). The user photo was already fixed by converting to base64 — the product image needs the same treatment.

2. **Response parsing incomplete**: The AI response has a `content` field but no `images` array. The image might be embedded inline in `content` (as a multimodal content array with `image_url` parts) rather than in a separate `images` field. The code only checks `message.images` and misses this.

## Plan

### Update `supabase/functions/tryon-request/index.ts`

1. **Convert product image to base64**: Before sending to the AI, fetch the product image URL and convert it to a `data:` URI, just like the user photo. This ensures the AI gateway can actually see both images.

2. **Expand response parsing**: Check multiple locations for the generated image:
   - `message.images[0].image_url.url` (current check)
   - `message.content` as an array — look for parts with `type: "image_url"`
   - `message.content` as a string — check if it contains a base64 data URI

3. **Add detailed logging**: Log the actual `content` value (truncated) when no image is found, so we can see exactly what the model returns.

### File to change
- `supabase/functions/tryon-request/index.ts`

