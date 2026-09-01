-- A mutação legada continua interna. Para os cinco períodos antigos o ID é
-- validado exatamente como antes; para os novos, que podem ter várias
-- ocorrências na mesma competência, o ID precisa existir na projeção
-- autorizada. Linhas já materializadas continuam editáveis fora da janela.
CREATE OR REPLACE FUNCTION public.atualizar_protocolo_entrega(p_payload jsonb)
RETURNS public.protocolos_entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente_id uuid;
  v_id text;
  v_entrega_id text;
  v_competencia text;
  v_periodo text;
  v_periodo_key text;
  v_status text;
  v_anotacao text;
  v_autor text;
  v_agora timestamptz := now();
  v_identidade_valida boolean := false;
  v_resultado public.protocolos_entregas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb
     OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'Solicitação de protocolo inválida' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY[
      'id', 'cliente_id', 'entrega_id', 'competencia',
      'periodo_referencia', 'status', 'anotacao'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'Campo de protocolo não permitido' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(
    public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:create'),
    false
  ) THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_cliente_id := NULLIF(p_payload ->> 'cliente_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Cliente inválido' USING ERRCODE = '22023';
  END;

  v_id := btrim(COALESCE(p_payload ->> 'id', ''));
  v_entrega_id := btrim(COALESCE(p_payload ->> 'entrega_id', ''));
  v_competencia := btrim(COALESCE(p_payload ->> 'competencia', ''));
  v_periodo := btrim(COALESCE(p_payload ->> 'periodo_referencia', ''));
  v_status := NULLIF(btrim(p_payload ->> 'status'), '');
  v_anotacao := NULLIF(btrim(p_payload ->> 'anotacao'), '');

  IF v_cliente_id IS NULL OR v_id = '' OR octet_length(v_id) > 500
     OR v_entrega_id = '' OR octet_length(v_entrega_id) > 180
     OR v_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     OR v_periodo NOT IN (
       'Mensal', '1ª quinzena', '2ª quinzena', 'Trimestral', 'Semestral',
       'Diária', 'Semanal', 'Única', 'Anual'
     )
     OR (v_status IS NOT NULL AND v_status NOT IN ('Pendente', 'Concluído'))
     OR (v_anotacao IS NOT NULL AND octet_length(v_anotacao) > 4000)
     OR (v_status IS NULL AND v_anotacao IS NULL) THEN
    RAISE EXCEPTION 'Dados de protocolo inválidos' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(public.current_user_can_access_client_row(
    v_empresa_id, v_cliente_id
  ), false) OR NOT EXISTS (
    SELECT 1 FROM public.clientes cliente
    WHERE cliente.id = v_cliente_id
      AND cliente.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.configuracoes_protocolos_empresas cfg
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(cfg.configs) = 'array'
        THEN cfg.configs ELSE '[]'::jsonb END
    ) item(valor)
    WHERE cfg.empresa_id = v_empresa_id
      AND cfg.cliente_id = v_cliente_id
      AND item.valor ->> 'entregaId' = v_entrega_id
      AND item.valor ->> 'ativo' = 'true'
  ) THEN
    RAISE EXCEPTION 'Protocolo não configurado para o cliente'
      USING ERRCODE = '42501';
  END IF;

  IF v_periodo IN (
    'Mensal', '1ª quinzena', '2ª quinzena', 'Trimestral', 'Semestral'
  ) THEN
    v_periodo_key := CASE v_periodo
      WHEN '1ª quinzena' THEN 'q1'
      WHEN '2ª quinzena' THEN 'q2'
      WHEN 'Trimestral' THEN 'trimestral'
      WHEN 'Semestral' THEN 'semestral'
      ELSE 'mensal'
    END;
    v_identidade_valida := v_id = v_cliente_id::text || '-'
      || v_competencia || '-' || v_entrega_id || '-' || v_periodo_key;
  ELSE
    -- Uma ocorrência já salva permanece mutável mesmo depois de sair da janela
    -- corrente (diárias/semanais históricas e a ocorrência única).
    SELECT EXISTS (
      SELECT 1
      FROM public.protocolos_entregas protocolo
      WHERE protocolo.id = v_id
        AND protocolo.empresa_id = v_empresa_id
        AND protocolo.cliente_id = v_cliente_id
        AND protocolo.entrega_id = v_entrega_id
        AND protocolo.competencia = v_competencia
        AND protocolo.periodo_referencia = v_periodo
    ) INTO v_identidade_valida;

    IF NOT v_identidade_valida THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(public.get_protocolos_operacionais()) item(valor)
        WHERE item.valor ->> 'id' = v_id
          AND item.valor ->> 'empresaId' = v_cliente_id::text
          AND item.valor ->> 'entregaId' = v_entrega_id
          AND item.valor ->> 'competencia' = v_competencia
          AND item.valor ->> 'periodoReferencia' = v_periodo
      ) INTO v_identidade_valida;
    END IF;
  END IF;

  IF NOT v_identidade_valida THEN
    RAISE EXCEPTION 'Identificador de protocolo inválido' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    (SELECT NULLIF(btrim(usuario.nome), '')
     FROM public.configuracoes_usuarios usuario
     WHERE usuario.empresa_id = v_empresa_id
       AND usuario.auth_user_id = auth.uid()
       AND usuario.status = 'Ativo'
     ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
     LIMIT 1),
    (SELECT NULLIF(btrim(perfil.nome), '')
     FROM public.perfis perfil
     WHERE perfil.empresa_id = v_empresa_id
       AND perfil.user_id = auth.uid()
       AND perfil.ativo = true
     LIMIT 1),
    auth.uid()::text
  ) INTO v_autor;

  INSERT INTO public.protocolos_entregas AS protocolo (
    id, empresa_id, cliente_id, entrega_id, competencia, periodo_referencia,
    status, recebido_em, concluido_por, concluido_por_user_id,
    anotacoes_list, atualizado_em
  ) VALUES (
    v_id, v_empresa_id, v_cliente_id, v_entrega_id, v_competencia, v_periodo,
    COALESCE(v_status, 'Pendente'),
    CASE WHEN v_status = 'Concluído' THEN v_agora ELSE NULL END,
    CASE WHEN v_status = 'Concluído' THEN v_autor ELSE NULL END,
    CASE WHEN v_status = 'Concluído' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_anotacao IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'data', v_agora,
        'texto', v_anotacao,
        'autor', v_autor,
        'autorUserId', auth.uid()::text
      )
    ) END,
    v_agora
  )
  ON CONFLICT (id) DO UPDATE SET
    status = COALESCE(v_status, protocolo.status),
    recebido_em = CASE
      WHEN v_status = 'Concluído' AND protocolo.status IS DISTINCT FROM 'Concluído'
        THEN v_agora
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolo.recebido_em
    END,
    concluido_por = CASE
      WHEN v_status = 'Concluído' AND protocolo.status IS DISTINCT FROM 'Concluído'
        THEN v_autor
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolo.concluido_por
    END,
    concluido_por_user_id = CASE
      WHEN v_status = 'Concluído' AND protocolo.status IS DISTINCT FROM 'Concluído'
        THEN auth.uid()
      WHEN v_status = 'Pendente' THEN NULL
      ELSE protocolo.concluido_por_user_id
    END,
    anotacoes_list = CASE WHEN v_anotacao IS NULL THEN protocolo.anotacoes_list ELSE
      CASE WHEN jsonb_typeof(protocolo.anotacoes_list) = 'array'
        THEN protocolo.anotacoes_list ELSE '[]'::jsonb END
      || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'data', v_agora,
        'texto', v_anotacao,
        'autor', v_autor,
        'autorUserId', auth.uid()::text
      ))
    END,
    atualizado_em = v_agora
  WHERE protocolo.empresa_id = v_empresa_id
    AND protocolo.cliente_id = v_cliente_id
    AND protocolo.entrega_id = v_entrega_id
    AND protocolo.competencia = v_competencia
    AND protocolo.periodo_referencia = v_periodo
  RETURNING protocolo.* INTO v_resultado;

  IF v_resultado.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  RETURN v_resultado;
END;
$$;

-- Única entrada pública de mutação: serializa concorrência, aplica as regras
-- de papel/evidência e delega a validação canônica de identidade ao helper.
CREATE OR REPLACE FUNCTION public.salvar_protocolo_operacional_seguro(
  p_payload jsonb
)
RETURNS public.protocolos_entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id text;
  v_status text;
  v_anotacao text;
  v_status_atual text;
  v_existe boolean;
  v_manage boolean;
  v_create boolean;
  v_resultado public.protocolos_entregas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload = '{}'::jsonb
     OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'Solicitação de protocolo inválida.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) campo(chave)
    WHERE campo.chave <> ALL(ARRAY[
      'id', 'cliente_id', 'entrega_id', 'competencia',
      'periodo_referencia', 'status', 'anotacao'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'Campo de protocolo não permitido.' USING ERRCODE = '22023';
  END IF;

  v_id := btrim(COALESCE(p_payload ->> 'id', ''));
  v_status := NULLIF(btrim(p_payload ->> 'status'), '');
  v_anotacao := NULLIF(btrim(p_payload ->> 'anotacao'), '');
  IF v_id = '' OR octet_length(v_id) > 500
     OR (v_status IS NOT NULL AND v_status NOT IN ('Pendente', 'Concluído'))
     OR (v_anotacao IS NOT NULL AND char_length(v_anotacao) > 2000)
     OR (v_status IS NOT NULL AND COALESCE(char_length(v_anotacao), 0) < 8) THEN
    RAISE EXCEPTION 'Dados de protocolo inválidos; a transição exige evidência.'
      USING ERRCODE = '22023';
  END IF;

  v_manage := COALESCE(
    public.current_user_has_permission(v_empresa_id, 'protocolos:manage'), false
  );
  v_create := COALESCE(
    public.current_user_has_permission(v_empresa_id, 'protocolos:create'), false
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || v_id, 0)
  );
  SELECT protocolo.status INTO v_status_atual
  FROM public.protocolos_entregas protocolo
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
    PERFORM public.atualizar_protocolo_entrega(
      (p_payload - 'anotacao') || jsonb_build_object('status', 'Pendente')
    );
  END IF;
  v_resultado := public.atualizar_protocolo_entrega(p_payload);

  UPDATE public.protocolos_entregas protocolo
  SET evidencia = CASE WHEN v_status IS NOT NULL
        THEN v_anotacao ELSE protocolo.evidencia END,
      concluido_em = CASE
        WHEN v_status = 'Concluído' THEN now()
        WHEN v_status = 'Pendente' THEN NULL
        ELSE protocolo.concluido_em END,
      auditoria_pendente = CASE
        WHEN v_status IN ('Concluído', 'Pendente') THEN false
        ELSE protocolo.auditoria_pendente END
  WHERE protocolo.id = v_id AND protocolo.empresa_id = v_empresa_id
  RETURNING protocolo.* INTO v_resultado;
  RETURN v_resultado;
END;
$$;

-- A RPC segura continua sendo a única API pública e aplica o filtro de
-- tem_vencimento/RBAC sobre a projeção ampliada.
REVOKE ALL ON FUNCTION public.get_protocolos_operacionais()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_protocolos_operacionais_seguros()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_protocolos_operacionais_seguros()
  TO authenticated;
REVOKE ALL ON FUNCTION public.atualizar_protocolo_entrega(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_protocolo_operacional_seguro(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_protocolo_operacional_seguro(jsonb)
  TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.parametrizacao_protocolos_tipos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.parametrizacao_prazos_entrega FROM anon, authenticated;
