

## Problem

The AI image generation call is failing silently because:

1. **Missing `modalities` parameter**: The Lovable AI image generation API requires `modalities: ["image", "text"]` in the request body. Without it, the model returns text only -- no image.

2. **Wrong response parsing**: The code looks for `content` as an array with `image_url`/`inline_data` parts, or `message.parts`. But the actual response format puts images in `message.images[].image_url.url` -- a separate field the code never checks.

## Plan

### Update `supabase/functions/tryon-request/index.ts`

1. Add `modalities: ["image", "text"]` to the AI gateway request body
2. Add parsing for `message.images[0].image_url.url` (the actual response format)
3. Add better logging so failures are diagnosable -- log the AI response structure when no image is found
4. Use multimodal content format (array with text + image_url parts) instead of embedding URLs in a text string, so the model actually sees the images

The request should look like:
```typescript
body: JSON.stringify({
  model: "google/gemini-3-pro-image-preview",
  modalities: ["image", "text"],
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Generate a realistic virtual try-on..." },
      { type: "image_url", image_url: { url: userPhotoUrl } },
      { type: "image_url", image_url: { url: imageUrl } }
    ]
  }]
})
```

And response parsing should check:
```typescript
const images = aiData.choices?.[0]?.message?.images;
if (images?.[0]?.image_url?.url) {
  resultImageUrl = images[0].image_url.url;
}
```

### File to change
- `supabase/functions/tryon-request/index.ts`

