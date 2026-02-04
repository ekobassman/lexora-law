# Lexora — Process Document Pipeline (Upload + OCR)

Pipeline unico: upload e OCR in un’unica Edge Function deterministica con log. Niente più “non carica / non legge”.

## Obiettivo

- **Un solo endpoint:** `POST /functions/v1/process-document` (multipart file o JSON base64).
- **OCR:** OpenAI Vision per immagini; PDF non supportato (status `ocr_failed`, code `PDF_NOT_SUPPORTED`).
- **Log:** ogni step registrato in `public.pipeline_runs` per debug.

---

## A) DB e log (idempotente)

### 1. public.documents (minimo)

| Colonna         | Tipo        | Note                                      |
|-----------------|-------------|-------------------------------------------|
| id              | uuid        | PK, default `gen_random_uuid()`           |
| user_id         | uuid        | NOT NULL                                  |
| case_id         | uuid        | NULL (pratica/case opzionale)             |
| storage_bucket  | text        | NOT NULL default `'documents'`            |
| storage_path    | text        | NOT NULL                                  |
| file_name       | text        | NOT NULL                                  |
| mime_type       | text        | NOT NULL                                  |
| size_bytes      | int         | NOT NULL                                  |
| status          | text        | NOT NULL default `'uploaded'` — `uploaded` \| `ocr_done` \| `ocr_failed` |
| ocr_text        | text        | NULL                                      |
| ocr_error       | text        | NULL                                      |
| created_at      | timestamptz | default now()                             |
| updated_at      | timestamptz | default now()                             |

### 2. public.pipeline_runs (debug)

| Colonna   | Tipo        | Note                |
|-----------|-------------|---------------------|
| id        | bigserial   | PK                   |
| user_id   | uuid        |                     |
| doc_id    | uuid        | NULL                |
| step      | text        | NOT NULL            |
| ok        | boolean     | NOT NULL            |
| code      | text        | NULL                |
| message   | text        | NULL                |
| meta      | jsonb       | default '{}'        |
| created_at| timestamptz | default now()       |

### 3. RLS

- **documents:** owner SELECT; nessuna policy di scrittura per il client (scritture solo via service_role in Edge).
- **pipeline_runs:** owner SELECT; INSERT solo via service_role.

---

## B) Storage standard

- **Bucket:** `documents` (private).
- **Path:** `${userId}/${caseId || 'no-case'}/${Date.now()}-${safeFilename}`.
- **Policies:** owner read/write/list sul proprio prefix.

---

## C) Edge Function: process-document

**File:** `supabase/functions/process-document/index.ts`

### Comportamento

- **CORS + OPTIONS:** gestiti.
- **Auth:** richiede `Authorization: Bearer <JWT>`; estrae `user_id` da token.
- **Payload:** multipart/form-data (`file` obbligatorio, `caseId`, `source` opzionali) oppure JSON `{ base64, mimeType, caseId? }`.
- **Validazione:** max 10MB; MIME supportati: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Log:** inserimento in `pipeline_runs` ad ogni step (auth, upload_storage, insert_db, ocr, save_ocr, done / error).

### Flusso

1. **auth** → log.
2. **upload_storage** (SERVICE_ROLE) → upload su bucket `documents` → log.
3. **insert_db** (SERVICE_ROLE) → insert riga in `documents` → log.
4. **OCR:**
   - **Immagine:** OpenAI Vision OCR (base64 data URL → Chat Completions, prompt: “Extract ALL text exactly as it appears. Preserve line breaks. No commentary.”).
   - **PDF:** non si tenta OCR; `status = 'ocr_failed'`, `ocr_error` messaggio, code `PDF_NOT_SUPPORTED`, messaggio: “Convert PDF pages to images first.”
5. **save_ocr** → update `documents` (ocr_text, ocr_error, status, updated_at, raw_text) → log.
6. **done** → return 200 JSON.

### Secrets (Supabase Functions)

- `SUPABASE_URL` (obbligatorio)
- `SUPABASE_SERVICE_ROLE_KEY` (obbligatorio)
- `OPENAI_API_KEY` (opzionale: se mancante, upload ok, status `uploaded`, risposta con `warning: { ocr: 'disabled' }`)
- `OPENAI_MODEL_VISION` (opzionale, default: `gpt-4o-mini`)

### Risposte

- **Successo:** `200` con `{ ok: true, doc: { id, storage_path, status, has_text, text_preview }, run_id, ts, warning?, code?, message? }`. Per PDF: stesso 200 con `code: 'PDF_NOT_SUPPORTED'`, `message` hint.
- **Errore:** sempre JSON `{ ok: false, where, code, message, run_id?, ts }` (4xx/5xx). Mai throw non gestito; catch globale ritorna 500 con stesso formato.

---

## D) Client (solo 1 endpoint)

- **Chiamata unica:**  
  `POST ${SUPABASE_URL}/functions/v1/process-document`  
  Headers: `Authorization: Bearer session.access_token`  
  Body: multipart `file` + `caseId` (opzionale) oppure JSON `base64` + `mimeType` + `caseId?`.

- **Helper:** `src/lib/processDocumentClient.ts`  
  - `processDocumentWithFile(file, { caseId? })`  
  - `processDocumentWithBase64(base64, mimeType, { caseId? })`  
  - `isHeicFile(file)` / `HEIC_NOT_SUPPORTED_MSG` per bloccare HEIC con messaggio chiaro.

- **UI:**  
  - Se risposta `code === 'PDF_NOT_SUPPORTED'`: mostrare hint “Converti PDF in immagini (1-3 pagine) e ricarica.” (chiave i18n: `scan.pdfNotSupportedHint`).  
  - HEIC: bloccato lato client con messaggio “Le foto HEIC non sono supportate. Esporta in JPEG dall’album o scegli un file JPG/PNG.”

---

## E) HEIC (camera iPhone)

- **Client:** se il file è HEIC (tipo o estensione), non inviare a `process-document`; mostrare messaggio chiaro (vedi sopra). Nessuna libreria client-side di conversione HEIC→JPEG nel repo; si blocca con messaggio.

---

## F) Deploy

1. **Migration:** applicare `supabase/migrations/20260205100000_pipeline_documents_bucket.sql` (Supabase SQL Editor o `npx supabase db push`).
2. **Edge Function:**  
   `npx supabase functions deploy process-document --project-ref wzpxxlkfxymelrodjarl`
3. **Secrets:**  
   `npx supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... OPENAI_MODEL_VISION=gpt-4o-mini --project-ref wzpxxlkfxymelrodjarl`
4. **Frontend:** deploy come di consueto (es. Vercel).

---

## Criteri di done

- **Immagine:** file nel bucket `documents`, riga in `documents`, `ocr_text` popolato, `status = 'ocr_done'`.
- **PDF:** upload ok, riga in `documents`, `status = 'ocr_failed'`, `code = 'PDF_NOT_SUPPORTED'`, nessun crash; UI mostra hint di conversione.
- **pipeline_runs:** step-by-step visibili (auth, upload_storage, insert_db, ocr, save_ocr, done) per capire dove si blocca in caso di errore.
