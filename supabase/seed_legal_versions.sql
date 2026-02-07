-- Inserisce/aggiorna le tre versioni legali che il frontend si aspetta.
-- Eseguire una volta in produzione (SQL Editor) dopo lexora_schema_rebuild.sql.
-- La stringa version DEVE coincidere con src/lib/legalVersions.ts (TERMS_VERSION, PRIVACY_VERSION, DISCLAIMER_VERSION).
-- Verifica: SELECT * FROM public.legal_versions; devono esserci terms, privacy, disclaimer con version = '2026-01-28'.

INSERT INTO public.legal_versions (doc_type, version, published_at, summary)
VALUES
  ('terms',      '2026-01-28', now(), 'Terms of Service 2026-01-28'),
  ('privacy',    '2026-01-28', now(), 'Privacy Policy 2026-01-28'),
  ('disclaimer', '2026-01-28', now(), 'Disclaimer 2026-01-28')
ON CONFLICT (doc_type) DO UPDATE
  SET version      = EXCLUDED.version,
      published_at = EXCLUDED.published_at,
      summary      = EXCLUDED.summary;
