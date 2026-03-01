## Extension Status — Updated

### ✅ Fixed
- **Auth bug**: `getClaims()` now used correctly with proper token extraction
- **Build script**: `build:extension` added to package.json — builds popup + content.js + background.js
- **AI try-on**: Integrated Lovable AI (Gemini image generation) — uses user's profile photo + product image to generate realistic try-on composites
- **Product page detection**: Content script now uses JSON-LD, OpenGraph, microdata, DOM heuristics, and known retailer domains to only show on actual product pages

### ⏳ Remaining
| Item | Status |
|------|--------|
| Configure Awin/Impact affiliate network | Not started — need merchant data in `affiliate_merchants` table |
| Chrome Web Store assets & privacy policy | Not started |
| Test AI try-on quality end-to-end | Needs manual testing |

### How the AI try-on works now
1. User clicks "Try On" on a product page
2. Content script sends product data → background → popup
3. Popup calls `tryon-request` edge function
4. Edge function fetches user's `full_body` profile photo from storage
5. Sends both images + product title to **Gemini 3 Pro Image Preview** via Lovable AI gateway
6. Returns generated try-on image to the popup
7. Falls back to placeholder if AI is unavailable or user has no profile photo
