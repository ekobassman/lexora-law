# Lexora — Pipeline unico Upload + OCR

## Bucket e path

- **Bucket standard:** `documents` (private).
- **Path:** `${userId}/${caseId || 'no-case'}/${timestamp}-${safeFilename}`.
- **pratiche-files:** **Deprecato**. Mantenuto per compatibilità con dati esistenti; non usare per nuovi upload. Il client usa solo la Edge Function `process-document`, che scrive nel bucket `documents`.

## DB

- **public.documents:** colonne minime per il pipeline: `id`, `user_id`, `case_id`, `storage_bucket`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `status` (`uploaded` | `ocr_done` | `ocr_failed`), `ocr_text`, `ocr_error`, `created_at`, `updated_at`.
- **public.pipeline_runs:** log dei passi (auth, upload_storage, insert_db, ocr, save_ocr, done, error). Solo service_role inserisce; l’utente può leggere i propri (RLS).

## Edge Function: process-document

- **Endpoint:** `POST ${SUPABASE_URL}/functions/v1/process-document`
- **Auth:** Bearer JWT obbligatorio.
- **Body:** multipart (file + caseId opzionale) oppure JSON `{ base64, mimeType, caseId? }`.
- **Comportamento:** upload su bucket `documents`, insert/update su `documents`, log su `pipeline_runs`, OCR con Google Vision (se chiave presente). Risposta sempre JSON con `ok`, `where`, `code`, `message`, `ts`.
- **Secrets Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_VISION_API_KEY` (opzionale: senza chiave, upload ok ma OCR disabilitato con `warning: { ocr: 'disabled' }`).

## Client

- **ScanDocument / NewPratica:** una sola chiamata a `process-document` (file o base64); nessun upload diretto su storage né chiamata a `upload-document` o `ocr-google-vision`.
- **Helper:** `src/lib/processDocumentClient.ts` — `processDocumentWithFile(file, { caseId? })`, `processDocumentWithBase64(base64, mimeType, { caseId? })`.
- **UI:** se `ok: true` ma OCR disabilitato/fallito → messaggio “Caricato, OCR non disponibile” senza bloccare.

## Debug: Pipeline runs

- **Pagina:** `/admin/pipeline-runs` (solo admin). Mostra le ultime 20 righe di `pipeline_runs` per l’utente corrente (`auth.uid()`).
- **Link:** in Admin Panel, pulsante “Pipeline runs” in header.

## Deploy

1. **Migration:** eseguire `supabase/migrations/20260205100000_pipeline_documents_bucket.sql` nel SQL Editor Supabase (o `npx supabase db push` se il progetto è linkato).
2. **Edge Function:**  
   `npx supabase functions deploy process-document --project-ref wzpxxlkfxymelrodjarl`
3. **Secrets:**  
   `npx supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_VISION_API_KEY=... --project-ref wzpxxlkfxymelrodjarl`
4. **Vercel:** deploy frontend come di consueto.

## Criteri di successo

- Scatto/upload → file nel bucket `documents`, riga in `public.documents`, step in `pipeline_runs` con `ok = true`.
- `ocr_text` popolato se è configurata la chiave Vision.
- Nessun errore “non-2xx” senza JSON con `code` / `where`.
