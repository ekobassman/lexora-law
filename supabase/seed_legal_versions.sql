-- Inserisce/aggiorna le tre versioni legali che il frontend si aspetta.
-- Eseguire una volta in produzione (SQL Editor) dopo lexora_schema_rebuild.sql.
-- Versioni allineate a src/lib/legalVersions.ts (TERMS_VERSION, PRIVACY_VERSION, DISCLAIMER_VERSION).

INSERT INTO public.legal_versions (doc_type, version, published_at, summary)
VALUES
  ('terms',      '2026-01-28', now(), 'Terms of Service 2026-01-28'),
  ('privacy',    '2026-01-28', now(), 'Privacy Policy 2026-01-28'),
  ('disclaimer', '2026-01-28', now(), 'Disclaimer 2026-01-28')
ON CONFLICT (doc_type) DO UPDATE
  SET version      = EXCLUDED.version,
      published_at = EXCLUDED.published_at,
      summary      = EXCLUDED.summary;
