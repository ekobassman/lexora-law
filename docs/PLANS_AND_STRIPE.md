# Lexora – Piani e integrazione Stripe

## Sorgente di verità

- **Frontend (UI e limiti display):** `src/lib/subscriptionPlans.ts`  
  - Piani: `free`, `starter`, `plus`, `pro`  
  - Per ogni piano: `maxCases`, `maxChatMessagesPerDay`, `price`, `features`

- **Backend (Edge Functions):** `supabase/functions/_shared/plans.ts`  
  - `PLAN_LIMITS`: `max_cases_per_month`, `max_chat_messages_per_day`  
  - `getMonthlyCaseLimitForDb(planKey)` → valore per `subscriptions_state.monthly_case_limit` (pro = 999999)  
  - `normalizePlanKey()` → mappa `unlimited`→`pro`, `basic`→`starter`, `professional`→`plus`  
  - `getPriceToPlanMap(env)` → da env `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`

## Piani e limiti

| Piano   | Prezzo   | Pratiche/mese | Messaggi chat/giorno |
|--------|----------|----------------|------------------------|
| Free   | 0 €      | 1             | 15                    |
| Starter| 3,99 €   | 5             | illimitati            |
| Plus   | 9,99 €   | 20            | illimitati            |
| Pro    | 19,99 €  | illimitate    | illimitati            |

## Stripe

- **Prodotti/prezzi:** creare in Stripe (o usare esistenti) 3 prezzi ricorrenti mensili:  
  Starter 3,99 €, Plus 9,99 €, Pro 19,99 €.  
  Impostare in Supabase (Secrets) le variabili:  
  `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO` (es. `price_xxx`).

- **Checkout:**  
  - Edge Function `create-checkout`: accetta `body.plan` = `starter` | `plus` | `pro` (rifiuta `free`).  
  - Crea sessione Stripe Checkout in modalità `subscription`, con `client_reference_id` = `user.id` e `metadata.user_id` / `metadata.plan_key`.  
  - Success URL: `{origin}/app?checkout=success&plan=...`

- **Webhook Stripe** (`stripe-webhook`):  
  - Su `customer.subscription.*` (created/updated/deleted) risolve l’utente da `client_reference_id` o da `subscription.metadata.user_id`.  
  - Legge il price ID dalla subscription → `getPriceToPlanMap(env)` → `plan_key` (starter/plus/pro).  
  - Se nessuna subscription attiva → `plan_key = free`.  
  - Aggiorna:  
    - `user_subscriptions`: `plan_key`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`  
    - `profiles`: `plan`, `stripe_*`, `cases_limit`, `access_state`  
    - `subscriptions_state`: `plan`, `monthly_case_limit` (da `getMonthlyCaseLimitForDb(planKey)`)  
  - Utenti con `profiles.is_family` o `profiles.plan_override` non vengono sovrascritti da Stripe.

- **Sync subscription** (`sync-subscription`):  
  - Chiamata dal frontend (es. dopo login / pagina Subscription).  
  - Legge `stripe_customer_id` da profilo, lista subscription Stripe, e allinea `user_subscriptions` + `profiles` + `subscriptions_state` con la stessa logica del webhook.

## Collegamento piano ↔ utente (Supabase)

- **user_subscriptions** (una riga per utente):  
  `user_id`, `plan_key`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`

- **profiles**:  
  `plan`, `cases_limit`, `stripe_customer_id`, `stripe_subscription_id`, `access_state`, `payment_status`

- **subscriptions_state**:  
  `user_id`, `plan`, `monthly_case_limit`, `is_active`  
  Usato da `create-case` e `credits-get-status` per limiti pratiche.

Il piano effettivo viene letto da: override admin (se attivo) → altrimenti `user_subscriptions` (se status active/trialing/past_due) → altrimenti `free`.

## Applicazione limiti

- **Creazione pratica** (`create-case`):  
  - Legge `subscriptions_state` (plan, `monthly_case_limit`) e `usage_counters_monthly.cases_created` per il mese corrente.  
  - Se `plan` è `pro` (o `unlimited`) → nessun limite.  
  - Altrimenti se `cases_created >= monthly_case_limit` → 403 con `PRACTICE_LIMIT_REACHED` e messaggio tipo: “Limite pratiche mensili raggiunto. Passa a un piano superiore per continuare.”

- **Messaggi chat** (`dashboard-chat`):  
  - Solo piano **free**: conta messaggi utente nel giorno (calendario) e se ≥ 15 rifiuta con messaggio “Limite giornaliero di 15 messaggi raggiunto con il piano Free. …”.  
  - Starter / Plus / Pro: nessun limite messaggi.

## UI

- **Homepage (PricingSection):**  
  - 4 card: Free, Starter, Plus, Pro (prezzi e testi da `subscriptionPlans` + i18n).  
  - Se utente **non** loggato: pulsante → link a signup (es. `/auth?mode=signup&plan=starter`).  
  - Se utente loggato e piano a pagamento: pulsante “Upgrade” → `createCheckoutSession(planKey)` → redirect a Stripe Checkout.

- **Dashboard / Subscription:**  
  - Mostra piano corrente (getPlanConfig(entitlements.plan)), uso pratiche (X / limite o ∞), per Free anche “Chat: 15 messages/day”.  
  - Pulsanti “Upgrade” per gli altri piani → stessa `createCheckoutSession(planKey)` → Stripe.  
  - “Manage billing” → Customer Portal Stripe (Edge Function `customer-portal`).

## Flusso completo: click piano → Stripe → webhook → limiti

1. Utente clicca “Upgrade” (Starter/Plus/Pro) in homepage o in Subscription.  
2. Frontend chiama `create-checkout` con `{ plan: 'starter' | 'plus' | 'pro' }`.  
3. `create-checkout` crea Stripe Checkout Session (subscription) e restituisce `url`.  
4. Frontend reindirizza a Stripe; utente completa pagamento.  
5. Stripe invia webhook (es. `customer.subscription.created` / `updated`).  
6. `stripe-webhook` aggiorna `user_subscriptions`, `profiles`, `subscriptions_state` con il `plan_key` e `monthly_case_limit` corretti.  
7. `create-case` e `dashboard-chat` leggono da `subscriptions_state` / entitlements e applicano i limiti (pratiche/mese e, solo Free, 15 messaggi/giorno).

## File principali

| Ruolo | File |
|-------|------|
| Config piani frontend | `src/lib/subscriptionPlans.ts` |
| Config piani backend | `supabase/functions/_shared/plans.ts` |
| Checkout Stripe | `supabase/functions/create-checkout/index.ts` |
| Webhook Stripe | `supabase/functions/stripe-webhook/index.ts` |
| Sync subscription | `supabase/functions/sync-subscription/index.ts` |
| Entitlements | `supabase/functions/entitlements/index.ts` |
| Limite pratiche | `supabase/functions/create-case/index.ts` |
| Limite messaggi chat | `supabase/functions/dashboard-chat/index.ts` |
| Crediti / status | `supabase/functions/credits-get-status/index.ts` |
| UI pricing homepage | `src/components/landing/PricingSection.tsx` |
| Pagina Subscription | `src/pages/Subscription.tsx` |
| Hook checkout | `src/hooks/useCheckout.ts` |

## Compatibilità legacy

- I piani `unlimited`, `basic`, `professional` sono mappati in codice a `pro`, `starter`, `plus` (normalizePlanKey / LEGACY_PLAN_MAP).  
- L’API entitlements e credits-get-status restituiscono sempre `plan` normalizzato (free/starter/plus/pro).  
- In DB può restare `plan_key = 'unlimited'` per vecchie subscription; il webhook e la logica di lettura lo trattano come Pro.
