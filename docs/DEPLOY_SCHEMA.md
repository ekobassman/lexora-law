# Deploy aggiornamenti schema (Lexora + Stripe)

## Ordine operativo (cosa fare adesso)

1. **Schema (risolve 400/404 su REST e errori Terms/Legal/Chat)**  
   Esegui `supabase/lexora_schema_rebuild.sql` in produzione come da checklist sotto (backup → staging se possibile → produzione). Verifica che:
   - `profiles` abbia le colonne `payment_status`, `terms_version`, `privacy_version`, `age_confirmed`, `age_policy_version`, ecc.  
   - Esistano le tabelle `legal_versions`, `dashboard_chat_messages`, `dashboard_chat_history`.

2. **Edge Functions (risolve CORS / 401 / ERR_FAILED)**  
   Per `sync-subscription`, `credits-get-status`, `public-health`:
   - Nel codice: OPTIONS → 204 con `corsHeaders`; tutte le risposte (anche errore) con `corsHeaders`.  
   - Config: `supabase/functions/<name>/supabase.function.config.json` con `{ "verify_jwt": false }` e `supabase/config.toml` con `[functions.<name>] verify_jwt = false`.  
   - Redeploy: `supabase functions deploy sync-subscription credits-get-status public-health`.  
   - In Dashboard → Edge Functions verificare che “Enforce JWT” sia disattivato per tutte e tre.

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
   - Se staging è OK, ripeti gli stessi passi sul progetto di produzione.
   - Conserva il riferimento allo snapshot in caso di rollback.

4. **Test RLS e app**
   - Testa dal client (frontend / backend) usando le chiavi Supabase:
     - `anon` per lo user autenticato normale.
     - `service_role` solo dove strettamente necessario.
   - Verifica che:
     - Ogni utente veda solo i propri dati (wallet, subscriptions, chat, legal).
     - Le tabelle pubbliche (`legal_versions`, eventuali stats globali) siano leggibili dove previsto.

5. **Monitoraggio**
   - Monitora errori applicativi (500/API) dopo il deploy.
   - Se emergono problemi di permessi, controlla prima le policy RLS prima di toccare lo schema.

## Troubleshooting

- **400 su `profiles` o 404 su `legal_versions` / `dashboard_chat_messages` / `dashboard_chat_history`**  
  Lo schema in produzione non è aggiornato. Esegui `supabase/lexora_schema_rebuild.sql` nel SQL Editor del progetto (vedi checklist sopra).

- **CORS / 401 su Edge Functions (`sync-subscription`, `credits-get-status`, `public-health`)**  
  La preflight OPTIONS non invia `Authorization`; se la piattaforma applica la verifica JWT, la preflight riceve 401 prima di arrivare al handler. Le tre funzioni hanno `verify_jwt = false` in `config.toml` e in `supabase.function.config.json`. Ridistribuisci le funzioni e in Dashboard → Edge Functions verifica che “Enforce JWT” sia disattivato. Tutte le risposte (inclusi errori) devono includere `corsHeaders`.
