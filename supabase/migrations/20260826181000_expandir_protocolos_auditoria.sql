-- EXPAND: novo contrato preserva todas as validações canônicas do RPC legado.
BEGIN;

ALTER TABLE public.protocolos_entregas
  ADD COLUMN IF NOT EXISTS evidencia text,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS auditoria_pendente boolean NOT NULL DEFAULT false;

ALTER TABLE public.protocolos_entregas
  DROP CONSTRAINT IF EXISTS protocolos_entregas_evidencia_check;
ALTER TABLE public.protocolos_entregas
  ADD CONSTRAINT protocolos_entregas_evidencia_check
    CHECK (evidencia IS NULL OR char_length(evidencia) <= 2000);

-- Legados incompletos são sinalizados; nenhum ator, horário ou evidência é inventado.
UPDATE public.protocolos_entregas
SET auditoria_pendente = true
WHERE status = 'Concluído'
  AND (concluido_por_user_id IS NULL OR recebido_em IS NULL
    OR anotacoes_list = '[]'::jsonb OR jsonb_typeof(anotacoes_list) <> 'array');

-- Estas ACLs não são usadas pelo frontend e RLS não protege TRUNCATE.
REVOKE ALL ON TABLE public.protocolos_entregas FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.protocolos_entregas FROM authenticated;

CREATE OR REPLACE FUNCTION public.salvar_protocolo_operacional_seguro(p_payload jsonb)
RETURNS public.protocolos_entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id text; v_status text; v_anotacao text; v_status_atual text;
  v_existe boolean; v_manage boolean; v_create boolean;
  v_result public.protocolos_entregas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'Solicitação de protocolo inválida.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY['id','cliente_id','entrega_id','competencia',
      'periodo_referencia','status','anotacao']::text[])) THEN
    RAISE EXCEPTION 'Campo de protocolo não permitido.' USING ERRCODE = '22023';
  END IF;
  v_id := btrim(coalesce(p_payload ->> 'id', ''));
  v_status := nullif(btrim(p_payload ->> 'status'), '');
  v_anotacao := nullif(btrim(p_payload ->> 'anotacao'), '');
  IF v_id = '' OR octet_length(v_id) > 500
     OR (v_status IS NOT NULL AND v_status NOT IN ('Pendente', 'Concluído'))
     OR (v_anotacao IS NOT NULL AND char_length(v_anotacao) > 2000)
     OR (v_status IS NOT NULL AND coalesce(char_length(v_anotacao), 0) < 8) THEN
    RAISE EXCEPTION 'Dados de protocolo inválidos; a transição exige evidência.'
      USING ERRCODE = '22023';
  END IF;

  v_manage := coalesce(public.current_user_has_permission(v_empresa_id, 'protocolos:manage'), false);
  v_create := coalesce(public.current_user_has_permission(v_empresa_id, 'protocolos:create'), false);
  -- Serializa também a primeira transição, quando a projeção ainda não possui linha.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || v_id, 0)
  );
  SELECT protocolo.status INTO v_status_atual FROM public.protocolos_entregas protocolo
  WHERE protocolo.id = v_id AND protocolo.empresa_id = v_empresa_id
  FOR UPDATE;
  v_existe := FOUND;

  IF v_existe AND NOT v_manage THEN
    RAISE EXCEPTION 'Somente gestores podem atualizar um protocolo existente.'
      USING ERRCODE = '42501';
  ELSIF NOT v_existe AND NOT (v_create OR v_manage) THEN
    RAISE EXCEPTION 'Protocolo não encontrado.' USING ERRCODE = '42501';
  ELSIF NOT v_existe AND v_status = 'Concluído' AND NOT v_manage THEN
    RAISE EXCEPTION 'Somente gestores podem concluir protocolos.' USING ERRCODE = '42501';
  END IF;
  IF v_existe AND v_status IS NOT NULL AND v_status = v_status_atual THEN
    RAISE EXCEPTION 'O protocolo já está neste status.' USING ERRCODE = '22023';
  END IF;

  IF NOT v_existe AND v_status = 'Concluído' THEN
    -- Materializa primeiro o protocolo Pendente, preservando a validação de
    -- configuração ativa, regime, período e identificador canônico do legado.
    PERFORM public.atualizar_protocolo_entrega(
      (p_payload - 'anotacao') || jsonb_build_object('status', 'Pendente')
    );
  END IF;
  v_result := public.atualizar_protocolo_entrega(p_payload);

  UPDATE public.protocolos_entregas protocolo SET
    evidencia = CASE WHEN v_status IS NOT NULL THEN v_anotacao ELSE protocolo.evidencia END,
    concluido_em = CASE
      WHEN v_status = 'Concluído' THEN now()
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolo.concluido_em END,
    auditoria_pendente = CASE
      WHEN v_status = 'Concluído' THEN false
      WHEN v_status = 'Pendente' THEN false
      ELSE protocolo.auditoria_pendente END
  WHERE protocolo.id = v_id AND protocolo.empresa_id = v_empresa_id
  RETURNING protocolo.* INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_protocolo_operacional_seguro(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_protocolo_operacional_seguro(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_protocolos_operacionais_seguros()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_result jsonb;
  v_manage boolean; v_create boolean; v_view boolean; v_view_own boolean;
BEGIN
  v_manage := coalesce(public.current_user_has_permission(
    v_empresa_id, 'protocolos:manage'), false);
  v_create := coalesce(public.current_user_has_permission(
    v_empresa_id, 'protocolos:create'), false);
  v_view := coalesce(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view'), false);
  v_view_own := coalesce(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view-own'), false);
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT (v_manage OR v_create OR v_view OR v_view_own) THEN
    RAISE EXCEPTION 'Protocolos não encontrados.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(projetado.item || jsonb_build_object(
    'evidencia', coalesce(salvo.evidencia, ''),
    'concluidoEm', coalesce(salvo.concluido_em::text, ''),
    'auditoriaPendente', coalesce(salvo.auditoria_pendente, false),
    'podeAlterarStatus', v_manage,
    'podeAnotar', v_manage OR (v_create AND salvo.id IS NULL)
  ) ORDER BY projetado.ordem), '[]'::jsonb)
  INTO v_result
  FROM jsonb_array_elements(public.get_protocolos_operacionais())
    WITH ORDINALITY projetado(item, ordem)
  JOIN public.clientes cliente_visivel
    ON cliente_visivel.id::text = projetado.item ->> 'empresaId'
   AND cliente_visivel.empresa_id = v_empresa_id
   AND public.current_user_can_access_client_row(
     cliente_visivel.empresa_id, cliente_visivel.id
   )
  LEFT JOIN public.protocolos_entregas salvo
    ON salvo.id = projetado.item ->> 'id' AND salvo.empresa_id = v_empresa_id
    AND salvo.cliente_id = cliente_visivel.id
  WHERE v_manage OR v_create OR v_view OR (
    v_view_own AND cliente_visivel.id IS NOT NULL
    AND public.current_user_has_client_access(
      cliente_visivel.empresa_id, cliente_visivel.id
    )
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_protocolos_operacionais_seguros()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_protocolos_operacionais_seguros() TO authenticated;

COMMIT;
