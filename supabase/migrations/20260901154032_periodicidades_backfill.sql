-- Reconcilia configurações e rotinas já existentes após instalar o contrato
-- canônico. A leitura do parceiro preserva somente entregaId/ativo; toda a
-- agenda é reconstruída por normalizar_configs_protocolos_cliente.

SET lock_timeout = '10s';

DO $$
DECLARE
  v_cliente record;
  v_configs_salvas jsonb;
  v_ativos jsonb;
  v_configs_normalizadas jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_config_internal_write', true), 'off'
  );
  v_ocorrencias_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_preservar_ocorrencias', true), 'off'
  );
BEGIN
  IF to_regprocedure(
       'app_private.normalizar_configs_protocolos_cliente(uuid,uuid,jsonb,date)'
     ) IS NULL
     OR to_regprocedure(
       'public.validar_configs_protocolos_operacionais(uuid,uuid,jsonb)'
     ) IS NULL
     OR to_regprocedure(
       'public.sincronizar_rotinas_protocolos_cliente(uuid,uuid,jsonb)'
     ) IS NULL THEN
    RAISE EXCEPTION 'Funções canônicas de obrigações não foram instaladas.';
  END IF;

  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);
  -- O backfill reconcilia definições; não é uma ordem do usuário para
  -- cancelar ou recriar ocorrências operacionais em andamento.
  PERFORM set_config('app.obrigacao_preservar_ocorrencias', 'on', true);

  -- O scan não bloqueia linhas. Para cada cliente, a ordem é sempre:
  -- advisory do tenant -> linha do cliente -> configuração do cliente.
  FOR v_cliente IN
    SELECT cliente.empresa_id, cliente.id AS cliente_id
    FROM public.clientes cliente
    WHERE cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
    ORDER BY cliente.empresa_id, cliente.id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_cliente.empresa_id::text, 913331)
    );

    -- Revalida depois da espera para não reativar um cliente que mudou de
    -- estado ou deixou de ser parceiro contábil durante o backfill.
    PERFORM 1
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_cliente.empresa_id
      AND cliente.id = v_cliente.cliente_id
      AND cliente.status = 'Ativa'
      AND EXISTS (
        SELECT 1
        FROM public.parametrizacao_catalogos tipo_parceiro
        WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
          AND tipo_parceiro.empresa_id = cliente.empresa_id
          AND tipo_parceiro.tipo = 'tipos_parceiros'
          AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
          AND tipo_parceiro.ativo = true
      )
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_configs_salvas := NULL;
    SELECT cfg.configs INTO v_configs_salvas
    FROM public.configuracoes_protocolos_empresas cfg
    WHERE cfg.empresa_id = v_cliente.empresa_id
      AND cfg.cliente_id = v_cliente.cliente_id
    FOR UPDATE;

    -- Compacta o legado antes de normalizar. Campos de agenda são descartados
    -- aqui, e duplicatas conservam ativo=true se qualquer entrada estava ativa.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'entregaId', existente.entrega_id,
      'ativo', existente.ativo
    ) ORDER BY existente.entrega_id), '[]'::jsonb)
    INTO v_ativos
    FROM (
      SELECT
        btrim(item.valor ->> 'entregaId') AS entrega_id,
        bool_or(CASE
          WHEN jsonb_typeof(item.valor -> 'ativo') = 'boolean'
            THEN (item.valor ->> 'ativo')::boolean
          ELSE false
        END) AS ativo
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_configs_salvas) = 'array'
          THEN v_configs_salvas ELSE '[]'::jsonb END
      ) item(valor)
      WHERE jsonb_typeof(item.valor) = 'object'
        AND jsonb_typeof(item.valor -> 'entregaId') = 'string'
        AND char_length(btrim(item.valor ->> 'entregaId')) BETWEEN 1 AND 180
      GROUP BY btrim(item.valor ->> 'entregaId')
    ) existente;

    v_configs_normalizadas := app_private.normalizar_configs_protocolos_cliente(
      v_cliente.empresa_id,
      v_cliente.cliente_id,
      app_private.mesclar_configs_obrigacoes_legadas(
        v_cliente.empresa_id,
        v_cliente.cliente_id,
        v_ativos
      )
    );

    PERFORM public.validar_configs_protocolos_operacionais(
      v_cliente.empresa_id,
      v_cliente.cliente_id,
      v_configs_normalizadas
    );

    INSERT INTO public.configuracoes_protocolos_empresas AS cfg (
      empresa_id, cliente_id, configs
    ) VALUES (
      v_cliente.empresa_id, v_cliente.cliente_id, v_configs_normalizadas
    )
    ON CONFLICT (empresa_id, cliente_id) DO UPDATE
      SET configs = EXCLUDED.configs
      WHERE cfg.configs IS DISTINCT FROM EXCLUDED.configs;

    PERFORM public.sincronizar_rotinas_protocolos_cliente(
      v_cliente.empresa_id,
      v_cliente.cliente_id,
      v_configs_normalizadas
    );
  END LOOP;

  PERFORM set_config(
    'app.obrigacao_config_internal_write', v_guard_anterior, true
  );
  PERFORM set_config(
    'app.obrigacao_preservar_ocorrencias',
    v_ocorrencias_guard_anterior,
    true
  );
END;
$$;

RESET lock_timeout;
