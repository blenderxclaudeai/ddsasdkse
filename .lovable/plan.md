

# Update Login & Improve Post-Login Experience

## 1. Login Page — OAuth Only
- Remove email/password form, mode toggle, and all related state
- Add Apple sign-in button alongside Google
- Two clean buttons stacked: "Continue with Google" and "Continue with Apple"
- Remove the "or" divider
- Update subtitle from "Virtual Try-On" to something broader like "Try before you buy" since the scope now covers all online shopping

## 2. Profile Page — Broader Scope
- Update photo categories to be more general for all shopping (not just clothes):
  - Keep: Full Body, Face
  - Replace "Hair" → "Upper Body" (useful for jewelry, watches, glasses, hats)
  - Replace "Hands" → "Lifestyle" (for home decor, accessories context)
- Add user info section at top: avatar (from Google/Apple), name, email
- Add a small settings gear or account section with sign-out moved here (cleaner than tab bar)

## 3. Showroom Page — Better Empty State & Design
- Improve empty state with a more inviting illustration/message about the broader product scope
- Add product category labels on results (not just clothes)

## 4. ExtensionLayout — Cleaner Tab Bar
- Move "Sign Out" out of the main tab bar (it's not a page)
- Add it as a small icon/link in Profile page header instead
- Keep just two tabs: Profile, Showroom

## Implementation Files
1. **`src/pages/Login.tsx`** — Strip email/password, add Apple button, update copy
2. **`src/pages/Profile.tsx`** — Update categories, add user info header
3. **`src/components/ExtensionLayout.tsx`** — Remove Sign Out from tab bar
4. **`src/pages/Showroom.tsx`** — Minor copy updates for broader scope

