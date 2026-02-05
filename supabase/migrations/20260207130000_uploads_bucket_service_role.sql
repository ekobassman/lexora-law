-- Allow Edge Functions (service_role) to read/write bucket "uploads" so ocr-document can download files.
-- Without this, auth.uid() is null in EF context and uploads_select_own fails.

DROP POLICY IF EXISTS "uploads_service_role_all" ON storage.objects;
CREATE POLICY "uploads_service_role_all"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'uploads' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'service_role');
