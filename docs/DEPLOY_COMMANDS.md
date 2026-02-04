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

**Project ref Supabase:** `wzpxxlkfxymelrodjarl`
