

## Problem

The edge function logs show the exact error:

```
Unsupported image format for URL: https://yidfawmlhjltclnzfyuz.supabase.co/storage/v1/object/sign/profile-photos/.../full_body-1772467064559
Supported formats: PNG, JPEG, WebP, GIF. For other formats, use a data URL with the MIME type specified.
```

The signed URL for the profile photo has **no file extension** (e.g., `full_body-1772467064559` instead of `full_body-1772467064559.png`). The AI gateway cannot determine the image format from the URL alone and rejects it.

## Fix

In `supabase/functions/tryon-request/index.ts`, instead of passing the signed URL directly to the AI gateway, **fetch the image bytes from storage and convert to a base64 data URL** with the correct MIME type. This guarantees the AI gateway knows the format.

Steps:
1. After getting the signed URL, fetch the image binary from it
2. Detect the content-type from the response headers (or default to `image/jpeg`)
3. Convert to `data:image/jpeg;base64,...` format
4. Pass the data URL to the AI gateway instead of the signed URL

### File to change
- `supabase/functions/tryon-request/index.ts`

