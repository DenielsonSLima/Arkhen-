-- Limita tentativas pela credencial compartilhada do grupo, sem perder o
-- documento solicitado em cada evento da trilha de auditoria.
BEGIN;

DROP INDEX IF EXISTS public.document_share_failed_attempts_lookup;
CREATE INDEX document_share_failed_attempts_lookup
  ON public.document_share_access_attempts (
    share_group_id,
    fingerprint,
    attempted_at DESC
  )
  WHERE success = false;

CREATE OR REPLACE FUNCTION public.resolve_public_document_share_access(
  p_share_group_id uuid,
  p_share_row_id uuid,
  p_password_hash text,
  p_fingerprint text
)
RETURNS TABLE (
  access_granted boolean,
  rate_limited boolean,
  storage_bucket text,
  storage_path text,
  expires_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_failed_count integer;
  v_bucket text;
  v_path text;
  v_expires_at timestamptz;
BEGIN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Fingerprint invalido.' USING ERRCODE = '22023';
  END IF;

  -- UUIDs arbitrarios nunca devem consumir armazenamento nem participar do lock.
  -- A Edge publica pode receber entradas hostis, por isso validamos primeiro que
  -- a linha solicitada pertence exatamente ao grupo informado.
  IF NOT EXISTS (
    SELECT 1
    FROM public.documentos_compartilhamentos dc
    WHERE dc.id = p_share_row_id
      AND dc.share_group_id = p_share_group_id
  ) THEN
    RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_share_group_id::text || ':' || p_fingerprint, 0)
  );

  DELETE FROM public.document_share_access_attempts attempts
  WHERE attempts.share_group_id = p_share_group_id
    AND attempts.fingerprint = p_fingerprint
    AND attempts.attempted_at < now() - interval '24 hours';

  SELECT count(*)::integer
  INTO v_failed_count
  FROM public.document_share_access_attempts attempts
  WHERE attempts.share_group_id = p_share_group_id
    AND attempts.fingerprint = p_fingerprint
    AND attempts.success = false
    AND attempts.attempted_at >= now() - interval '15 minutes';

  IF v_failed_count >= 10 THEN
    RETURN QUERY SELECT false, true, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF p_password_hash IS NOT NULL AND p_password_hash !~ '^[0-9a-fA-F]{64}$' THEN
    INSERT INTO public.document_share_access_attempts (
      share_group_id, share_row_id, fingerprint, success
    ) VALUES (p_share_group_id, p_share_row_id, p_fingerprint, false);
    RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT d.storage_bucket, d.storage_path, dc.expires_at
  INTO v_bucket, v_path, v_expires_at
  FROM public.documentos_compartilhamentos dc
  JOIN public.documentos d
    ON d.id = dc.documento_id
   AND d.empresa_id = dc.empresa_id
  WHERE dc.share_group_id = p_share_group_id
    AND dc.id = p_share_row_id
    AND dc.status = 'Ativo'
    AND dc.expires_at > now()
    AND (
      dc.senha_hash IS NULL
      OR dc.senha_hash = lower(p_password_hash)
    );

  IF v_bucket IS NULL OR v_path IS NULL THEN
    INSERT INTO public.document_share_access_attempts (
      share_group_id, share_row_id, fingerprint, success
    ) VALUES (p_share_group_id, p_share_row_id, p_fingerprint, false);
    RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, false, v_bucket, v_path, v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_document_share_access(
  uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_document_share_access(
  uuid, uuid, text, text
) TO service_role;

COMMIT;
