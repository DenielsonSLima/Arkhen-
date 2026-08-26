-- Fecha acessos cruzados entre tenants e remove leitura publica direta do Storage.
-- Downloads publicos passam a ser autorizados por uma Edge Function com URL assinada curta.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.documentos_compartilhamentos dc
    JOIN public.documentos d ON d.id = dc.documento_id
    WHERE d.empresa_id <> dc.empresa_id
  ) THEN
    RAISE EXCEPTION
      'Existem compartilhamentos ligados a documentos de outro tenant; corrija-os antes desta migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS documentos_id_empresa_unique
  ON public.documentos (id, empresa_id);

ALTER TABLE public.documentos_compartilhamentos
  DROP CONSTRAINT IF EXISTS documentos_compartilhamentos_documento_id_fkey,
  DROP CONSTRAINT IF EXISTS documentos_compartilhamentos_documento_empresa_fkey;

ALTER TABLE public.documentos_compartilhamentos
  ADD CONSTRAINT documentos_compartilhamentos_documento_empresa_fkey
  FOREIGN KEY (documento_id, empresa_id)
  REFERENCES public.documentos (id, empresa_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.document_share_duration_minutes(p_label text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE lower(btrim(p_label))
    WHEN '10 minutos' THEN 10
    WHEN '30 minutos' THEN 30
    WHEN '1 hora' THEN 60
    WHEN '3 horas' THEN 180
    WHEN '6 horas' THEN 360
    WHEN '12 horas' THEN 720
    WHEN '24 horas' THEN 1440
    WHEN '3 dias' THEN 4320
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_document_share_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_empresa_id uuid;
  v_duration_minutes integer;
  v_exigir_senha boolean := true;
  v_prazos_exigem_senha text[] := ARRAY['12 horas', '24 horas', '3 dias']::text[];
  v_document public.documentos%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessao autenticada obrigatoria.' USING ERRCODE = '42501';
  END IF;

  v_empresa_id := public.current_empresa_id();
  IF v_empresa_id IS NULL
     OR NOT public.current_user_has_permission(v_empresa_id, 'documentos:manage') THEN
    RAISE EXCEPTION 'Permissao para gerenciar documentos obrigatoria.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.empresa_id := v_empresa_id;
    NEW.created_by := v_actor;
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.status := 'Ativo';
    NEW.share_group_id := COALESCE(NEW.share_group_id, NEW.id);
  ELSE
    IF OLD.empresa_id <> v_empresa_id THEN
      RAISE EXCEPTION 'Compartilhamento fora da empresa ativa.' USING ERRCODE = '42501';
    END IF;
    NEW.empresa_id := OLD.empresa_id;
    NEW.documento_id := OLD.documento_id;
    NEW.documento_nome := OLD.documento_nome;
    NEW.empresa_nome := OLD.empresa_nome;
    NEW.gerado_por := OLD.gerado_por;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.share_group_id := OLD.share_group_id;
  END IF;

  SELECT d.*
  INTO v_document
  FROM public.documentos d
  WHERE d.id = NEW.documento_id
    AND d.empresa_id = NEW.empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento nao pertence a empresa ativa.' USING ERRCODE = '23503';
  END IF;

  IF NOT (
    (v_document.scope = 'pessoal' AND v_document.owner_user_id = v_actor)
    OR (
      v_document.scope = 'empresa'
      AND public.current_user_can_access_client_row(
        v_document.empresa_id,
        v_document.cliente_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'Documento fora do escopo permitido.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1
    FROM public.documentos_compartilhamentos existing
    WHERE existing.share_group_id = NEW.share_group_id
      AND existing.id <> NEW.id
      AND (
        existing.empresa_id <> NEW.empresa_id
        OR existing.tempo_limite <> NEW.tempo_limite
        OR existing.senha_hash IS DISTINCT FROM NEW.senha_hash
      )
  ) THEN
    RAISE EXCEPTION 'Grupo de compartilhamento inconsistente.' USING ERRCODE = '23514';
  END IF;

  v_duration_minutes := public.document_share_duration_minutes(NEW.tempo_limite);
  IF v_duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Prazo de compartilhamento invalido.' USING ERRCODE = '23514';
  END IF;

  SELECT cc.exigir_senha, cc.prazos_exigem_senha
  INTO v_exigir_senha, v_prazos_exigem_senha
  FROM public.configuracoes_compartilhamento cc
  WHERE cc.empresa_id = NEW.empresa_id;

  v_exigir_senha := COALESCE(v_exigir_senha, true);
  v_prazos_exigem_senha := COALESCE(
    v_prazos_exigem_senha,
    ARRAY['12 horas', '24 horas', '3 dias']::text[]
  );

  IF NEW.senha_hash IS NOT NULL THEN
    NEW.senha_hash := lower(btrim(NEW.senha_hash));
    IF NEW.senha_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'Hash de senha invalido.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (
    v_exigir_senha
    OR EXISTS (
      SELECT 1
      FROM unnest(v_prazos_exigem_senha) required_label
      WHERE lower(btrim(required_label)) = lower(btrim(NEW.tempo_limite))
    )
  ) AND NEW.senha_hash IS NULL THEN
    RAISE EXCEPTION 'A politica da empresa exige senha neste compartilhamento.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.tempo_limite IS DISTINCT FROM OLD.tempo_limite
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR (OLD.status = 'Expirado' AND NEW.status = 'Ativo') THEN
    NEW.expires_at := now() + make_interval(mins => v_duration_minutes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_document_share_integrity_trigger
  ON public.documentos_compartilhamentos;
CREATE TRIGGER enforce_document_share_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.documentos_compartilhamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_share_integrity();

DROP POLICY IF EXISTS documentos_compartilhamentos_tenant_policy
  ON public.documentos_compartilhamentos;
DROP POLICY IF EXISTS documentos_compartilhamentos_select_scope
  ON public.documentos_compartilhamentos;
DROP POLICY IF EXISTS documentos_compartilhamentos_insert_manager
  ON public.documentos_compartilhamentos;
DROP POLICY IF EXISTS documentos_compartilhamentos_update_manager
  ON public.documentos_compartilhamentos;
DROP POLICY IF EXISTS documentos_compartilhamentos_delete_manager
  ON public.documentos_compartilhamentos;

CREATE POLICY documentos_compartilhamentos_select_scope
  ON public.documentos_compartilhamentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          public.current_user_has_permission(d.empresa_id, 'documentos:view')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:manage')
        )
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

CREATE POLICY documentos_compartilhamentos_insert_manager
  ON public.documentos_compartilhamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.id = documentos_compartilhamentos.documento_id
        AND d.empresa_id = documentos_compartilhamentos.empresa_id
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

CREATE POLICY documentos_compartilhamentos_update_manager
  ON public.documentos_compartilhamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'documentos:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'documentos:manage'));

CREATE POLICY documentos_compartilhamentos_delete_manager
  ON public.documentos_compartilhamentos
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'documentos:manage'));

-- A funcao publica entrega apenas metadados. Caminho e bucket nunca saem pelo papel anon.
DROP FUNCTION IF EXISTS public.get_public_document_share(uuid, text);
CREATE FUNCTION public.get_public_document_share(
  p_share_id uuid,
  p_password_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  share_group_id uuid,
  documento text,
  documento_id uuid,
  empresa text,
  empresa_cnpj text,
  empresa_logo text,
  tempo_limite text,
  data_geracao timestamptz,
  data_expiracao timestamptz,
  senha_obrigatoria boolean,
  storage_bucket text,
  storage_path text,
  gerado_por text,
  tamanho_bytes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    dc.id,
    dc.share_group_id,
    dc.documento_nome,
    NULL::uuid,
    dc.empresa_nome,
    e.cnpj::text,
    ce.logo_url::text,
    dc.tempo_limite,
    dc.created_at,
    dc.expires_at,
    dc.senha_hash IS NOT NULL,
    NULL::text,
    NULL::text,
    dc.gerado_por,
    d.tamanho_bytes
  FROM public.documentos_compartilhamentos dc
  JOIN public.documentos d
    ON d.id = dc.documento_id
   AND d.empresa_id = dc.empresa_id
  JOIN public.empresas e ON e.id = dc.empresa_id
  LEFT JOIN public.configuracoes_empresa ce ON ce.empresa_id = dc.empresa_id
  WHERE dc.share_group_id = p_share_id
    AND dc.status = 'Ativo'
    AND dc.expires_at > now()
  ORDER BY dc.created_at, dc.id;
$$;

REVOKE ALL ON FUNCTION public.get_public_document_share(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_document_share(uuid, text)
  TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.document_share_access_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  share_group_id uuid NOT NULL,
  share_row_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_share_access_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_share_access_attempts FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS document_share_failed_attempts_lookup
  ON public.document_share_access_attempts (
    share_group_id,
    share_row_id,
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_share_group_id::text || p_share_row_id::text || p_fingerprint, 0));

  DELETE FROM public.document_share_access_attempts attempts
  WHERE attempts.share_group_id = p_share_group_id
    AND attempts.share_row_id = p_share_row_id
    AND attempts.fingerprint = p_fingerprint
    AND attempts.attempted_at < now() - interval '24 hours';

  SELECT count(*)::integer
  INTO v_failed_count
  FROM public.document_share_access_attempts attempts
  WHERE attempts.share_group_id = p_share_group_id
    AND attempts.share_row_id = p_share_row_id
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

-- Nenhum cliente anonimo pode assinar um objeto diretamente. A Edge Function usa service_role.
DROP POLICY IF EXISTS documentos_storage_select_shared_policy ON storage.objects;

DROP POLICY IF EXISTS documentos_storage_select_policy ON storage.objects;
CREATE POLICY documentos_storage_select_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND (
          public.current_user_has_permission(d.empresa_id, 'documentos:view')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:view-own')
          OR public.current_user_has_permission(d.empresa_id, 'documentos:manage')
        )
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
          OR (
            d.scope = 'empresa'
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS documentos_storage_update_policy ON storage.objects;
CREATE POLICY documentos_storage_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
          OR (
            d.scope = 'empresa'
            AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  )
  WITH CHECK (bucket_id = 'documentos');

DROP POLICY IF EXISTS documentos_storage_delete_policy ON storage.objects;
CREATE POLICY documentos_storage_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1
      FROM public.documentos d
      WHERE d.storage_bucket = storage.objects.bucket_id
        AND d.storage_path = storage.objects.name
        AND (
          (d.scope = 'pessoal' AND d.owner_user_id = auth.uid())
          OR (
            d.scope = 'empresa'
            AND public.current_user_has_permission(d.empresa_id, 'documentos:manage')
            AND public.current_user_can_access_client_row(d.empresa_id, d.cliente_id)
          )
        )
    )
  );

COMMIT;
