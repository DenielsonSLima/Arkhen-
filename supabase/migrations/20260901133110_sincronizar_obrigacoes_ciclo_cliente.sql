-- Cadastro, reativação e troca de regime do parceiro reconciliam obrigações e
-- rotinas na mesma transação. O statement trigger toma o lock antes do row lock.

-- A proteção histórica da configuração exige uma sessão autenticada com tenant.
-- Escritas internas continuam bloqueadas por padrão e só recebem bypass quando
-- são chamadas por outro trigger ou pela conexão administrativa de migration,
-- sempre com a identidade do registro e o vínculo cliente/tenant revalidados.
CREATE OR REPLACE FUNCTION public.proteger_configuracao_protocolo_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_escrita_interna boolean :=
    current_setting('app.obrigacao_config_internal_write', true) = 'on'
    AND (
      pg_trigger_depth() > 1
      OR session_user IN ('postgres', 'supabase_admin')
    );
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Identidade e tenant da configuracao de protocolos sao imutaveis.'
      USING ERRCODE = '42501';
  END IF;

  IF v_escrita_interna THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clientes cliente
      WHERE cliente.empresa_id = NEW.empresa_id
        AND cliente.id = NEW.cliente_id
    ) THEN
      RAISE EXCEPTION 'Cliente nao encontrado para configurar protocolos.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem tenant ativo para configurar protocolos.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.empresa_id := v_empresa_id;
  ELSIF OLD.empresa_id IS DISTINCT FROM v_empresa_id THEN
    RAISE EXCEPTION 'Configuracao de protocolos nao pertence ao tenant ativo.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.id = NEW.cliente_id
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ) THEN
    RAISE EXCEPTION 'Cliente nao encontrado para configurar protocolos.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_configuracao_protocolo_tenant()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.bloquear_obrigacoes_cliente_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_empresa_id::text, 913331)
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bloquear_obrigacoes_cliente_statement
  ON public.clientes;
CREATE TRIGGER bloquear_obrigacoes_cliente_statement
  BEFORE INSERT OR UPDATE OF status, tipo, tipo_parceiro_id
  ON public.clientes
  FOR EACH STATEMENT
  EXECUTE FUNCTION app_private.bloquear_obrigacoes_cliente_statement();

REVOKE ALL ON FUNCTION app_private.bloquear_obrigacoes_cliente_statement()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.sincronizar_obrigacoes_ciclo_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_configs_salvas jsonb;
  v_configs jsonb;
  v_empresa_sessao uuid := public.current_empresa_id();
  v_cliente_contabil boolean;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_config_internal_write', true), 'off'
  );
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos tipo_parceiro
    WHERE tipo_parceiro.id = NEW.tipo_parceiro_id
      AND tipo_parceiro.empresa_id = NEW.empresa_id
      AND tipo_parceiro.tipo = 'tipos_parceiros'
      AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
      AND tipo_parceiro.ativo = true
  ) INTO v_cliente_contabil;

  -- Escritas administrativas sem tenant não passaram pelo statement lock. Para
  -- preservar a ordem advisory -> cliente usada pelas RPCs, elas só continuam
  -- se conseguirem o lock imediatamente. Em concorrência, abortar com 40001
  -- permite retry e evita confirmar cliente/configuração/rotina divergentes.
  IF v_empresa_sessao IS DISTINCT FROM NEW.empresa_id
     AND NOT pg_catalog.pg_try_advisory_xact_lock(
       pg_catalog.hashtextextended(NEW.empresa_id::text, 913331)
     ) THEN
    RAISE EXCEPTION 'Obrigações alteradas por outra operação. Tente novamente.'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.status IS DISTINCT FROM 'Ativa' OR NOT v_cliente_contabil THEN
    UPDATE public.atividades_rotinas rotina
    SET ativa = false, atualizado_em = now()
    WHERE rotina.empresa_id = NEW.empresa_id
      AND rotina.cliente_id = NEW.id
      AND rotina.protocolo_codigo IS NOT NULL
      AND rotina.ativa = true;
    RETURN NEW;
  END IF;

  SELECT cfg.configs INTO v_configs_salvas
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = NEW.empresa_id
    AND cfg.cliente_id = NEW.id
  FOR UPDATE;

  v_configs := app_private.normalizar_configs_protocolos_cliente(
    NEW.empresa_id,
    NEW.id,
    app_private.mesclar_configs_obrigacoes_legadas(
      NEW.empresa_id, NEW.id, COALESCE(v_configs_salvas, '[]'::jsonb)
    )
  );

  -- A função é acionada somente pela linha NEW já validada e executa como
  -- definer. Persistir também no caminho service/admin garante que a projeção
  -- materializada continue sendo a fonte usada pelas edições globais.
  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);
  INSERT INTO public.configuracoes_protocolos_empresas (
    empresa_id, cliente_id, configs
  ) VALUES (
    NEW.empresa_id, NEW.id, v_configs
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE
    SET configs = EXCLUDED.configs;
  PERFORM set_config(
    'app.obrigacao_config_internal_write', v_guard_anterior, true
  );

  PERFORM public.sincronizar_rotinas_protocolos_cliente(
    NEW.empresa_id, NEW.id, v_configs
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_obrigacoes_ciclo_cliente
  ON public.clientes;
CREATE TRIGGER sincronizar_obrigacoes_ciclo_cliente
  AFTER INSERT OR UPDATE OF status, tipo, tipo_parceiro_id
  ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION app_private.sincronizar_obrigacoes_ciclo_cliente();

REVOKE ALL ON FUNCTION app_private.sincronizar_obrigacoes_ciclo_cliente()
  FROM PUBLIC, anon, authenticated;
