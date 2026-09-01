-- Operações pontuais evitam regravar a rotina inteira com dados em cache.
-- Também expõe somente a lista mínima de responsáveis aos gestores de atividades.

CREATE OR REPLACE FUNCTION public.listar_responsaveis_atividades()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Sem permissão para listar responsáveis.' USING ERRCODE = '42501';
  END IF;

  WITH responsaveis AS (
    SELECT DISTINCT ON (usuario.auth_user_id)
      usuario.id AS config_usuario_id,
      usuario.auth_user_id,
      usuario.nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
      AND usuario.auth_user_id IS NOT NULL
    ORDER BY
      usuario.auth_user_id,
      (usuario.perfil_id IS NOT NULL) DESC,
      usuario.created_at DESC,
      usuario.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'configUsuarioId', responsavel.config_usuario_id,
    'userId', responsavel.auth_user_id,
    'nome', responsavel.nome
  ) ORDER BY responsavel.nome), '[]'::jsonb)
  INTO v_resultado
  FROM responsaveis responsavel;

  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina(
  p_rotina_id uuid,
  p_responsavel_config_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rotina public.atividades_rotinas%rowtype;
  v_responsavel_user_id uuid;
  v_responsavel_nome text;
  v_base date;
  v_execucao date;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL
     OR p_responsavel_config_usuario_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Rotina não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT usuario.auth_user_id, usuario.nome
  INTO v_responsavel_user_id, v_responsavel_nome
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = p_responsavel_config_usuario_id
    AND usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo'
    AND usuario.auth_user_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsável ativo ainda não possui acesso ao sistema.'
      USING ERRCODE = '23503';
  END IF;

  SELECT rotina.*
  INTO v_rotina
  FROM public.atividades_rotinas rotina
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND COALESCE(
      public.current_user_can_access_client_row(v_empresa_id, rotina.cliente_id),
      false
    )
    AND (
      rotina.cliente_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.clientes cliente
        WHERE cliente.id = rotina.cliente_id
          AND cliente.empresa_id = rotina.empresa_id
          AND cliente.status = 'Ativa'
      )
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rotina não encontrada.' USING ERRCODE = '42501';
  END IF;

  v_base := v_rotina.proxima_execucao_base;
  v_execucao := v_rotina.proxima_execucao;
  IF v_execucao < v_hoje THEN
    v_base := app_private.primeira_data_base_rotina(
      v_hoje,
      v_rotina.frequencia,
      v_rotina.intervalo_dias,
      v_rotina.data_ancora,
      v_rotina.dia_mes,
      v_rotina.dia_semana_iso,
      v_rotina.incluir_finais_de_semana
    );
    v_execucao := app_private.ajustar_data_rotina(
      v_base,
      v_rotina.incluir_finais_de_semana
    );
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_config_usuario_id = p_responsavel_config_usuario_id,
      responsavel_user_id = v_responsavel_user_id,
      responsavel_nome = v_responsavel_nome,
      proxima_execucao_base = v_base,
      proxima_execucao = v_execucao,
      atualizado_em = now()
  WHERE id = p_rotina_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_rotina;

  IF v_rotina.proxima_execucao <= v_hoje THEN
    PERFORM app_private.materializar_rotinas_empresa(
      v_empresa_id,
      v_hoje,
      'usuario',
      auth.uid(),
      true,
      p_rotina_id
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_rotina.id,
    'responsavelConfigUsuarioId', p_responsavel_config_usuario_id,
    'responsavelUserId', v_responsavel_user_id,
    'responsavelNome', v_responsavel_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotinas_lote(
  p_rotina_ids uuid[],
  p_responsavel_config_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_rotina_id uuid;
  v_total integer := COALESCE(cardinality(p_rotina_ids), 0);
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_responsavel_config_usuario_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR v_total NOT BETWEEN 1 AND 200
     OR array_position(p_rotina_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT rotina_id) FROM unnest(p_rotina_ids) rotina_id) <> v_total
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Lote de rotinas inválido.' USING ERRCODE = '22023';
  END IF;

  -- A transação é atômica: qualquer item inválido desfaz o lote inteiro.
  FOREACH v_rotina_id IN ARRAY p_rotina_ids LOOP
    PERFORM public.atribuir_responsavel_rotina(
      v_rotina_id,
      p_responsavel_config_usuario_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'atualizadas', to_jsonb(p_rotina_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.desativar_rotina_programada(p_rotina_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Rotina programada não encontrada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.atividades_rotinas rotina
  SET ativa = false,
      atualizado_em = now()
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IS NULL
    AND COALESCE(
      public.current_user_can_access_client_row(v_empresa_id, rotina.cliente_id),
      false
    )
  RETURNING rotina.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Rotina programada não encontrada.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'ativa', false);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_responsaveis_atividades()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotinas_lote(uuid[], uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desativar_rotina_programada(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.listar_responsaveis_atividades()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotina(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotinas_lote(uuid[], uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_rotina_programada(uuid)
  TO authenticated;
