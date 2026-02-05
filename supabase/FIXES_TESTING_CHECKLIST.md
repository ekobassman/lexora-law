# Supabase Fixes – Testing Checklist

## 1. Database schema (profiles columns)

**Migration:** `20260208120000_profiles_columns_and_rls_fix.sql`

- **Verify columns exist:** In Supabase SQL Editor or Dashboard → Table Editor → `profiles`:
  - `country` (TEXT, default 'DE')
  - `preferred_language` (TEXT, default 'IT')
- **Rollback (if needed):**
  ```sql
  ALTER TABLE public.profiles DROP COLUMN IF EXISTS country;
  ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferred_language;
  ```

## 2. RLS policies (no infinite recursion)

**Same migration** – admin policies on `profiles` now use `public.is_admin()` (reads `user_roles`) instead of `SELECT FROM profiles`.

- **Verify:** Update a profile (e.g. country, preferred_language) from the app; no "infinite recursion detected in policy for relation 'profiles'" in logs.
- **Check policies:** Supabase Dashboard → Authentication → Policies → `profiles`:
  - `admin_read_all_profiles`: `USING (public.is_admin())`
  - `admin_update_all_profiles`: `USING (public.is_admin())`

## 3. CORS on Edge Functions

**Updated:** `_shared/cors.ts`, `sync-subscription`, `credits-get-status`, `upload-document`.

- **Test CORS:** From https://lexora-law.com (or localhost:8080), open DevTools → Network:
  - Call `sync-subscription`, `credits-get-status`, or `upload-document`.
  - Response headers should include:
    - `Access-Control-Allow-Origin`: your origin (or `*` if not in allowlist)
    - `Access-Control-Allow-Headers`: `authorization, x-client-info, apikey, content-type, x-demo-mode`
    - `Access-Control-Allow-Methods`: `POST, GET, OPTIONS, PUT, DELETE`
- **Preflight:** OPTIONS request to the function should return 200/204 with the same CORS headers and no CORS error in the console.

## 4. Upload-document auth

- **Logged-in user:** Upload a document from the app; request must have `Authorization: Bearer <jwt>`. Should return 200 (no 401).
- **Demo mode (anonymous):** From homepage demo, use Scan/Upload; request must have `X-Demo-Mode: true` and `Authorization: Bearer <anon-jwt>`. Should return 200.
- **401 cases:** If you get 401, check Edge Function logs (Supabase Dashboard → Edge Functions → upload-document → Logs) for:
  - `[upload-document] Missing Authorization header`
  - `[upload-document] Invalid JWT: <message>`

## 5. Quick validation order

1. Run the new migration (if not auto-applied).
2. Confirm `profiles` has `country` and `preferred_language`.
3. Update profile (e.g. language) in the app – no recursion error.
4. In browser, confirm no CORS errors for sync-subscription, credits-get-status, upload-document.
5. Test document upload (logged-in and demo) and confirm no 401 when token is valid / X-Demo-Mode is used.
