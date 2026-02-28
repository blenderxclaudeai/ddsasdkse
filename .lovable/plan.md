

# Redesign VTO as Extension-Sized App

## What Changes

The app will be resized to a fixed extension-popup size (~400x600px), stripped down to only essential pages, and redesigned with Apple-inspired aesthetics: generous whitespace, SF-style typography, no card borders, subtle grays, smooth transitions.

## Pages After Redesign

1. **Login/Signup** — Cleaned up, with a tiny "Privacy & Terms (PDF)" link at the bottom
2. **Profile** — Photo upload grid (no danger zone, no delete account)
3. **Showroom** — New page showing try-on results gallery
4. **Admin** — Kept but restyled (accessed via `/admin`)

## Pages Removed
- `/dashboard` — Removed entirely
- `/wallet` — Removed
- `/privacy` — Removed (replaced by PDF download link on login)

## Design Changes

### Root Layout
- Fixed dimensions: `w-[400px] h-[600px]` centered on screen (simulating extension popup)
- No sidebar — replace with a minimal bottom tab bar (Profile / Showroom icons) or top nav
- Remove `AppLayout` with sidebar, replace with a slim `ExtensionLayout` wrapper

### Visual Style (Apple-inspired)
- Remove purple primary color — switch to monochrome with a single accent (black buttons, light gray backgrounds)
- Remove card borders and shadows — use background color contrast instead
- Larger font weights for headings, system font stack with `-apple-system, BlinkMacSystemFont`
- No rounded-lg card borders everywhere — clean flat sections
- Generous padding, less visual clutter
- Remove all icons from nav/headers (clean text-only navigation)
- Subtle hover states with opacity transitions

### CSS / Tailwind Changes
- Update `index.css` color variables: near-white background, pure black foreground, minimal accent
- Update `tailwind.config.ts` font family to Apple system fonts
- Remove `App.css` (unused boilerplate)
- Add fixed-size container class

## Implementation Steps

1. **Update `index.css`** — New monochrome color scheme, Apple-style variables
2. **Update `tailwind.config.ts`** — Apple system font stack
3. **Delete `App.css`** — Remove unused boilerplate styles
4. **Create `ExtensionLayout.tsx`** — Fixed 400x600 container with bottom tab bar (Profile, Showroom)
5. **Rewrite `Login.tsx`** — Cleaner design, add PDF privacy link at bottom, redirect to `/profile` instead of `/dashboard`
6. **Rewrite `Profile.tsx`** — Remove danger zone, cleaner photo upload UI, use ExtensionLayout
7. **Create `Showroom.tsx`** — New page showing try-on results in a gallery view
8. **Update `App.tsx`** — Remove `/dashboard`, `/wallet`, `/privacy` routes; add `/showroom`; change default redirect to `/profile`
9. **Update `AppSidebar.tsx`** — Remove or replace with bottom tab bar inside ExtensionLayout
10. **Restyle `AdminPage.tsx`** — Use ExtensionLayout, cleaner look
11. **Update `ProtectedRoute.tsx`** — Redirect to `/profile` instead of `/dashboard`

## Technical Details

- The fixed-size container uses `w-[400px] h-[600px] mx-auto my-auto overflow-hidden` with `min-h-screen flex items-center justify-center` on the outer wrapper
- Bottom tab bar: two icons (User, Grid/Gallery) with active state indicator
- Privacy PDF: static link `<a href="/privacy-policy.pdf" download>` — we'll add a placeholder PDF or just link text for now
- Showroom page queries `tryon_requests` for the current user and displays result images in a masonry-like grid

