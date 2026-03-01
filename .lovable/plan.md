

## Changes Overview

Multiple refinements across Profile, Showroom, and ExtensionLayout to fix scrollbar visibility, add settings, add "Add to Cart" affiliate button, and polish the design.

### 1. ExtensionLayout — hide scrollbar, add settings icon

- Remove `overflow-y-auto` from `<main>` and replace with `overflow-y-auto` plus a CSS utility to hide the scrollbar visually (using `scrollbar-hide` or inline styles with `-webkit-scrollbar: none` and `scrollbar-width: none`)
- Add a settings gear icon (lucide `Settings`) in the top-left corner as a floating/absolute element inside the card
- Clicking it opens a dropdown/popover with "Sign Out" and placeholder "Settings" option
- Add a `/settings` route later, or just use a simple dropdown for now

### 2. Profile page

- **Remove** the Sign Out button entirely (moved to settings icon in layout)
- **Remove** `signOut` from the `useAuth` destructure in this file
- **Center tabs properly** — the TabsList currently uses `justify-start`; change to `justify-center` or evenly spaced
- **Hide scrollbar** on the tab content area (`max-h-[300px] overflow-y-auto` → add scrollbar-hide)
- Clean up spacing to feel more balanced within the 600px card

### 3. Showroom page

- **Add "Add to Cart" button** on each completed result card — this button constructs the affiliate redirect URL using the existing `redirect` edge function: `${SUPABASE_URL}/functions/v1/redirect?target=${encodeURIComponent(r.page_url)}&retailerDomain=${r.retailer_domain}`
- Opens in a new tab so the user lands back on the retailer's product page to add to cart
- **Hide scrollbar** (same CSS fix via layout)
- Polish spacing to match the cleaner design

### 4. CSS — global scrollbar hide utility

Add a `.scrollbar-hide` utility class in `src/index.css`:
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

### 5. Settings dropdown in ExtensionLayout

- Use a simple Popover or DropdownMenu (already installed via Radix) triggered by a gear icon
- Contains "Sign Out" option (calls `signOut` from `useAuth`)
- Positioned top-left of the card, inside the container

### Files to modify
- `src/index.css` — add scrollbar-hide utility
- `src/components/ExtensionLayout.tsx` — add settings icon with dropdown, hide scrollbar on main
- `src/pages/Profile.tsx` — remove Sign Out, center tabs, remove `signOut` import
- `src/pages/Showroom.tsx` — add "Add to Cart" affiliate link button on results

