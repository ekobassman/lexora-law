# Guida Debug Errori Supabase

## 🚨 Problemi Riscontrati

- **HTTP 406** su `/rest/v1/profiles` e `/rest/v1/dashboard_chat_messages`
- **HTTP 500** da Edge Function `/functions/v1/create-case`
- Utente: `c06f14c1-efc6-4c80-8da6-70351ac1b394`
- Piano: `plan=free`, `status=active`

## 🔍 Cosa Fare Subito

### 1. Esegui Query SQL Console Supabase

Copia e incolla queste query nella console SQL di Supabase:

```sql
-- Verifica se utente esiste in profiles
SELECT id, email, created_at, last_seen_at, plan, age_confirmed, privacy_version, terms_version 
FROM profiles 
WHERE id = 'c06f14c1-efc6-4c80-8da6-70351ac1b394';

-- Verifica messaggi dashboard
SELECT COUNT(*) as messages_count, user_id, MAX(created_at) as last_message_at
FROM dashboard_chat_messages 
WHERE user_id = 'c06f14c1-efc6-4c80-8da6-70351ac1b394'
GROUP BY user_id;

-- Verifica struttura tabelle
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'dashboard_chat_messages')
ORDER BY table_name, ordinal_position;
```

### 2. Applica Policy RLS

Esegui le query nel file `docs/RLS_POLICIES.sql` nella console SQL.

### 3. Testa con Utente Reale

1. Fai login con l'utente specifico
2. Controlla console browser per errori
3. Verifica che i dati vengano caricati

## 🛠️ Soluzioni Implementate

### 1. Hook per Gestione 406

File: `src/hooks/useSafeProfile.ts`
- Gestisce automaticamente errore 406
- Non considera 406 come errore critico
- Log dettagliati per debug

### 2. Utility Debug

File: `src/utils/supabaseDebug.ts`
- Funzioni per log API call
- Mappatura errori comuni
- Query SQL per verifica

### 3. Policy RLS Corrette

File: `docs/RLS_POLICIES.sql`
- Policy per lettura/scrittura solo propri dati
- Verifica struttura tabelle
- Debug permessi utente

## 🎯 Come Usare le Soluzioni

### Nel Client TypeScript:

```typescript
import { useSafeProfile } from '@/hooks/useSafeProfile';
import { debugSupabaseError } from '@/utils/supabaseDebug';

function MyComponent() {
  const { data: profile, error, isLoading } = useSafeProfile();
  
  if (error) {
    const debugInfo = debugSupabaseError(error, 'profile-fetch');
    console.log('User message:', debugInfo.userMessage);
    
    if (debugInfo.isNotFound) {
      // Gestisci come "profilo non trovato"
      return <div>Crea il tuo profilo</div>;
    }
  }
  
  return <div>Bentornato {profile?.email}</div>;
}
```

### Nella Edge Function:

```typescript
import { debugSupabaseError } from '@/utils/supabaseDebug';

Deno.serve(async (req) => {
  try {
    // Tua logica qui
    const result = await someOperation();
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    const debugInfo = debugSupabaseError(error, 'create-case');
    
    console.error('[Edge Function Error]', {
      error: debugInfo.technical,
      userMessage: debugInfo.userMessage,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: "INTERNAL_ERROR", 
      message: debugInfo.userMessage,
      details: debugInfo.technical.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

## 📋 Checklist Debug

- [ ] Esegui query SQL verifica
- [ ] Applica policy RLS
- [ ] Testa con utente specifico
- [ ] Controlla log browser
- [ ] Verifica Edge Function logs
- [ ] Testa flusso completo

## 🚀 Prossimi Passi

1. **Applica le soluzioni** nel tuo progetto
2. **Testa con l'utente** specifico
3. **Controlla i log** per dettagli
4. **Risolvi eventuali** problemi residui

Per supporto, controlla i log generati dalle utility di debug!
