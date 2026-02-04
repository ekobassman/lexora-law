# Lexora — Supabase Reconnect Report

Report finale dopo la riconnessione al nuovo Supabase: cosa è stato creato, TODO rimanenti e come testare in 5 click.

---

## 1. Cosa è stato creato / aggiornato

### Database

- **Migration `20260204000000_plan_limits_usage_counters_rpc.sql`**
  - Eliminata RPC `increment_cases_created` e vecchia tabella `usage_counters_monthly`.
  - Create/aggiornate: `plan_limits`, `user_plan`, `usage_counters_monthly` (nuovo schema: `month`, `uploads_count`, `ocr_pages_count`, `chat_messages_count`), `usage_events`.
  - RPC: `get_usage_and_limits(p_user_id, p_month)` (crea righe mancanti), `consume_usage(p_user_id, p_month, p_metric, p_amount)` (solo service_role).
  - RLS: lettura propria su `user_plan`, `usage_counters_monthly`, `usage_events`; scritture solo da Edge con service role.

### Edge Functions

- **create-case**: usa `callEdgeFunction` (fetch) per leggere il body di errore; chiama `consume_usage(..., 'uploads', 1)`; ritorna 402 con codice `LIMIT_UPLOADS` / `LIMIT_OCR` / `LIMIT_CHAT` e messaggio chiaro.
- **health** (nuova): GET/POST senza auth; verifica connessione DB, esistenza tabelle `profiles`, `pratiche`, `user_plan`, `usage_counters_monthly` e bucket `pratiche-files`; risposta JSON con `ok`, `code`, `checks` (200 o 500).

### Client

- **ScanDocument.tsx / NewPratica.tsx**: chiamate a create-case e analyze-letter tramite `callEdgeFunction`; gestione 402 (paywall/limiti) e messaggi di errore estesi.
- **useEntitlements**: se il fetch entitlements fallisce, fallback `can_create_case: true` per non bloccare l’UI; i limiti restano applicati lato Edge.

### Documentazione

- **docs/supabase-reconnect-audit.md**: elenco tabelle, RPC, bucket, Edge Functions e env richieste dal codice.
- **docs/DEPLOY_COMMANDS.md**: istruzioni per applicare la migration (SQL Editor + Reload schema cache) e deploy Edge Functions.

---

## 2. TODO rimanenti (non bloccanti)

| TODO | Descrizione |
|------|-------------|
| **Stripe price IDs** | Se mancano in env (es. `STRIPE_PRICE_*`), aggiungere TODO in codice e configurare in Stripe Dashboard + Vercel/Supabase secrets. Non blocca upload/OCR/chat/draft. |
| **increment_documents_processed** | Usato da `DemoChatSection`; se la RPC non esiste, gestire graceful (try/catch, no crash). |
| **Entitlements vs usage_counters_monthly** | Entitlements usa ancora `user_subscriptions` + `user_usage` (cases_created); create-case usa `consume_usage` (uploads). Entrambi i sistemi devono esistere; eventuale unificazione futura. |
| **OPENAI / GOOGLE_VISION** | Verificare che i secrets Supabase per le Edge Functions (chat, OCR, analyze) siano impostati. |

---

## 3. Come testare in 5 click (upload → OCR → analyze → chat → draft)

1. **Login**  
   Vai su app Lexora e accedi con un utente test.

2. **Upload / Camera**  
   Crea una nuova pratica (es. “Lettera ufficiale”) e carica un’immagine (upload o foto).  
   - **Atteso:** upload su bucket `pratiche-files`, record in `documents` e, se applicabile, chiamata a create-case con consumo `uploads`.  
   - **Errore 402:** messaggio di limite raggiunto (paywall); nessun crash.

3. **OCR**  
   Se il flusso prevede OCR dopo l’upload, avvia l’analisi (es. “Analizza lettera”).  
   - **Atteso:** testo estratto e salvato (es. `letter_text` su pratica o `raw_text` su document).  
   - **Fallback:** se OCR non configurato o fallisce, messaggio chiaro senza crash.

4. **Analisi**  
   Avvia “Analizza” (rischi / scadenze).  
   - **Atteso:** rischi/deadline salvati sulla pratica; eventuale consumo `ocr_pages` o `uploads` secondo le Edge.

5. **Chat**  
   Nella stessa pratica apri la chat e invia un messaggio (es. “Cosa devo fare?”).  
   - **Atteso:** risposta contestualizzata; consumo messaggi se previsto da `consume_usage('chat_messages')`.

6. **Draft**  
   Genera una bozza di risposta (es. “Genera bozza”).  
   - **Atteso:** contenuto salvato in pratica (es. `draft_response`) o in tabella draft; nessun crash se una tabella non esiste (degradare gracefully).

Per verificare lo stato backend prima dei test:

- **Healthcheck:**  
  `GET https://<project-ref>.supabase.co/functions/v1/health`  
  Risposta `200` con `ok: true` e `checks` tutti ok indica DB e bucket pronti.

---

## 4. Comandi utili

```bash
# Applica migration (dopo averla eseguita nel SQL Editor)
npx supabase db push

# Deploy Edge Function health
npx supabase functions deploy health --project-ref wzpxxlkfxymelrodjarl

# Deploy create-case
npx supabase functions deploy create-case --project-ref wzpxxlkfxymelrodjarl

# Log create-case
npx supabase functions logs create-case --project-ref wzpxxlkfxymelrodjarl --tail
```

**Project ref Supabase:** `wzpxxlkfxymelrodjarl`

---

## 5. Test E2E eseguiti

- **Suite Playwright**: 11 test passati (Chromium), 1 skipped (health se env non impostato).
- **Correzioni test**: `auth.spec.ts` — redirect a `/login` o `/auth`; flusso registrazione su `/signup` con form `#signup-email` / `#signup-password`.
- **Nuovo**: `health.spec.ts` — verifica GET `/functions/v1/health` quando `VITE_SUPABASE_URL` o `SUPABASE_URL` è impostato.
- Comando: `npx playwright test --project=chromium`
