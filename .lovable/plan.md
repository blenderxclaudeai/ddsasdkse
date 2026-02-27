

# VTO — Virtual Try-On Web Dashboard & Backend

## 1. Database & Auth Setup
- Enable Supabase Auth with Google and Apple sign-in
- Create tables: `profiles`, `profile_photos` (categories: full_body, face, hair, hands_wrist), `tryon_requests`, `click_events`, `affiliate_merchants`, `wallet_ledger`, `user_roles`
- Create a `profile-photos` storage bucket with private access and signed URL serving
- Set up RLS policies for all tables (users see their own data, admins see everything)
- Auto-create profile on signup via database trigger

## 2. Edge Functions (Backend API)
- **tryon-request**: POST — accepts `{ pageUrl, imageUrl, title, price, retailerDomain }`, stores in DB, returns mock result image URL (placeholder for real AI later)
- **profile-photos**: POST — handles photo uploads by category to storage bucket, returns signed URLs
- **profile**: GET — returns user's photos and completeness status
- **redirect**: GET — public endpoint that records click events, wraps URL with affiliate link if configured, returns 302 redirect
- **admin-cashback**: POST — admin-only endpoint to approve/reject cashback entries

## 3. Auth Flow
- Login page with Google + Apple sign-in buttons
- Protected routes requiring authentication
- JWT token available for extension use (show token copy button in profile for extension pairing)

## 4. Dashboard Pages
- **`/login`** — Sign in with Google / Apple
- **`/dashboard`** — Summary: profile completeness ring, recent try-ons grid, pending cashback total
- **`/profile`** — Upload/replace/delete photos per category, delete account button, privacy info
- **`/wallet`** — Pending / available / paid out cashback table, payout request form
- **`/admin`** — (admin role only): Manage affiliate merchants, view click/try-on volume charts, approve cashback entries
- **`/privacy`** — Privacy policy page (markdown rendered)

## 5. UI Design
- Clean, minimal design with a modern feel
- Sidebar navigation with VTO branding
- Responsive layout (mobile-friendly)
- Toast notifications for actions
- Loading/skeleton states throughout

## 6. Security & Privacy
- All storage files served via signed URLs (private bucket)
- URL validation on redirect endpoint (http/https only)
- "Delete my data" function that removes all user data
- RLS on every table
- Admin role stored in separate `user_roles` table

