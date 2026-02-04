# Supabase Reconnect — Audit (Expected DB Objects)

Questo documento elenca tutti gli oggetti DB, storage, RPC e Edge Functions che il codice Lexora si aspetta dopo la riconnessione al nuovo Supabase.

---

## 1. Tabelle richieste

| Tabella | Uso principale | Migration |
|---------|----------------|-----------|
| `profiles` | Auth, preferenze, payment_status, access_state | 20251225055151 |
| `user_roles` | Ruoli (admin/user), `is_admin()` | 20260103132904 |
| `pratiche` | Casi/pratiche utente | 20251225055151 |
| `documents` | Documenti per pratica, OCR, file_url | 20251225070959 |
| `dashboard_chat_messages` | Chat dashboard | 20260112125734 |
| `dashboard_chat_history` | Storico chat dashboard | 20260112125734 |
| `case_chat_messages` | Chat per pratica | 20260131181009 |
| `case_context_pack` | Contesto per chat pratica | 20260131180235 |
| `legal_versions` | Versioni terms/privacy/disclaimer | 20260128185035 |
| `user_legal_acceptances` | Accettazioni legali utente | 20260128185035 |
| `legal_acceptance_events` | Eventi accettazione (audit) | 20260106225251 |
| `plan_overrides` | Override piano admin | 20260103090509 |
| `plan_override_audit` | Audit override | 20260103090509 |
| `user_subscriptions` | Piano Stripe, period_end (entitlements) | 20251227150525 |
| `user_usage` | cases_created (entitlements/legacy) | 20251227150525 |
| `subscriptions_state` | Stato subscription (credits-*) | 20260115083802 |
| `user_wallet` | Crediti (credits-*) | 20260115083802 |
| `credit_ledger` | Movimenti crediti | 20260115083802 |
| `usage_counters_monthly` | uploads/ocr_pages/chat_messages (RPC consume_usage) | 20260204000000 |
| `plan_limits` | Limiti per piano | 20260204000000 |
| `user_plan` | Piano corrente (get_usage_and_limits) | 20260204000000 |
| `usage_events` | Audit uso | 20260204000000 |
| `global_stats` | Contatori pubblici (es. documenti processati) | 20260128023950 |
| `ai_sessions` | Sessioni AI | 20260115084855 |
| `subscriptions` | (Stripe) subscription details | 20251227112731 |

---

## 2. RPC richieste

| RPC | Uso | Note |
|-----|-----|------|
| `is_admin()` | AdminPanel, ProtectedRoute, AdminUsage | Ritorna boolean da user_roles |
| `get_usage_and_limits(p_user_id uuid, p_month date)` | Edge: create-case, ecc. | Crea user_plan/usage_counters se mancanti |
| `consume_usage(p_user_id, p_month, p_metric, p_amount)` | Edge: create-case (metric: 'uploads') | Solo service_role; ritorna 402 se limite superato |
| `increment_documents_processed` | DemoChatSection (global_stats) | Se assente, degradare gracefully |

---

## 3. Storage bucket richiesti

| Bucket | Visibilità | Path atteso | Migration |
|--------|------------|-------------|-----------|
| `pratiche-files` | private | `{user_id}/{pratica_id}/{filename}` o `{user_id}/...` | 20251225061854 |

Policies: lettura/scrittura/delete solo per `auth.uid()` sul proprio path (primo segmento = user_id).

---

## 4. Edge Functions richieste

| Funzione | Uso |
|----------|-----|
| `entitlements` | Limiti piano, can_create_case, admin override, user_subscriptions/user_usage |
| `create-case` | Crea pratica, consume_usage('uploads'), storage |
| `analyze-letter` | Analisi lettera (OCR/rischi/deadline) |
| `analyze-document` | Analisi documento (upload flow) |
| `chat-with-ai` | Chat per pratica |
| `dashboard-chat` | Chat dashboard (general o case mode) |
| `admin-user-metrics` | Metriche utente (admin) |
| `admin-force-unlimited` | Forza unlimited (admin) |
| `admin-user-lookup` | Cerca utente (admin) |
| `admin-save-override` | Salva override piano (admin) |
| `admin-set-override` | Imposta override (admin) |
| `usage-inspector` | Ispezione uso (admin) |
| `credits-selftest-lite` | Self-test crediti |
| `credits-get-status` | Stato crediti |
| `credits-consume` | Consuma crediti |
| `send-support-email` | Email supporto |
| `send-contact-email` | Email contatto |
| `sync-subscription` | Sincronizza Stripe → user_subscriptions |
| `create-checkout` | Checkout Stripe |
| `customer-portal` | Portal Stripe |
| `geo-check` | Geo-block / paese |
| `auth-health` | Verifica token (non DB) |
| `health` | Healthcheck DB + bucket (opzionale, vedi sotto) |

---

## 5. Variabili d'ambiente

### Frontend (Vite / Vercel)

| Variabile | Uso |
|-----------|-----|
| `VITE_SUPABASE_URL` | URL progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY` | Chiave anon |
| `VITE_SERP_API_KEY` | (opzionale) SEO |
| `VITE_OCR_API_ORIGIN` | (opzionale) OCR esterno |
| `VITE_DEMO_MODE` | (opzionale) Demo |

### Supabase Edge Functions (secrets)

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | Client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Scritture service role (consume_usage, admin, ecc.) |
| `SUPABASE_ANON_KEY` | auth-health |
| `OPENAI_API_KEY` | Chat / analisi AI |
| `GOOGLE_VISION_API_KEY` | OCR (se usato) |
| `STRIPE_SECRET_KEY` | Checkout / webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook Stripe |

### Vercel (se usato per API/SSR)

| Variabile | Uso |
|-----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | (se app Next) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (se app Next) |
| `OPENAI_API_KEY` | (se API server-side) |
| `STRIPE_*` | Webhook / checkout |

---

## 6. Note compatibilità

- **Due sistemi uso**: (1) `user_subscriptions` + `user_usage` (cases_created) usati da **entitlements** per UI e limite “pratiche”; (2) `user_plan` + `usage_counters_monthly` + `get_usage_and_limits` / `consume_usage` usati da **create-case** per limite “uploads” e da altre edge per ocr_pages/chat_messages. Entrambi devono esistere.
- **Bucket**: il client usa sempre `storage.from('pratiche-files')`; il nome bucket deve essere `pratiche-files`.
- **Admin**: allowlist email (es. imbimbo.bassman@gmail.com) in entitlements e in admin-save-override; ruolo in `user_roles` e/o `profiles.is_admin` per `is_admin()`.
