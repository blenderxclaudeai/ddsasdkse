

# What's Missing Before Connecting the Extension

After reviewing the full codebase, here's an audit of gaps and issues that need fixing before the Chrome Extension can connect to this backend.

---

## 1. Missing: Database trigger for `handle_new_user`

The function `handle_new_user()` exists but the trigger is not attached to `auth.users`. This means new sign-ups do NOT get a `profiles` row created, which will break profile lookups from the extension. A migration needs to create the trigger:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 2. Photo categories mismatch

The UI shows "Upper Body" and "Lifestyle" but the database enum is still `hair` and `hands_wrist`. The extension will need to use these enum values when fetching user photos. Either:
- Update the enum to `upper_body` / `lifestyle` (breaking change, migration needed)
- Or document that the extension must map display names to the old enum keys

Recommendation: update the enum via migration so extension and web use the same clear values.

## 3. `tryon-request` edge function uses a mock result

Currently returns a placeholder image. Before real integration:
- Define the actual AI model endpoint the extension will trigger
- Add a secret for the AI API key (or use Lovable AI)
- Update the function to call the real model and store the result

## 4. No endpoint for the extension to fetch user profile photos

The extension needs user photos (face, body) to send to the AI model. Currently:
- Photos are in private storage with signed URLs generated client-side
- The extension authenticates via JWT token (copied from profile)
- The extension can use the same Supabase client with the JWT to query `profile_photos` and generate signed URLs

This works as-is, but you should add documentation/a helper endpoint if the extension uses REST directly instead of the JS SDK.

## 5. Storage bucket RLS / policies

The `profile-photos` bucket is private, which is correct. The extension will need to pass the user's JWT when fetching signed URLs. Verify the storage policies allow authenticated users to read their own files (path starts with `{user_id}/`). A storage policy may need to be added:

```sql
CREATE POLICY "Users can read own photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos' AND (auth.uid()::text) = (storage.foldername(name))[1]);
```

## 6. Dead code cleanup

- `AppSidebar.tsx` still references `/dashboard`, `/wallet`, `/privacy` routes that no longer exist. Should be deleted or gutted since `ExtensionLayout` replaced it.
- `AppLayout.tsx` is unused. Should be deleted.
- `Dashboard.tsx` and `WalletPage.tsx` and `Privacy.tsx` still exist as files but aren't routed. Should be deleted.

## 7. CORS on edge functions

All three edge functions use `Access-Control-Allow-Origin: *`. Fine for development, but for production you may want to restrict to your extension's origin and your web app domain.

## 8. Extension pairing token flow

The "Copy Extension Token" button exists in `AppSidebar.tsx` but that sidebar is no longer rendered anywhere (replaced by `ExtensionLayout`). The token copy feature needs to be re-added somewhere accessible — likely on the Profile page.

---

## Implementation Plan

1. **Add `handle_new_user` trigger** — migration to attach trigger to `auth.users`
2. **Update photo category enum** — migration: rename `hair` → `upper_body`, `hands_wrist` → `lifestyle`; update Profile.tsx to use new values
3. **Add storage policies** — migration for read/write policies on `profile-photos` bucket scoped to user's folder
4. **Add token copy to Profile page** — re-add the JWT copy button so users can pair the extension
5. **Delete dead files** — remove `AppSidebar.tsx`, `AppLayout.tsx`, `Dashboard.tsx`, `WalletPage.tsx`, `Privacy.tsx`
6. **Document extension API contract** — the endpoints the extension needs to call:
   - `POST /functions/v1/tryon-request` with `Authorization: Bearer <jwt>` and body `{ pageUrl, imageUrl, title, price, retailerDomain }`
   - `GET /functions/v1/redirect?target=<url>` for affiliate redirects
   - Direct Supabase REST for `profile_photos` and `tryon_requests` queries

