

## Plan

### 1. Default to Side Panel mode
In the background script's `onInstalled` handler, change the default `cartify_display_mode` from `"popup"` to `"sidepanel"`. This means first-time users get the side panel experience by default.

**File:** `extension/src/background/index.ts` — change the fallback default from `"popup"` to `"sidepanel"` in both `onInstalled` and `onStartup`.

### 2. Fix scrolling in side panel mode
The side panel container uses `min-h-screen` but the scrollable content area already has `overflow-y-auto`. The issue is the outer container has `overflow-hidden` combined with `min-h-screen`, which can prevent the inner scroll from working correctly in the constrained side panel viewport.

**File:** `extension/src/shared/CartifyApp.tsx` — change the sidepanel container class from:
```
"w-full h-full min-h-screen flex flex-col overflow-hidden"
```
to:
```
"w-full h-screen flex flex-col overflow-hidden"
```
Using `h-screen` (fixed to viewport) instead of `min-h-screen` (can grow beyond viewport) ensures the flex layout constrains properly and the inner `overflow-y-auto` div actually scrolls.

### 3. Feature ideas

Here are additional features worth considering — presented as suggestions after implementation.

---

**Technical details:**
- Two files changed: `extension/src/background/index.ts` (default mode), `extension/src/shared/CartifyApp.tsx` (scroll fix)
- Both are small, low-risk edits

