

## Problem

The `tryon-request` edge function has a **duplicate variable declaration** bug. `wearableCategories` (and `roomCategories`) are declared with `const` at **line 88** (debug logging block) and again at **line 181** (prompt system block). This causes a `SyntaxError: Identifier 'wearableCategories' has already been declared` and the function fails to boot entirely.

## Fix

**File:** `supabase/functions/tryon-request/index.ts`

Remove the duplicate declarations at lines 180-185 (the second set). The first declarations at lines 88-89 already define these sets identically, so the prompt logic at line 191 onward can just reference the existing variables.

Lines to delete:
```typescript
// --- Category-aware prompt system ---
const wearableCategories = new Set([...]); // line 181 — duplicate
const roomCategories = new Set([...]);     // line 182 — duplicate  
const petCategories = new Set(["pet"]);    // line 183
const carCategories = new Set(["car_interior"]); // line 184
const gardenCategories = new Set(["garden"]);    // line 185
```

Replace with references to the existing variables (lines 88-89) and inline the simple checks for pet/car/garden since they're single-value sets (already done via `category === "pet"` etc. in the debug block).

Redeploy the function after the fix.

