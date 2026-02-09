# Lexora Piani e Stripe Integration

## Overview

Questo documento descrive la configurazione ufficiale dei piani di abbonamento Lexora e la loro integrazione con Stripe.

## Piani Disponibili

### 1. Free (€0/mese)
- **Prezzo**: €0/mese
- **Limite pratiche**: 1 pratica/mese
- **Limite messaggi chat**: 15 messaggi/giorno
- **Features**: Scan letter, AI draft, AI chat
- **Stripe**: Non applicabile (piano gratuito)

### 2. Starter (€3.99/mese)
- **Prezzo**: €3.99/mese
- **Limite pratiche**: 5 pratiche/mese
- **Limite messaggi chat**: Illimitati
- **Features**: Tutte le features free + PDF export, print, email
- **Stripe Price ID**: `price_1SivfMKG0eqN9CTOVXhLdPo7`

### 3. Plus (€9.99/mese) - *Popolare*
- **Prezzo**: €9.99/mese
- **Limite pratiche**: 20 pratiche/mese
- **Limite messaggi chat**: Illimitati
- **Features**: Tutte le features starter
- **Stripe Price ID**: `price_1SivfjKG0eqN9CTOXzYLuH7v`

### 4. Pro (€19.99/mese)
- **Prezzo**: €19.99/mese
- **Limite pratiche**: Illimitate
- **Limite messaggi chat**: Illimitati
- **Features**: Tutte le features plus + urgent reply
- **Stripe Price ID**: `price_1Sivg3KG0eqN9CTORmNvZX1Z`

## Sorgenti di Verità

### 1. Backend Configuration
- **File**: `supabase/functions/_shared/plans.ts`
- **Scopo**: Configurazione centralizzata dei piani per tutto il backend
- **Contiene**: Limiti, prezzi, Stripe price IDs, features

### 2. Frontend Configuration
- **File**: `src/lib/subscriptionPlans.ts`
- **Scopo**: Configurazione piani per UI frontend
- **Contiene**: Stessa configurazione del backend per consistenza

## Flusso di Upgrade

1. **UI Selection**: Utente seleziona piano nella pricing page
2. **Checkout Creation**: 
   - Frontend chiama `create-checkout` Edge Function
   - Backend valida piano e crea sessione Stripe
   - Stripe price ID mappato dal piano selezionato
3. **Payment Processing**: 
   - Utente completa pagamento su Stripe
   - Stripe genera webhook events
4. **Webhook Processing**:
   - `stripe-webhook` Edge Function riceve eventi
   - Aggiorna `user_subscriptions` e `profiles` tables
   - Imposta limiti corretti per il piano
5. **Access Grant**:
   - Sistema applica limiti in base al piano attivo
   - Free: 1 pratica/mese, 15 messaggi/giorno
   - Paid: Limiti specifici del piano o illimitati

## Mapping Stripe Price ID → Piano

| Stripe Price ID | Piano |
|----------------|-------|
| `price_1SivfMKG0eqN9CTOVXhLdPo7` | Starter |
| `price_1SivfjKG0eqN9CTOXzYLuH7v` | Plus |
| `price_1Sivg3KG0eqN9CTORmNvZX1Z` | Pro |

## Legacy Mapping

Per compatibilità con vecchi riferimenti:

| Vecchio Piano | Nuovo Piano |
|--------------|--------------|
| `basic` | `starter` |
| `unlimited` | `pro` |

## Limit Enforcement

### Case Limits
- **Free**: 1 pratica/mese (hard limit)
- **Starter**: 5 pratiche/mese
- **Plus**: 20 pratiche/mese  
- **Pro**: Illimitate (null limit)

### Chat Message Limits
- **Free**: 15 messaggi/giorno (daily reset)
- **Starter/Plus/Pro**: Illimitati

### Enforcement Points
1. **Case Creation**: `create-case` Edge Function controlla limiti mensili
2. **Chat Messages**: `DashboardAIChat` component controlla limiti giornalieri
3. **Real-time Validation**: Frontend mostra popup quando limiti sono raggiunti

## Database Tables

### `user_subscriptions`
- `plan_key`: Piano corrente dell'utente
- `status`: active, canceled, past_due
- `stripe_subscription_id`: Riferimento a Stripe
- `current_period_end`: Fine periodo corrente

### `profiles`
- `plan`: Piano corrente (legacy compatibility)
- `cases_limit`: Limite pratiche (999999 per illimitato)
- `access_state`: active, blocked
- `stripe_status`: Stato subscription Stripe

### `subscriptions_state`
- `plan`: Piano corrente
- `monthly_case_limit`: Limite pratiche mensili
- `is_active`: Stato abbonamento

## Edge Functions

### `create-checkout`
- Accetta solo piani paid (starter, plus, pro)
- Usa price ID dal file di configurazione
- Crea sessione Stripe con metadata utente

### `stripe-webhook`
- Processa tutti gli eventi Stripe
- Aggiorna database con piano corretto
- Gestisce upgrade, downgrade, cancellazione

### `create-case`
- Enforza limiti pratiche mensili
- Blocca creazione se limite raggiunto
- Admin bypass per utenti speciali

### `credits-get-status`
- Restituisce stato limiti correnti
- Calcola pratiche rimanenti
- Determina se utente è at limit

## Testing

### Test Cases da Verificare
1. **Free User**: Può creare 1 pratica, 15 messaggi chat
2. **Starter User**: Può creare 5 pratiche, messaggi illimitati
3. **Plus User**: Può creare 20 pratiche, messaggi illimitati
4. **Pro User**: Pratiche e messaggi illimitati
5. **Upgrade**: Transizione corretta da free a paid
6. **Downgrade**: Transizione corretta da paid a free
7. **Limit Reached**: Popup corretti quando limiti raggiunti

## Note Importanti

1. **Single Source of Truth**: Tutta la configurazione piani deve venire da `supabase/functions/_shared/plans.ts`
2. **Legacy Compatibility**: Vecchi riferimenti mappati ai nuovi piani
3. **Null Limits**: `null` significa illimitato nel sistema
4. **Admin Bypass**: Admin hanno accesso illimitato indipendentemente dal piano
5. **Family Protection**: Utenti con `is_family=true` sono protetti da modifiche Stripe

## Troubleshooting

### Problemi Comuni
1. **Limiti non applicati**: Verificare che `subscriptions_state` sia popolato correttamente
2. **Stripe webhook fallisce**: Controllare logging e mappatura price ID
3. **UI mostra piano sbagliato**: Verificare configurazione frontend
4. **Upgrade non processato**: Controllare che webhook events siano ricevuti

### Debug Steps
1. Verificare configurazione in `_shared/plans.ts`
2. Controllare logging Edge Functions
3. Verificare dati utente in database
4. Testare flusso completo con Stripe test mode
