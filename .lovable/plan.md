

## Problem

The category detection regex only has **English** keywords. The IKEA page is in Swedish — the product title is "STOCKHOLM 2025 **3-sitssoffa**" (Swedish for sofa). The regex pattern looks for `sofa` but the Swedish word is `soffa`/`sitssoffa`. So:

1. Category detection returns `undefined`
2. Backend defaults to `full_body` (wearable mode)
3. It fetches the user's **person photo** instead of the living room photo
4. AI sees person + sofa → makes person sit on sofa

This will happen on any non-English shopping site.

## Fix

### 1. `extension/src/content/productExtract.ts` — Add multilingual keywords

Add Swedish, German, French, Spanish, etc. translations for common product categories. Most critical ones:

```
living_room: soffa, sitssoffa, canapé, Sofa, Couch, divano, soffbord...
bedroom: säng, madrass, sängbord, lit, matelas, Bett...
kitchen: kök, küche, cuisine, cocina...
```

Also add the IKEA breadcrumb keywords since IKEA is a major retailer: `fåtölj` (armchair), `soffgrupp` (sofa group), etc.

### 2. `extension/src/content/productExtract.ts` — Also scrape breadcrumbs

IKEA's breadcrumb clearly says "Soffor & fåtöljer > Soffor & soffgrupper > 3-sits soffor". Add breadcrumb text to the detection `combined` string:

```typescript
// Scrape breadcrumbs for extra category signals
const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] a, nav[aria-label*="bread"] a, ol li a');
let breadcrumbText = "";
breadcrumbs.forEach(a => breadcrumbText += " " + a.textContent);
const combined = (text + " " + jsonLdText + " " + breadcrumbText).toLowerCase();
```

### 3. `supabase/functions/tryon-request/index.ts` — Add debug logging

Log the received category and selected prompt mode so we can diagnose future issues:

```typescript
console.log(`Category received: "${category}", prompt mode: "${promptMode}"`);
```

### Files to change
- `extension/src/content/productExtract.ts` — add breadcrumb scraping + multilingual regex patterns
- `supabase/functions/tryon-request/index.ts` — add category/mode logging

