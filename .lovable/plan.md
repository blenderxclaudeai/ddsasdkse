

## Plan: Add Response Diagnostics + User-Friendly Bias Error Message

### What to change — `supabase/functions/tryon-request/index.ts`

**1. Add response diagnostics logging (lines ~438-442)**
When Step 2 produces no image, log the full response structure: content types, text content, and all message keys. This is critical to understand what the model actually returns on silent refusal.

**2. Update the failure error message (lines 454-461)**
When both attempts fail with no image and no explicit refusal, return a specific user-friendly message:

> "The AI model's safety filters blocked this try-on. This can happen when the AI detects differences in gender or ethnicity between you and the product image — a limitation of the current AI model, not something we agree with. We're working on it. Please try a different product or photo."

Keep the existing flow (2 attempts, same model, same prompts) — no model fallback changes.

### Files changed
- `supabase/functions/tryon-request/index.ts` only

