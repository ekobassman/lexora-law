-- Allow anon and authenticated to call increment_documents_processed (e.g. dashboard chat creates case, client-side fallback)
GRANT EXECUTE ON FUNCTION public.increment_documents_processed() TO anon;
GRANT EXECUTE ON FUNCTION public.increment_documents_processed() TO authenticated;
