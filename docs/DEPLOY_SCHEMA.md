# Deploy aggiornamenti schema (Lexora + Stripe)

## Ordine operativo (cosa fare adesso)

1. **Schema (risolve 400/404 su REST e errori Terms/Legal/Chat)**  
   Esegui `supabase/lexora_schema_rebuild.sql` in produzione come da checklist sotto (backup → staging se possibile → produzione). Verifica che:
   - `profiles` abbia le colonne `payment_status`, `terms_version`, `privacy_version`, `age_confirmed`, `age_policy_version`, ecc.  
   - Esistano le tabelle `legal_versions`, `dashboard_chat_messages`, `dashboard_chat_history`.

2. **Edge Functions (risolve CORS / 401 / ERR_FAILED)**  
   Per `sync-subscription`, `credits-get-status`, `public-health`, `analyze-letter`:
   - Nel codice: OPTIONS → 204 con `corsHeaders`; tutte le risposte (anche errore) con `corsHeaders`.  
   - Config: `supabase/functions/<name>/supabase.function.config.json` con `{ "verify_jwt": false }` e `supabase/config.toml` con `[functions.<name>] verify_jwt = false`.  
   - **Redeploy in produzione:** `supabase functions deploy sync-subscription credits-get-status public-health analyze-letter`.  
   - In Dashboard → Edge Functions verificare che “Enforce JWT” sia **disattivato** per tutte e quattro. Finché il preflight OPTIONS riceve 401, “Accept & continue” non sblocca la dashboard.

3. **Verifica dal browser**  
   - `GET /rest/v1/legal_versions?select=...` → 200 (o 204 con lista vuota), non 404.  
   - `GET /rest/v1/profiles?select=terms_version,...` → nessun “column does not exist”.  
   - POST a `sync-subscription` e `credits-get-status` → 200 o risposta di business visibile (niente CORS / net::ERR_FAILED).

---

## Checklist

1. **Backup produzione**
   - Supabase Dashboard → Database → Backups → crea uno snapshot manuale.

2. **Staging**
   - Apri il progetto di staging in Supabase.
   - Vai su **SQL Editor**.
   - Esegui `supabase/lexora_schema_rebuild.sql`.
   - Verifica:
     - Nessun errore nel log dell'esecuzione.
     - Tabelle/colonne aggiornate come previsto.
     - Le SELECT di diagnostica in fondo allo script girano correttamente.

3. **Produzione**
   - Apri Supabase → progetto di **produzione** (es. URL `...supabase.co`).
   - Vai su **SQL Editor**, incolla l’intero contenuto di `supabase/lexora_schema_rebuild.sql` (ultima versione dal repo) ed eseguilo **una volta**.
   - Se staging è OK, ripeti gli stessi passi sul progetto di produzione.
   - Conserva il riferimento allo snapshot in caso di rollback.

4. **Verifica post-script (produzione)**  
   Esegui nel SQL Editor le due query sotto. Se **non** danno errore, le colonne ci sono:
   ```sql
   SELECT terms_version, privacy_version, age_confirmed, age_policy_version
   FROM public.profiles
   LIMIT 1;

   SELECT pratica_id
   FROM public.documents
   LIMIT 1;
   ```
   Poi ricarica Lexora dal browser: i 400 su `/rest/v1/profiles` e `/rest/v1/documents` devono sparire; il POST a documents e la pipeline (upload → OCR → analisi → bozza) possono completarsi.  
   **Finché lo script non è stato eseguito sul DB di produzione**, il frontend continuerà a ricevere 400 (column ... does not exist) e non verrà salvato nulla nel caso.

4b. **Seed legal_versions (sblocca “Accept & continue”)**  
   Lo script di schema crea solo la tabella `legal_versions`, non inserisce righe. Se il frontend segnala `[LegalAcceptanceGate] legal_versions incomplete: ['terms', 'privacy', 'disclaimer']`, in SQL Editor (produzione) incolla ed esegui **una volta** il contenuto di `supabase/seed_legal_versions.sql`. Così il gate può confrontare `userTermsVersion` / `currentTermsVersion` e “Accept & continue” sblocca la dashboard.

5. **Test RLS e app**
   - Testa dal client (frontend / backend) usando le chiavi Supabase:
     - `anon` per lo user autenticato normale.
     - `service_role` solo dove strettamente necessario.
   - Verifica che:
     - Ogni utente veda solo i propri dati (wallet, subscriptions, chat, legal).
     - Le tabelle pubbliche (`legal_versions`, eventuali stats globali) siano leggibili dove previsto.

6. **Monitoraggio**
   - Monitora errori applicativi (500/API) dopo il deploy.
   - Se emergono problemi di permessi, controlla prima le policy RLS prima di toccare lo schema.

## Troubleshooting

- **400 su `profiles` o 404 su `legal_versions` / `dashboard_chat_messages` / `dashboard_chat_history`**  
  Lo schema in produzione non è aggiornato. Esegui `supabase/lexora_schema_rebuild.sql` nel SQL Editor del progetto (vedi checklist sopra).

- **CORS / 401 su Edge Functions (`sync-subscription`, `credits-get-status`, `public-health`, `analyze-letter`)**  
  La preflight OPTIONS non invia `Authorization`; se la piattaforma applica la verifica JWT, la preflight riceve 401 prima di arrivare al handler. Le funzioni hanno `verify_jwt = false` in `config.toml` e in `supabase.function.config.json`. **Ridistribuisci** le funzioni in produzione e in Dashboard → Edge Functions verifica che “Enforce JWT” sia disattivato. Tutte le risposte (inclusi errori) devono includere `corsHeaders`.

- **“Accept & continue” non sblocca / legal_versions incomplete**  
  Esegui `supabase/seed_legal_versions.sql` nel SQL Editor di produzione (inserisce terms, privacy, disclaimer con version `2026-01-28`). Poi hard refresh, rifai login, clicca di nuovo Accept & continue.
