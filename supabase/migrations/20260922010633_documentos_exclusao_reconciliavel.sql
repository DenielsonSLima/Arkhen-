BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE app_private.documentos_exclusoes (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  actor_id uuid NOT NULL,
  documento_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.documentos_exclusoes_arquivos (
  operacao_id uuid NOT NULL REFERENCES app_private.documentos_exclusoes(id),
  documento_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  storage_bucket text NOT NULL CHECK (storage_bucket = 'documentos'),
  storage_path text NOT NULL,
  snapshot jsonb NOT NULL,
  concluido_em timestamptz,
  PRIMARY KEY (operacao_id, documento_id)
);
ALTER TABLE app_private.documentos_exclusoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.documentos_exclusoes_arquivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.documentos_exclusoes, app_private.documentos_exclusoes_arquivos FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preparar_exclusao_documentos(p_operacao_id uuid, p_documento_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_actor uuid := auth.uid();
  v_ids uuid[];
  v_operacao app_private.documentos_exclusoes%rowtype;
  v_doc public.documentos%rowtype;
  v_count integer := 0;
BEGIN
  IF v_actor IS NULL OR v_empresa IS NULL OR p_operacao_id IS NULL
    OR NOT COALESCE(public.is_empresa_member(v_empresa), false)
    OR COALESCE(public.current_user_is_client_scoped(v_empresa), true) THEN
    RAISE EXCEPTION 'Exclusão não autorizada.' USING ERRCODE = '42501';
  END IF;
  IF p_documento_ids IS NULL OR cardinality(p_documento_ids) NOT BETWEEN 1 AND 100
    OR array_position(p_documento_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Seleção de documentos inválida.' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_ids FROM unnest(p_documento_ids) id;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 219));
  SELECT * INTO v_operacao FROM app_private.documentos_exclusoes WHERE id = p_operacao_id;
  IF FOUND THEN
    IF v_operacao.empresa_id <> v_empresa OR v_operacao.actor_id <> v_actor OR v_operacao.documento_ids <> v_ids THEN
      RAISE EXCEPTION 'Operação de exclusão inválida.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('operacaoId', p_operacao_id, 'documentos', cardinality(v_ids));
  END IF;
  -- Locks prevent concurrent FK references from being introduced during deletion.
  FOR v_doc IN SELECT * FROM public.documentos WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE LOOP
    v_count := v_count + 1;
    IF v_doc.empresa_id <> v_empresa OR NOT COALESCE((
      (v_doc.scope = 'pessoal' AND v_doc.cliente_id IS NULL AND v_doc.owner_user_id = v_actor)
      OR (v_doc.scope = 'empresa' AND v_doc.cliente_id IS NOT NULL
        AND public.documento_cliente_belongs_to_empresa(v_doc.cliente_id, v_empresa)
        AND (public.current_user_has_permission(v_empresa, 'documentos:manage')
          OR (v_doc.owner_user_id = v_actor AND (
            public.current_user_has_permission(v_empresa, 'documentos:create')
            OR public.current_user_has_permission(v_empresa, 'documentos:create-own')))))
    ), false) THEN
      RAISE EXCEPTION 'Documento não encontrado ou exclusão não autorizada.' USING ERRCODE = '42501';
    END IF;
    IF v_doc.storage_bucket IS DISTINCT FROM 'documentos' OR NULLIF(v_doc.storage_path, '') IS NULL
      OR split_part(v_doc.storage_path, '/', 1) IS DISTINCT FROM v_empresa::text
      OR (v_doc.scope = 'pessoal' AND (split_part(v_doc.storage_path, '/', 2) <> 'pessoal'
        OR split_part(v_doc.storage_path, '/', 3) IS DISTINCT FROM v_doc.owner_user_id::text))
      OR (v_doc.scope = 'empresa' AND (split_part(v_doc.storage_path, '/', 2) <> 'clientes'
        OR split_part(v_doc.storage_path, '/', 3) IS DISTINCT FROM v_doc.cliente_id))
      OR v_doc.storage_path ~ '(^|/)[.]{1,2}(/|$)' THEN
      RAISE EXCEPTION 'Arquivo sem identificação segura para exclusão.' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_doc.storage_path, 220));
    IF EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id=v_doc.storage_bucket AND o.name=v_doc.storage_path
      AND o.owner IS DISTINCT FROM v_doc.owner_user_id) OR EXISTS (
      SELECT 1 FROM public.documentos outro WHERE outro.storage_path=v_doc.storage_path AND outro.id<>v_doc.id
    ) THEN
      RAISE EXCEPTION 'Arquivo com vínculo de propriedade inconsistente.' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF v_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Documento não encontrado ou exclusão não autorizada.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO app_private.documentos_exclusoes(id,empresa_id,actor_id,documento_ids)
    VALUES (p_operacao_id,v_empresa,v_actor,v_ids);
  INSERT INTO app_private.documentos_exclusoes_arquivos(operacao_id,documento_id,empresa_id,storage_bucket,storage_path,snapshot)
    SELECT p_operacao_id,id,empresa_id,storage_bucket,storage_path,to_jsonb(d)
    FROM public.documentos d WHERE id = ANY(v_ids);
  -- Any FK rejection rolls back BOTH metadata deletion and the private queue.
  DELETE FROM public.documentos WHERE id = ANY(v_ids) AND empresa_id = v_empresa;
  RETURN jsonb_build_object('operacaoId', p_operacao_id, 'documentos', cardinality(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.preparar_exclusao_documentos(uuid,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_exclusao_documentos(uuid,uuid[]) TO authenticated;

-- The same path cannot be reassigned to new metadata while cleanup is pending.
-- Shared advisory locks serialize preparation with registration/reassignment.
CREATE OR REPLACE FUNCTION app_private.proteger_documento_em_exclusao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.storage_path,220));
  IF EXISTS (SELECT 1 FROM app_private.documentos_exclusoes_arquivos
    WHERE storage_bucket=NEW.storage_bucket AND storage_path=NEW.storage_path AND concluido_em IS NULL) THEN
    RAISE EXCEPTION 'Arquivo com exclusão em processamento.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.proteger_documento_em_exclusao() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER documentos_exclusao_pendente_guard BEFORE INSERT OR UPDATE OF storage_bucket,storage_path ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION app_private.proteger_documento_em_exclusao();

-- Both RPCs below are reserved to the cleanup Edge. Paths always originate in
-- snapshots captured transactionally by the authorized deletion, never the body.
CREATE OR REPLACE FUNCTION public.listar_arquivos_exclusao_pendentes(p_actor_id uuid)
RETURNS TABLE(operacao_id uuid,documento_id uuid,storage_bucket text,storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.operacao_id,f.documento_id,f.storage_bucket,f.storage_path
  FROM app_private.documentos_exclusoes_arquivos f
  JOIN app_private.documentos_exclusoes op ON op.id=f.operacao_id AND op.empresa_id=f.empresa_id
  WHERE op.actor_id=p_actor_id AND f.concluido_em IS NULL
  ORDER BY op.created_at,f.documento_id LIMIT 100;
$$;
CREATE OR REPLACE FUNCTION public.confirmar_limpeza_documento(p_actor_id uuid,p_operacao_id uuid,p_documento_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE app_private.documentos_exclusoes_arquivos f SET concluido_em=COALESCE(concluido_em,now())
  FROM app_private.documentos_exclusoes op
  WHERE f.operacao_id=op.id AND f.empresa_id=op.empresa_id AND op.actor_id=p_actor_id
    AND f.operacao_id=p_operacao_id AND f.documento_id=p_documento_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.listar_arquivos_exclusao_pendentes(uuid), public.confirmar_limpeza_documento(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_arquivos_exclusao_pendentes(uuid), public.confirmar_limpeza_documento(uuid,uuid,uuid) TO service_role;
COMMIT;
