-- Evita crescimento indefinido da trilha técnica usada no rate limit público.
BEGIN;

CREATE INDEX IF NOT EXISTS document_share_access_attempts_expiry
  ON public.document_share_access_attempts (attempted_at);

CREATE OR REPLACE FUNCTION public.cleanup_expired_document_share_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.document_share_access_attempts attempts
  WHERE attempts.attempted_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_expired_document_share_attempts_trigger
  ON public.document_share_access_attempts;
CREATE TRIGGER cleanup_expired_document_share_attempts_trigger
  BEFORE INSERT ON public.document_share_access_attempts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_expired_document_share_attempts();

REVOKE ALL ON FUNCTION public.cleanup_expired_document_share_attempts()
  FROM PUBLIC, anon, authenticated;

COMMIT;
