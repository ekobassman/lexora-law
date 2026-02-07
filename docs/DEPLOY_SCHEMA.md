# Deploy aggiornamenti schema (Lexora + Stripe)

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
