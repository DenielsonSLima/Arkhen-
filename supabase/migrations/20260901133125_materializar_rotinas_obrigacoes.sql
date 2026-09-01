-- Materializa as rotinas dos clientes ativos depois que o envelope canônico e
-- as funções de compatibilidade já existem.
DO $$
DECLARE
  v_cliente record;
  v_empresa_id uuid;
  v_configs_salvas jsonb;
  v_configs jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_config_internal_write', true), 'off'
  );
BEGIN
  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);

  -- Remove da fila qualquer projeção protocolizada que já era inelegível antes
  -- da instalação do trigger de ciclo de vida.
  FOR v_empresa_id IN
    SELECT DISTINCT rotina.empresa_id
    FROM public.atividades_rotinas rotina
    WHERE rotina.protocolo_codigo IS NOT NULL
      AND rotina.ativa = true
    ORDER BY rotina.empresa_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_empresa_id::text, 913331)
    );
    UPDATE public.atividades_rotinas rotina
    SET ativa = false, atualizado_em = now()
    WHERE rotina.empresa_id = v_empresa_id
      AND rotina.protocolo_codigo IS NOT NULL
      AND rotina.ativa = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.clientes cliente
        WHERE cliente.empresa_id = rotina.empresa_id
          AND cliente.id = rotina.cliente_id
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
      );
  END LOOP;

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

    -- Revalida o cliente depois de qualquer espera e só então captura a versão
    -- atual da configuração sob a mesma ordem de locks usada pela RPC CAS.
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
    IF NOT FOUND THEN CONTINUE; END IF;

    v_configs_salvas := NULL;
    SELECT cfg.configs INTO v_configs_salvas
    FROM public.configuracoes_protocolos_empresas cfg
    WHERE cfg.empresa_id = v_cliente.empresa_id
      AND cfg.cliente_id = v_cliente.cliente_id
    FOR UPDATE;

    v_configs := app_private.normalizar_configs_protocolos_cliente(
      v_cliente.empresa_id,
      v_cliente.cliente_id,
      app_private.mesclar_configs_obrigacoes_legadas(
        v_cliente.empresa_id,
        v_cliente.cliente_id,
        COALESCE(v_configs_salvas, '[]'::jsonb)
      )
    );

    -- Materialização e configuração precisam nascer juntas: as edições globais
    -- consultam esta linha para decidir se a rotina permanece ativa.
    INSERT INTO public.configuracoes_protocolos_empresas (
      empresa_id, cliente_id, configs
    ) VALUES (
      v_cliente.empresa_id, v_cliente.cliente_id, v_configs
    )
    ON CONFLICT (empresa_id, cliente_id) DO UPDATE
      SET configs = EXCLUDED.configs;

    PERFORM public.sincronizar_rotinas_protocolos_cliente(
      v_cliente.empresa_id, v_cliente.cliente_id, v_configs
    );
  END LOOP;
  PERFORM set_config(
    'app.obrigacao_config_internal_write', v_guard_anterior, true
  );
END;
$$;
