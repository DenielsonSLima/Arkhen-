-- Centraliza no banco a leitura da configuração operacional e o onboarding.
-- O navegador envia apenas a seleção do usuário; regime, defaults e status são
-- derivados no tenant autenticado.
BEGIN;

CREATE OR REPLACE FUNCTION public.obter_configuracao_protocolos_cliente(
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_regime text;
  v_catalogo jsonb;
  v_configs jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_cliente_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'protocolos:view')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:view-own'),
       false
     )
     OR NOT coalesce(
       public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
     ) THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT cliente.tipo
  INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id
    AND cliente.id = p_cliente_id
    AND cliente.status = 'Ativa';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  WITH catalogo AS (
    SELECT
      tipo.*,
      coalesce(
        prazo.fechamento,
        nullif(btrim(tipo.periodicidade_padrao), ''),
        'mensal'
      ) AS periodicidade_resolvida
    FROM public.parametrizacao_protocolos_tipos tipo
    LEFT JOIN public.parametrizacao_prazos_entrega prazo
      ON prazo.empresa_id = tipo.empresa_id
     AND prazo.regime = v_regime
     AND prazo.entrega_id = tipo.codigo
     AND prazo.ativo = true
    WHERE tipo.empresa_id = v_empresa_id
      AND tipo.ativo = true
      AND v_regime = ANY(tipo.regimes)
  ), configuracao AS (
    SELECT cfg.configs
    FROM public.configuracoes_protocolos_empresas cfg
    WHERE cfg.empresa_id = v_empresa_id
      AND cfg.cliente_id = p_cliente_id
  ), resolvido AS (
    SELECT
      catalogo.*,
      salvo.valor AS config_salva
    FROM catalogo
    LEFT JOIN configuracao ON true
    LEFT JOIN LATERAL (
      SELECT item.valor
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(configuracao.configs) = 'array' THEN configuracao.configs
          ELSE '[]'::jsonb
        END
      ) item(valor)
      WHERE item.valor ->> 'entregaId' = catalogo.codigo
      LIMIT 1
    ) salvo ON true
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', codigo,
      'nome', nome,
      'categoria', categoria,
      'orgao', nullif(btrim(orgao), ''),
      'diaLimite', dia_limite,
      'descricao', coalesce(descricao, ''),
      'status', 'Ativo',
      'regimes', to_jsonb(regimes),
      'periodicidadePadrao', periodicidade_resolvida,
      'origemPadrao', CASE origem_padrao
        WHEN 'cliente' THEN 'Cliente envia'
        WHEN 'escritorio' THEN 'Escritório envia'
        WHEN 'ambos' THEN 'Ambos'
        ELSE origem_padrao
      END
    ) ORDER BY categoria, nome), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entregaId', codigo,
      'ativo', CASE
        WHEN jsonb_typeof(config_salva -> 'ativo') = 'boolean'
          THEN (config_salva ->> 'ativo')::boolean
        ELSE false
      END,
      'periodicidade', CASE
        WHEN config_salva ->> 'periodicidade' IN (
          'diaria', 'semanal', 'quinzenal', 'mensal',
          'trimestral', 'semestral', 'personalizada'
        ) THEN config_salva ->> 'periodicidade'
        ELSE periodicidade_resolvida
      END,
      'intervaloDias', CASE
        WHEN config_salva ->> 'periodicidade' = 'personalizada'
          AND config_salva ->> 'intervaloDias' ~ '^[1-9][0-9]{0,2}$'
          AND (config_salva ->> 'intervaloDias')::integer <= 366
          THEN (config_salva ->> 'intervaloDias')::integer
        ELSE NULL
      END
    )) ORDER BY categoria, nome), '[]'::jsonb)
  INTO v_catalogo, v_configs
  FROM resolvido;

  RETURN jsonb_build_object('catalogo', v_catalogo, 'configs', v_configs);
END;
$$;

REVOKE ALL ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.obter_status_configuracao_inicio()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_empresa public.configuracoes_empresa%rowtype;
  v_logo_configurado boolean;
  v_marcas_configuradas boolean;
  v_empresa_completa boolean;
  v_clientes integer;
  v_clientes_configurados integer;
  v_modelos integer;
  v_rotinas integer;
  v_tarefas integer;
  v_usuarios integer;
  v_modelos_vinculados boolean;
  v_operacao_planejada boolean;
  v_essenciais integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_access_allowed(v_empresa_id), false) THEN
    RAISE EXCEPTION 'Configuração inicial não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT empresa.* INTO v_empresa
  FROM public.configuracoes_empresa empresa
  WHERE empresa.empresa_id = v_empresa_id;

  v_empresa_completa := coalesce(
    (
      nullif(btrim(coalesce(v_empresa.razao_social, v_empresa.nome_fantasia)), '') IS NOT NULL
      AND length(regexp_replace(coalesce(v_empresa.cnpj, ''), '[^0-9]', '', 'g')) = 14
      AND (nullif(btrim(v_empresa.email), '') IS NOT NULL OR nullif(btrim(v_empresa.telefone), '') IS NOT NULL)
      AND length(regexp_replace(coalesce(v_empresa.cep, ''), '[^0-9]', '', 'g')) = 8
      AND regexp_replace(coalesce(v_empresa.cep, ''), '[^0-9]', '', 'g') <> '49000000'
      AND nullif(btrim(v_empresa.endereco), '') IS NOT NULL
      AND lower(coalesce(v_empresa.endereco, '')) NOT LIKE '%fictícia%'
      AND lower(coalesce(v_empresa.endereco, '')) NOT LIKE '%ficticia%'
      AND nullif(btrim(v_empresa.numero), '') IS NOT NULL
      AND nullif(btrim(v_empresa.cidade), '') IS NOT NULL
      AND nullif(btrim(v_empresa.estado), '') IS NOT NULL
    ),
    false
  );
  v_logo_configurado := coalesce(
    nullif(btrim(v_empresa.logo_url), '') IS NOT NULL,
    false
  );

  SELECT coalesce(
    nullif(btrim(marca.file_url_paisagem), '') IS NOT NULL
    AND nullif(btrim(marca.file_url_retrato), '') IS NOT NULL,
    false
  ) INTO v_marcas_configuradas
  FROM public.configuracoes_marca_dagua marca
  WHERE marca.empresa_id = v_empresa_id;
  v_marcas_configuradas := coalesce(v_marcas_configuradas, false);

  SELECT count(*)::integer INTO v_clientes
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id
    AND cliente.status = 'Ativa'
    AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id);

  SELECT count(*)::integer INTO v_clientes_configurados
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id
    AND cliente.status = 'Ativa'
    AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.configuracoes_protocolos_empresas cfg,
             LATERAL jsonb_array_elements(
               CASE WHEN jsonb_typeof(cfg.configs) = 'array' THEN cfg.configs ELSE '[]'::jsonb END
             ) item(valor)
        WHERE cfg.empresa_id = cliente.empresa_id
          AND cfg.cliente_id = cliente.id
          AND item.valor ->> 'ativo' = 'true'
      )
      OR EXISTS (
        SELECT 1 FROM public.atividades_rotinas rotina
        WHERE rotina.empresa_id = cliente.empresa_id
          AND rotina.cliente_id = cliente.id
          AND rotina.ativa = true
      )
    );

  SELECT count(*)::integer INTO v_modelos FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = v_empresa_id
    AND tipo.ativo = true
    AND (public.current_user_has_permission(v_empresa_id, 'parametrizacao:view')
      OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage')
      OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage'));
  SELECT count(*)::integer INTO v_rotinas FROM public.atividades_rotinas rotina
  WHERE rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
    AND (
      public.current_user_has_permission(v_empresa_id, 'atividades:manage')
      OR (public.current_user_has_permission(v_empresa_id, 'atividades:view')
        AND rotina.responsavel_user_id = auth.uid())
      OR (rotina.cliente_id IS NOT NULL
        AND public.current_user_has_permission(v_empresa_id, 'atividades:view-own')
        AND public.current_user_has_client_access(v_empresa_id, rotina.cliente_id))
    );
  SELECT count(*)::integer INTO v_tarefas FROM public.atividades_tarefas tarefa
  WHERE tarefa.empresa_id = v_empresa_id
    AND tarefa.ativo = true
    AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
    AND (
      public.current_user_has_permission(v_empresa_id, 'atividades:manage')
      OR (public.current_user_has_permission(v_empresa_id, 'atividades:view')
        AND tarefa.responsavel_user_id = auth.uid())
      OR (tarefa.cliente_id IS NOT NULL
        AND public.current_user_has_permission(v_empresa_id, 'atividades:view-own')
        AND public.current_user_has_client_access(v_empresa_id, tarefa.cliente_id))
    );
  SELECT count(*)::integer INTO v_usuarios FROM public.configuracoes_usuarios usuario
  WHERE usuario.empresa_id = v_empresa_id
    AND usuario.status = 'Ativo'
    AND usuario.auth_user_id IS NOT NULL
    AND (
      usuario.auth_user_id = auth.uid()
      OR public.current_user_has_permission(v_empresa_id, 'usuarios:manage')
      OR public.current_user_has_permission(v_empresa_id, 'configuracoes:manage')
    );

  v_modelos_vinculados := v_clientes > 0 AND v_clientes_configurados = v_clientes;
  v_operacao_planejada := v_rotinas > 0 OR v_tarefas > 0;
  v_essenciais := (v_empresa_completa::integer)
    + ((v_clientes > 0)::integer)
    + (v_modelos_vinculados::integer)
    + (v_operacao_planejada::integer);

  RETURN jsonb_build_object(
    'empresaCompleta', v_empresa_completa,
    'logoConfigurado', v_logo_configurado,
    'marcasDaguaConfiguradas', v_marcas_configuradas,
    'identidadeCompleta', v_logo_configurado AND v_marcas_configuradas,
    'clientesAtivos', v_clientes,
    'clientesComModelos', v_clientes_configurados,
    'modelosAtivos', v_modelos,
    'modelosVinculados', v_modelos_vinculados,
    'rotinasAtivas', v_rotinas,
    'tarefasAtivas', v_tarefas,
    'operacaoPlanejada', v_operacao_planejada,
    'usuariosAtivos', v_usuarios,
    'essenciaisConcluidos', v_essenciais,
    'essenciaisTotal', 4,
    'configuracaoEssencialCompleta', v_essenciais = 4,
    'configuracaoRecomendadaCompleta',
      v_logo_configurado AND v_marcas_configuradas AND v_usuarios > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_status_configuracao_inicio()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_status_configuracao_inicio()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo(
  p_rotina_id uuid,
  p_responsavel_config_usuario_id uuid
)
RETURNS public.atividades_rotinas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado public.atividades_rotinas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL OR p_responsavel_config_usuario_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.atividades_rotinas rotina
  JOIN public.clientes cliente ON cliente.id = rotina.cliente_id
    AND cliente.empresa_id = rotina.empresa_id AND cliente.status = 'Ativa'
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IS NOT NULL
    AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = p_responsavel_config_usuario_id
      AND usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
      AND usuario.auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Responsável ativo ainda não possui acesso ao sistema.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_config_usuario_id = p_responsavel_config_usuario_id,
      proxima_execucao = greatest(
        proxima_execucao,
        (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
      ),
      atualizado_em = now()
  WHERE id = p_rotina_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  PERFORM public.materializar_atividades_rotinas(
    (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_protocolos_cliente(
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
  v_tarefa_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'protocolos:manage'), false) THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NULL OR NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
  ) THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id AND cliente.id = p_cliente_id AND cliente.status = 'Ativa'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de protocolos não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.validar_configs_protocolos_operacionais(v_empresa_id, p_cliente_id, p_configs);

  INSERT INTO public.configuracoes_protocolos_empresas (empresa_id, cliente_id, configs)
  VALUES (v_empresa_id, p_cliente_id, p_configs)
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE SET configs = EXCLUDED.configs
  RETURNING configs INTO v_resultado;

  PERFORM public.sincronizar_rotinas_protocolos_cliente(v_empresa_id, p_cliente_id, p_configs);

  FOR v_tarefa_id IN
    UPDATE public.atividades_tarefas tarefa
    SET ativo = false, atualizado_em = now()
    FROM public.atividades_rotinas rotina
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.cliente_id = p_cliente_id
      AND tarefa.rotina_id = rotina.id
      AND rotina.empresa_id = tarefa.empresa_id
      AND rotina.protocolo_codigo IS NOT NULL
      AND rotina.ativa = false
      AND tarefa.ativo = true
      AND tarefa.status <> 'Concluída'
    RETURNING tarefa.id
  LOOP
    PERFORM public.registrar_evento_tarefa_operacional(
      v_empresa_id,
      v_tarefa_id,
      'arquivada',
      'Obrigação desativada na configuração do cliente.',
      jsonb_build_object('clienteId', p_cliente_id, 'origem', 'configuracao_protocolos')
    );
  END LOOP;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  TO authenticated;

DROP POLICY IF EXISTS atividades_rotinas_insert_manager ON public.atividades_rotinas;
DROP POLICY IF EXISTS atividades_rotinas_update_manager ON public.atividades_rotinas;
DROP POLICY IF EXISTS atividades_rotinas_delete_manager ON public.atividades_rotinas;
CREATE POLICY atividades_rotinas_insert_manager
ON public.atividades_rotinas FOR INSERT TO authenticated
WITH CHECK (
  protocolo_codigo IS NULL
  AND public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);
CREATE POLICY atividades_rotinas_update_manager
ON public.atividades_rotinas FOR UPDATE TO authenticated
USING (
  protocolo_codigo IS NULL
  AND public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
)
WITH CHECK (
  protocolo_codigo IS NULL
  AND public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);
CREATE POLICY atividades_rotinas_delete_manager
ON public.atividades_rotinas FOR DELETE TO authenticated
USING (
  protocolo_codigo IS NULL
  AND public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
);

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'configuracoes_protocolos_empresas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_protocolos_empresas;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'atividades_rotinas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atividades_rotinas;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'atividades_tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atividades_tarefas;
  END IF;
END;
$publication$;

COMMIT;
