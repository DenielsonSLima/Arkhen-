-- Integra solicitacoes documentais reais ao painel de conformidade e
-- endurece a configuracao de protocolos por cliente/tenant.

CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_id_id_uidx
  ON public.clientes (empresa_id, id);

-- A migration aborta antes de trocar a FK caso exista configuracao legada
-- apontando para um cliente de outro tenant. Corrigir silenciosamente aqui
-- poderia transferir configuracoes entre escritorios.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_protocolos_empresas configuracao
    LEFT JOIN public.clientes cliente
      ON cliente.empresa_id = configuracao.empresa_id
     AND cliente.id = configuracao.cliente_id
    WHERE cliente.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Vinculo cliente/tenant invalido em configuracoes_protocolos_empresas; migration abortada.';
  END IF;
END;
$$;

ALTER TABLE public.configuracoes_protocolos_empresas
  DROP CONSTRAINT IF EXISTS configuracoes_protocolos_empresas_cliente_id_fkey,
  DROP CONSTRAINT IF EXISTS configuracoes_protocolos_empresas_tenant_cliente_fkey;

ALTER TABLE public.configuracoes_protocolos_empresas
  ADD CONSTRAINT configuracoes_protocolos_empresas_tenant_cliente_fkey
  FOREIGN KEY (empresa_id, cliente_id)
  REFERENCES public.clientes (empresa_id, id)
  ON DELETE RESTRICT;

ALTER TABLE public.configuracoes_protocolos_empresas
  ALTER COLUMN cliente_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.proteger_configuracao_protocolo_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := (SELECT public.current_empresa_id());
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem tenant ativo para configurar protocolos.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Identidade e tenant da configuracao de protocolos sao imutaveis.'
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

DROP TRIGGER IF EXISTS derive_config_protocolos_empresa
  ON public.configuracoes_protocolos_empresas;
DROP TRIGGER IF EXISTS proteger_configuracao_protocolo_tenant
  ON public.configuracoes_protocolos_empresas;
CREATE TRIGGER proteger_configuracao_protocolo_tenant
  BEFORE INSERT OR UPDATE ON public.configuracoes_protocolos_empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_configuracao_protocolo_tenant();

ALTER TABLE public.configuracoes_protocolos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_protocolos_empresas_policy
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_select
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_insert
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_update
  ON public.configuracoes_protocolos_empresas;
DROP POLICY IF EXISTS configuracoes_protocolos_empresas_delete
  ON public.configuracoes_protocolos_empresas;

CREATE POLICY configuracoes_protocolos_empresas_select
  ON public.configuracoes_protocolos_empresas
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'protocolos:view')
      OR public.current_user_has_permission(empresa_id, 'protocolos:create')
      OR public.current_user_has_permission(empresa_id, 'protocolos:manage')
      OR public.current_user_has_permission(empresa_id, 'protocolos:view-own')
    )
  );

CREATE POLICY configuracoes_protocolos_empresas_insert
  ON public.configuracoes_protocolos_empresas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

CREATE POLICY configuracoes_protocolos_empresas_update
  ON public.configuracoes_protocolos_empresas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  )
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

CREATE POLICY configuracoes_protocolos_empresas_delete
  ON public.configuracoes_protocolos_empresas
  FOR DELETE TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND public.current_user_has_permission(empresa_id, 'protocolos:manage')
  );

-- A escrita passa por uma RPC pequena: a tabela fica somente-leitura para a
-- Data API e o servidor valida tenant, cliente, permissao e formato do JSON.
REVOKE ALL ON TABLE public.configuracoes_protocolos_empresas
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.configuracoes_protocolos_empresas TO authenticated;

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
  v_empresa_id uuid := (SELECT public.current_empresa_id());
  v_resultado jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'protocolos:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Configuracao de protocolos nao encontrada.'
      USING ERRCODE = '42501';
  END IF;

  IF p_cliente_id IS NULL
     OR jsonb_typeof(p_configs) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_configs) > 200
     OR octet_length(p_configs::text) > 65536 THEN
    RAISE EXCEPTION 'Configuracao de protocolos invalida.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.id = p_cliente_id
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ) THEN
    RAISE EXCEPTION 'Configuracao de protocolos nao encontrada.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_configs) item(valor)
    WHERE jsonb_typeof(item.valor) IS DISTINCT FROM 'object'
       OR jsonb_typeof(item.valor -> 'entregaId') IS DISTINCT FROM 'string'
       OR char_length(btrim(item.valor ->> 'entregaId')) NOT BETWEEN 1 AND 180
       OR jsonb_typeof(item.valor -> 'ativo') IS DISTINCT FROM 'boolean'
       OR (
         item.valor ? 'periodicidade'
         AND (
           jsonb_typeof(item.valor -> 'periodicidade') IS DISTINCT FROM 'string'
           OR item.valor ->> 'periodicidade'
             NOT IN ('mensal', 'quinzenal', 'trimestral', 'semestral')
         )
       )
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(item.valor) chave
         WHERE chave NOT IN ('entregaId', 'ativo', 'periodicidade')
       )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_configs) item(valor)
    GROUP BY item.valor ->> 'entregaId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Itens da configuracao de protocolos sao invalidos.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.configuracoes_protocolos_empresas (
    empresa_id,
    cliente_id,
    configs
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    p_configs
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE
  SET configs = EXCLUDED.configs
  RETURNING configs INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_protocolos_cliente(uuid, jsonb)
  TO authenticated;

-- Fonte documental da Conformidade. A funcao informa explicitamente quando o
-- perfil nao pode ver Documentos, em vez de afirmar que nao existem pedidos.
CREATE OR REPLACE FUNCTION public.get_solicitacoes_documentos_conformidade(
  p_cliente_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := (SELECT public.current_empresa_id());
  v_pode_ver boolean;
  v_solicitacoes jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'conformidade:view'),
       false
     ) THEN
    RAISE EXCEPTION 'Conformidade nao encontrada.' USING ERRCODE = '42501';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.id = p_cliente_id
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ) THEN
    RAISE EXCEPTION 'Conformidade nao encontrada.' USING ERRCODE = '42501';
  END IF;

  v_pode_ver := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:view')
    OR public.current_user_has_permission(v_empresa_id, 'documentos:manage'),
    false
  );

  IF NOT v_pode_ver THEN
    RETURN jsonb_build_object('podeVer', false, 'solicitacoes', NULL);
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', solicitacao.id::text,
        'clienteId', solicitacao.cliente_id::text,
        'clienteNome', cliente.nome,
        'cnpj', coalesce(cliente.cnpj, ''),
        'competencia', to_char(solicitacao.competencia, 'YYYY-MM'),
        'nome', solicitacao.titulo,
        'status', solicitacao.status,
        'solicitadoEm', solicitacao.created_at::text,
        'atualizadoEm', solicitacao.updated_at::text,
        'dataLimite', coalesce(solicitacao.data_limite::text, '')
      )
      ORDER BY solicitacao.data_limite NULLS LAST, solicitacao.created_at, solicitacao.id
    ),
    '[]'::jsonb
  )
  INTO v_solicitacoes
  FROM public.documentos_solicitacoes solicitacao
  JOIN public.clientes cliente
    ON cliente.empresa_id = solicitacao.empresa_id
   AND cliente.id = solicitacao.cliente_id
  WHERE solicitacao.empresa_id = v_empresa_id
    AND solicitacao.status <> 'Concluído'
    AND public.current_user_can_access_client_row(
      solicitacao.empresa_id,
      solicitacao.cliente_id
    )
    AND (p_cliente_id IS NULL OR solicitacao.cliente_id = p_cliente_id);

  RETURN jsonb_build_object('podeVer', true, 'solicitacoes', v_solicitacoes);
END;
$$;

REVOKE ALL ON FUNCTION public.get_solicitacoes_documentos_conformidade(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_solicitacoes_documentos_conformidade(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_solicitacoes_documentos_conformidade(uuid) IS
  'Lista solicitacoes documentais abertas e tenant-safe para compor a Conformidade.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'documentos_solicitacoes'
     ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.documentos_solicitacoes;
  END IF;
END;
$$;
