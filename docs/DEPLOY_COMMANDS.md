# Comandi Lexora – Supabase e Vercel

## Fix errori TypeScript API routes

Se il deploy Vercel segnala errori di import nelle API (es. *Relative import paths need explicit file extensions*):

- Aggiungi l’estensione **`.js`** agli import relativi nei file in `api/` (es. `from "../_lib/requireAdmin"` → `from "../_lib/requireAdmin.js"`).
- Verifica prima del deploy:  
  `npx tsc --noEmit`

**Workflow con fix:**  
*"Controlla errori TypeScript con npx tsc --noEmit, correggi gli import mancanti .js nelle API se necessario, poi: git add . && git commit -m 'fix: corretti import API' && git push && npx vercel --prod"*

---

## Navigazione (da fare sempre prima)

```bash
cd ~/OneDrive/Desktop/LEXORA/lexora-law-main
```

---

## Supabase – Gestione database

| Azione | Comando |
|--------|--------|
| **Genera/aggiorna i types dal DB** (dopo ogni modifica DB) | `npx supabase gen types typescript --project-id wzpxxlkfxymelrodjarl --schema public > src/types/supabase.ts` |
| **Crea una nuova migration** | `npx supabase migration new nome_modifica` |
| **Applica le migration al DB online** | `npx supabase db push` (dopo `npx supabase link --project-ref wzpxxlkfxymelrodjarl`) |
| **Sistema limiti (plan_limits, user_plan, usage_counters_monthly, RPC)** | Esegui la migration `supabase/migrations/20260204000000_plan_limits_usage_counters_rpc.sql` in Supabase SQL Editor (copia/incolla), poi Dashboard → Settings → API → **Reload schema cache** |
| **Deploy Edge Function** | `npx supabase functions deploy nome-funzione --project-ref wzpxxlkfxymelrodjarl` |
| **Deploy Edge Function health** | `npx supabase functions deploy health --project-ref wzpxxlkfxymelrodjarl` (dopo migration `20260204120000_schema_health_rpc.sql`) |
| **Log Edge Function in tempo reale** | `npx supabase functions logs nome-funzione --tail` |

---

## Vercel – Deploy e hosting

| Azione | Comando |
|--------|--------|
| **Deploy su produzione** (sito live) | `npx vercel --prod` |
| **Deploy di test** (URL preview temporaneo) | `npx vercel` |
| **Variabili d'ambiente** | `npx vercel env ls` |
| **Aggiungi variabile** | `npx vercel env add NOME_VARIABILE` |
| **Log errori sito** | `npx vercel logs` |

---

## Workflow completo (da dare a Cursor)

Esegui in sequenza:

1. `npx supabase migration new aggiungi_colonna_xyz`
2. Modifica il file SQL creato in `supabase/migrations/`
3. `npx supabase db push`
4. `npx supabase gen types typescript --project-id wzpxxlkfxymelrodjarl --schema public > src/types/supabase.ts`
5. `git add .`
6. `git commit -m 'Aggiunta colonna xyz'`
7. `git push`
8. `npx vercel --prod`

---

## Health Check (Supabase + Vercel)

1. **Migration schema_health**  
   Esegui `supabase/migrations/20260204120000_schema_health_rpc.sql` nel SQL Editor Supabase (crea RPC `schema_health()` per `to_regclass` su tabelle critiche).

2. **Deploy Edge Function health**  
   `npx supabase functions deploy health --project-ref wzpxxlkfxymelrodjarl`  
   Secrets richiesti: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

3. **Endpoint Vercel `/api/health`**  
   Il file `api/health.ts` è deployato con il sito; chiama la Edge Function `health`.  
   Env Vercel: `SUPABASE_URL` (o `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`).

4. **Test**  
   - Edge: `GET https://<project-ref>.supabase.co/functions/v1/health` (opzionale Bearer)  
   - Vercel (produzione): `GET https://lexora-law.com/api/health`  
   - Ping rapido: `GET https://lexora-law.com/api/ping`  
   Risposte sempre JSON; status 200 (ok) o 503 (unhealthy). Mai 404 se rewrites sono corretti.

5. **Vercel rewrites (Vite SPA)**  
   In `vercel.json` la prima rewrite deve essere `/api/:path*` → `/api/:path*` così `/api/*` non viene riscritto su `index.html`. Poi `/(.*)` → `/index.html` per la SPA.

---

**Project ref Supabase:** `wzpxxlkfxymelrodjarl`
