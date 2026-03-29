## ✅ Implemented: Firecrawl Coupons, Single-Tab Variant Flow, Universal Extraction

All items from the approved plan have been implemented.

### Changes Made

1. **Firecrawl-Powered Coupon Discovery** — Replaced unreliable Google fetch with Firecrawl search API (`/v1/search`) as Tier 1; AI kept as Tier 2 fallback
2. **Strict Coupon Validation** — 500+ word blocklist + codes must contain letters+digits or be ≥5 uppercase letters
3. **Single-Tab Variant + Add-to-Cart Flow** — Variant extraction and add-to-cart happen on the SAME foreground tab (one visit, not two)
4. **Universal Variant Extraction as Primary** — `extractUniversalFallback` promoted to primary strategy (after JSON-LD), with expanded `inferLabelFor` checking aria-labelledby, data-testid, grandparent headings, and bold spans
5. **Expanded Multi-Language Support** — Size/color label detection now covers: English, Swedish (Storlek/Färg), German (Größe/Farbe), French (Taille/Couleur), Dutch (Maat/Kleur), Polish, Italian, Portuguese, Japanese
6. **Product Page Pre-Extraction** — Still pre-extracts variants when user visits product pages (2s wait for SPA hydration)
7. **Merged Variant Selection** — UI variant flow now uses the unified `CARTIFY_ADD_TO_RETAILER_CART` message which handles extraction, tab management, and add-to-cart in one flow
