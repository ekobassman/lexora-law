# Deploy Edge Functions from this repo

The CORS logic for `analyze-letter` (and `credits-get-status`, `sync-subscription`) lives in **this** repo.

If you deploy from a **different** folder (e.g. `lexora-law-main` or another clone), the project in Supabase Dashboard will use that code. You will then see only `Access-Control-Allow-Origin: *` on OPTIONS and the browser will block the request.

**From PowerShell, run deploy from the repo root that contains this file:**

```powershell
cd C:\Users\lenovo\OneDrive\Desktop\LEXORA\amt-helper-de-main\amt-helper-de-main
supabase functions deploy analyze-letter --project-ref wzpxxlkfxymelrodjarl
supabase functions deploy credits-get-status --project-ref wzpxxlkfxymelrodjarl
supabase functions deploy sync-subscription --project-ref wzpxxlkfxymelrodjarl
```

After deploy, check in DevTools → Network → OPTIONS request that the response headers include:

- `Access-Control-Allow-Origin: https://lexora-law.com`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
