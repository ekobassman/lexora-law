# Checklist test post-migrazione Lexora

## Verifica codice (completata)

| Controllo | Stato | Dettaglio |
|-----------|--------|-----------|
| **Supabase URL** | OK | Nessun URL hardcoded. Tutti i componenti usano `import.meta.env.VITE_SUPABASE_URL` (in Vercel = `https://wzpxxlkfxymelrodjarl.supabase.co`) |
| **Chat Demo (Homepage)** | OK | `DemoChatSection.tsx` → `${VITE_SUPABASE_URL}/functions/v1/homepage-trial-chat` |
| **Dashboard Chat** | OK | `DashboardAIChat.tsx` → `${VITE_SUPABASE_URL}/functions/v1/dashboard-chat` |
| **Chat Pratica (Edit/Dettaglio)** | OK | `ChatWithAI.tsx` (usato in `EditPratica.tsx` e `DettaglioPratica.tsx`) → `${VITE_SUPABASE_URL}/functions/v1/chat-with-ai` |
| **Chiamate API /api/** | OK | OCR usa path relativo `/api/ocr` → in prod diventa `https://www.lexora-law.com/api/ocr` |
| **OPENAI su Vercel** | OK | `api/ocr.ts` usa `process.env.OPENAI_API_KEY` (configurato in Vercel) |
| **OPENAI su Supabase** | Da verificare | Le 3 chat usano **Supabase Edge Functions**, che leggono `OPENAI_API_KEY` da **Supabase Secrets** (non da Vercel). Verifica in Supabase Dashboard → Project wzpxxlkfxymelrodjarl → Edge Functions → Secrets |

**Riepilogo:** Nessuna correzione necessaria nel codice. Le variabili Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`) sono usate correttamente. Per le chat, assicurati che `OPENAI_API_KEY` sia impostata anche nei **Supabase Edge Function secrets** del progetto `wzpxxlkfxymelrodjarl`.

---

## Test manuali (da eseguire in browser)

### Test 1: Homepage – Chat Demo
- [ ] Vai su https://www.lexora-law.com
- [ ] Scorri alla sezione chat demo
- [ ] Scrivi: "Ciao, ho un problema con il contratto di lavoro"
- [ ] **Risultato atteso:** Risponde entro ~5 secondi, flusso domande attivo
- [ ] **Errore:** Loading infinito / messaggio errore / non risponde

### Test 2: Dashboard – Chat AI (utente loggato)
- [ ] Login con account test
- [ ] Vai su `/dashboard`
- [ ] Apri chat AI (bottone in basso a destra o sidebar)
- [ ] Scrivi: "Quali sono le mie pratiche recenti?"
- [ ] **Risultato atteso:** Elenca pratiche o risponde correttamente
- [ ] **Errore:** "Errore connessione" / risposta vuota / timeout

### Test 3: Modifica Pratica – Chat
- [ ] Vai su "Le Mie Pratiche"
- [ ] Clicca una pratica esistente (o crea nuova)
- [ ] Nella pagina dettaglio, trova la chat assistente
- [ ] Scrivi: "Cosa devo fare per questa pratica?"
- [ ] **Risultato atteso:** Risposta contestualizzata alla pratica
- [ ] **Errore:** Chat non carica / risposta generica / errore 500

---

## Debug rapido

**Errori browser:** F12 → Console → cerca errori rossi → copia testo.

**Log Vercel (PowerShell/Git Bash):**
```bash
cd ~/OneDrive/Desktop/LEXORA/lexora-law-main
npx vercel logs lexora-law --tail
```

**Log Supabase Edge Function (es. homepage-trial-chat):**
```bash
npx supabase functions logs homepage-trial-chat --project-ref wzpxxlkfxymelrodjarl --tail
```
