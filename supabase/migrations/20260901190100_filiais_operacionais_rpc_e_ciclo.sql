-- RPCs de filiais são o único caminho de escrita direta em registros-filhos.

CREATE OR REPLACE FUNCTION public.salvar_filial_cliente_v1(
  p_matriz_id uuid,
  p_filial_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_matriz public.clientes%rowtype;
  v_filial public.clientes%rowtype;
  v_nome text := btrim(COALESCE(p_payload ->> 'nome', ''));
  v_cnpj text := btrim(COALESCE(p_payload ->> 'cnpj', ''));
  v_email text := btrim(COALESCE(p_payload ->> 'email', ''));
  v_telefone text := btrim(COALESCE(p_payload ->> 'telefone', ''));
  v_contato text := btrim(COALESCE(p_payload ->> 'contato', ''));
  v_endereco text := btrim(COALESCE(p_payload ->> 'endereco', ''));
  v_bairro text := btrim(COALESCE(p_payload ->> 'bairro', ''));
  v_cep text := btrim(COALESCE(p_payload ->> 'cep', ''));
  v_cidade text := btrim(COALESCE(p_payload ->> 'cidade', ''));
  v_uf text := upper(btrim(COALESCE(p_payload ->> 'uf', '')));
  v_filial_ref text := btrim(COALESCE(p_payload ->> 'filial_ref', ''));
  v_cnpj_numeros text;
  v_matriz_cnpj_numeros text;
  v_cep_numeros text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR (
       p_filial_id IS NULL
       AND NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'clientes:create'), false)
     )
     OR (
       p_filial_id IS NOT NULL
       AND NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'clientes:update'), false)
     ) THEN
    RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF p_matriz_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_payload::text) > 16384
     OR EXISTS (
       SELECT 1 FROM jsonb_each(p_payload) campo(chave, valor)
       WHERE campo.chave <> ALL (ARRAY[
         'filial_ref', 'nome', 'cnpj', 'email', 'telefone', 'contato',
         'endereco', 'bairro', 'cep', 'cidade', 'uf'
       ]::text[])
       OR jsonb_typeof(campo.valor) IS DISTINCT FROM 'string'
     ) THEN
    RAISE EXCEPTION 'Dados da filial inválidos.' USING ERRCODE = '22023';
  END IF;

  -- Ordem compatível com o statement trigger do ciclo: tenant, depois matriz.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_matriz_id::text, 913332)
  );
  SELECT matriz.* INTO v_matriz
  FROM public.clientes matriz
  WHERE matriz.empresa_id = v_empresa_id AND matriz.id = p_matriz_id
    AND matriz.matriz_cliente_id IS NULL AND matriz.tipo_estabelecimento = 'Matriz'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matriz não encontrada.' USING ERRCODE = '42501';
  END IF;
  v_matriz_cnpj_numeros := pg_catalog.regexp_replace(
    COALESCE(v_matriz.cnpj, ''), '[^0-9]', '', 'g'
  );
  IF v_matriz.tipo = 'PF' OR char_length(v_matriz_cnpj_numeros) <> 14 THEN
    RAISE EXCEPTION 'A matriz deve ser pessoa jurídica com CNPJ válido para possuir filiais.'
      USING ERRCODE = '22023';
  END IF;

  IF p_filial_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL OR v_matriz.status <> 'Ativa' THEN
      RAISE EXCEPTION 'A matriz não aceita nova filial nesta operação.' USING ERRCODE = '40001';
    END IF;
  ELSE
    SELECT filial.* INTO v_filial
    FROM public.clientes filial
    WHERE filial.empresa_id = v_empresa_id AND filial.id = p_filial_id
      AND filial.matriz_cliente_id = p_matriz_id AND filial.tipo_estabelecimento = 'Filial'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501';
    END IF;
    IF p_expected_updated_at IS NULL OR v_filial.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Filial alterada por outro usuário.' USING ERRCODE = '40001';
    END IF;
    v_nome := CASE WHEN p_payload ? 'nome' THEN v_nome ELSE v_filial.nome END;
    v_cnpj := CASE WHEN p_payload ? 'cnpj' THEN v_cnpj ELSE v_filial.cnpj END;
    v_email := CASE WHEN p_payload ? 'email' THEN v_email ELSE v_filial.email END;
    v_telefone := CASE WHEN p_payload ? 'telefone' THEN v_telefone ELSE v_filial.telefone END;
    v_contato := CASE WHEN p_payload ? 'contato' THEN v_contato ELSE v_filial.contato END;
    v_endereco := CASE WHEN p_payload ? 'endereco' THEN v_endereco ELSE v_filial.endereco END;
    v_bairro := CASE WHEN p_payload ? 'bairro' THEN v_bairro ELSE COALESCE(v_filial.bairro, '') END;
    v_cep := CASE WHEN p_payload ? 'cep' THEN v_cep ELSE COALESCE(v_filial.cep, '') END;
    v_cidade := CASE WHEN p_payload ? 'cidade' THEN v_cidade ELSE COALESCE(v_filial.cidade, '') END;
    v_uf := CASE WHEN p_payload ? 'uf' THEN v_uf ELSE COALESCE(v_filial.uf, '') END;
    v_filial_ref := CASE WHEN p_payload ? 'filial_ref' THEN v_filial_ref ELSE v_filial.filial_ref END;
  END IF;

  v_cnpj_numeros := pg_catalog.regexp_replace(v_cnpj, '[^0-9]', '', 'g');
  v_cep_numeros := pg_catalog.regexp_replace(v_cep, '[^0-9]', '', 'g');
  v_filial_ref := lower(btrim(CASE WHEN v_filial_ref <> '' THEN v_filial_ref ELSE 'cnpj-' || v_cnpj_numeros END));
  v_filial_ref := trim(both '-' FROM pg_catalog.regexp_replace(v_filial_ref, '[^a-z0-9_-]+', '-', 'g'));
  IF char_length(v_nome) NOT BETWEEN 2 AND 180 OR char_length(v_cnpj_numeros) <> 14
     OR char_length(v_email) > 255
     OR (v_email <> '' AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     OR char_length(v_telefone) > 40 OR char_length(v_contato) > 180
     OR char_length(v_endereco) > 500 OR char_length(v_bairro) > 120
     OR char_length(v_cidade) > 120 OR (v_uf <> '' AND v_uf !~ '^[A-Z]{2}$')
     OR (v_cep <> '' AND char_length(v_cep_numeros) <> 8)
     OR v_filial_ref !~ '^[a-z0-9][a-z0-9_-]{0,79}$' THEN
    RAISE EXCEPTION 'Revise os dados cadastrais da filial.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_matriz_cnpj_numeros) = 14
     AND left(v_matriz_cnpj_numeros, 8) <> left(v_cnpj_numeros, 8) THEN
    RAISE EXCEPTION 'O CNPJ da filial não pertence à raiz da matriz.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clientes existente
    WHERE existente.empresa_id = v_empresa_id AND existente.id IS DISTINCT FROM p_filial_id
      AND char_length(pg_catalog.regexp_replace(COALESCE(existente.cnpj, ''), '[^0-9]', '', 'g')) = 14
      AND pg_catalog.regexp_replace(COALESCE(existente.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj_numeros
  ) THEN
    RAISE EXCEPTION 'Já existe um parceiro com este CNPJ.' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clientes existente
    WHERE existente.empresa_id = v_empresa_id AND existente.matriz_cliente_id = p_matriz_id
      AND existente.id IS DISTINCT FROM p_filial_id
      AND lower(pg_catalog.btrim(existente.filial_ref)) = v_filial_ref
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com esta referência.' USING ERRCODE = '23505';
  END IF;

  IF p_filial_id IS NULL THEN
    INSERT INTO public.clientes AS filial (
      empresa_id, matriz_cliente_id, filial_ref, nome, razao_social, cnpj,
      tipo, categoria_cliente, tipo_estabelecimento, logo, status,
      email, telefone, endereco, cidade, uf, cep, bairro, contato,
      tipo_parceiro_id, tipo_empresa_id, tipo_empresa_catalogo_tipo,
      natureza_juridica_id, natureza_juridica_catalogo_tipo, modelos_ativos
    ) VALUES (
      v_empresa_id, p_matriz_id, v_filial_ref, v_nome,
      COALESCE(NULLIF(v_matriz.razao_social, ''), v_nome), v_cnpj,
      v_matriz.tipo, v_matriz.categoria_cliente, 'Filial', v_matriz.logo, 'Ativa',
      v_email, v_telefone, v_endereco, NULLIF(v_cidade, ''), NULLIF(v_uf, ''),
      NULLIF(v_cep, ''), NULLIF(v_bairro, ''), v_contato,
      v_matriz.tipo_parceiro_id, v_matriz.tipo_empresa_id,
      v_matriz.tipo_empresa_catalogo_tipo, v_matriz.natureza_juridica_id,
      v_matriz.natureza_juridica_catalogo_tipo, '{}'::text[]
    ) RETURNING filial.* INTO v_filial;
  ELSE
    UPDATE public.clientes AS filial
    SET filial_ref = v_filial_ref, nome = v_nome, cnpj = v_cnpj, email = v_email,
        telefone = v_telefone, contato = v_contato, endereco = v_endereco,
        bairro = NULLIF(v_bairro, ''), cep = NULLIF(v_cep, ''),
        cidade = NULLIF(v_cidade, ''), uf = NULLIF(v_uf, '')
    WHERE filial.empresa_id = v_empresa_id AND filial.id = p_filial_id
      AND filial.matriz_cliente_id = p_matriz_id
    RETURNING filial.* INTO v_filial;
  END IF;
  RETURN pg_catalog.to_jsonb(v_filial);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_filial_cliente_v1(uuid, uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_filial_cliente_v1(uuid, uuid, jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_status_filial_cliente_v1(
  p_matriz_id uuid,
  p_filial_id uuid,
  p_status text,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_matriz public.clientes%rowtype;
  v_filial public.clientes%rowtype;
  v_status text := CASE lower(btrim(COALESCE(p_status, '')))
    WHEN 'ativa' THEN 'Ativa' WHEN 'inativa' THEN 'Inativa' ELSE NULL END;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'clientes:update'), false) THEN
    RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF p_matriz_id IS NULL OR p_filial_id IS NULL OR v_status IS NULL THEN
    RAISE EXCEPTION 'Status da filial inválido.' USING ERRCODE = '22023';
  END IF;
  -- Serializa com inativação de matriz antes de tocar na filial.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_matriz_id::text, 913332)
  );
  SELECT matriz.* INTO v_matriz
  FROM public.clientes matriz
  WHERE matriz.empresa_id = v_empresa_id AND matriz.id = p_matriz_id
    AND matriz.matriz_cliente_id IS NULL AND matriz.tipo_estabelecimento = 'Matriz'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matriz não encontrada.' USING ERRCODE = '42501'; END IF;
  SELECT filial.* INTO v_filial
  FROM public.clientes filial
  WHERE filial.empresa_id = v_empresa_id AND filial.id = p_filial_id
    AND filial.matriz_cliente_id = p_matriz_id AND filial.tipo_estabelecimento = 'Filial'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501'; END IF;
  IF p_expected_updated_at IS NULL OR v_filial.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Filial alterada por outro usuário.' USING ERRCODE = '40001';
  END IF;
  IF v_status = 'Ativa' AND v_matriz.status <> 'Ativa' THEN
    RAISE EXCEPTION 'Ative a matriz antes de reativar a filial.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.clientes AS filial SET status = v_status
  WHERE filial.empresa_id = v_empresa_id AND filial.id = p_filial_id
    AND filial.matriz_cliente_id = p_matriz_id
  RETURNING filial.* INTO v_filial;
  RETURN pg_catalog.to_jsonb(v_filial);
END;
$$;

REVOKE ALL ON FUNCTION public.definir_status_filial_cliente_v1(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_status_filial_cliente_v1(uuid, uuid, text, timestamptz) TO authenticated;

-- Sem linha persistida, o catálogo é projetado todo inativo; modelos legados
-- não são mais mesclados implicitamente na primeira abertura da tela.
CREATE OR REPLACE FUNCTION public.obter_configuracao_protocolos_cliente(
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_regime text;
  v_catalogo jsonb;
  v_configs_salvas jsonb;
  v_configs jsonb;
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR p_cliente_id IS NULL
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'protocolos:view')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
       OR public.current_user_has_permission(v_empresa_id, 'protocolos:view-own'), false
     )
     OR NOT COALESCE(public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false) THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.' USING ERRCODE = '42501';
  END IF;
  SELECT cliente.tipo INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.empresa_id = v_empresa_id AND cliente.id = p_cliente_id
    AND cliente.status = 'Ativa'
    AND EXISTS (
      SELECT 1 FROM public.parametrizacao_catalogos tipo_parceiro
      WHERE tipo_parceiro.id = cliente.tipo_parceiro_id
        AND tipo_parceiro.empresa_id = cliente.empresa_id
        AND tipo_parceiro.tipo = 'tipos_parceiros'
        AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1')
        AND tipo_parceiro.ativo = true
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de acompanhamento não encontrada.' USING ERRCODE = '42501';
  END IF;
  SELECT cfg.configs, cfg.updated_at INTO v_configs_salvas, v_updated_at
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = v_empresa_id AND cfg.cliente_id = p_cliente_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tipo.codigo,
    'nome', tipo.nome,
    'categoria', tipo.categoria,
    'orgao', NULLIF(pg_catalog.btrim(tipo.orgao), ''),
    'diaLimite', COALESCE(prazo.dia_vencimento, tipo.dia_limite),
    'descricao', COALESCE(tipo.descricao, ''),
    'status', 'Ativo',
    'regimes', pg_catalog.to_jsonb(tipo.regimes),
    'periodicidadePadrao', COALESCE(
      NULLIF(pg_catalog.btrim(prazo.fechamento), ''),
      NULLIF(pg_catalog.btrim(tipo.periodicidade_padrao), ''), 'mensal'
    ),
    'origemPadrao', CASE tipo.origem_padrao
      WHEN 'cliente' THEN 'Cliente envia'
      WHEN 'escritorio' THEN 'Escritório envia'
      WHEN 'ambos' THEN 'Ambos'
      ELSE tipo.origem_padrao END,
    'temVencimento', tipo.tem_vencimento,
    'diaSemana', COALESCE(prazo.dia_semana_iso, tipo.dia_semana_iso),
    'mesVencimento', COALESCE(prazo.mes_vencimento, tipo.mes_vencimento),
    'dataVencimento', pg_catalog.to_char(
      COALESCE(prazo.data_vencimento, tipo.data_vencimento), 'YYYY-MM-DD'
    ),
    'referenciaMesAnterior', tipo.referencia_mes_anterior,
    'diaPrimeiraQuinzena', tipo.dia_vencimento_primeira_quinzena,
    'diaSegundaQuinzena', tipo.dia_vencimento_segunda_quinzena,
    'etapas', tipo.etapas
  ) ORDER BY tipo.categoria, tipo.nome, tipo.codigo), '[]'::jsonb)
  INTO v_catalogo
  FROM public.parametrizacao_protocolos_tipos tipo
  LEFT JOIN public.parametrizacao_prazos_entrega prazo
    ON prazo.empresa_id = tipo.empresa_id
   AND prazo.regime = v_regime
   AND prazo.entrega_id = tipo.codigo
   AND prazo.ativo = true
  WHERE tipo.empresa_id = v_empresa_id AND tipo.ativo = true AND v_regime = ANY(tipo.regimes);
  v_configs := CASE WHEN v_configs_salvas IS NULL
    THEN app_private.normalizar_configs_protocolos_cliente(v_empresa_id, p_cliente_id, '[]'::jsonb)
    ELSE app_private.normalizar_configs_protocolos_cliente(v_empresa_id, p_cliente_id, v_configs_salvas)
  END;
  RETURN jsonb_build_object(
    'catalogo', v_catalogo, 'configs', v_configs, 'updatedAt', pg_catalog.to_jsonb(v_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_protocolos_cliente(uuid) TO authenticated;

-- Novos parceiros começam sem modelos ou obrigações implícitas.
CREATE OR REPLACE FUNCTION public.set_default_clientes_modelos_ativos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.modelos_ativos := '{}'::text[];
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_clientes_modelos_ativos()
  FROM PUBLIC, anon, authenticated;

-- Configurações persistidas seguem funcionando; INSERT e ausência de configuração
-- não criam obrigações por modelos legados.
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
  v_guard_anterior text := COALESCE(current_setting('app.obrigacao_config_internal_write', true), 'off');
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.parametrizacao_catalogos tipo_parceiro
    WHERE tipo_parceiro.id = NEW.tipo_parceiro_id AND tipo_parceiro.empresa_id = NEW.empresa_id
      AND tipo_parceiro.tipo = 'tipos_parceiros'
      AND tipo_parceiro.codigo IN ('cliente_contabil', 'tp-1') AND tipo_parceiro.ativo = true
  ) INTO v_cliente_contabil;
  IF v_empresa_sessao IS DISTINCT FROM NEW.empresa_id
     AND NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(NEW.empresa_id::text, 913331)) THEN
    RAISE EXCEPTION 'Obrigações alteradas por outra operação. Tente novamente.' USING ERRCODE = '40001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.matriz_cliente_id IS NULL AND NEW.status = 'Inativa'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.clientes filial SET status = 'Inativa'
    WHERE filial.empresa_id = NEW.empresa_id AND filial.matriz_cliente_id = NEW.id
      AND filial.status <> 'Inativa';
  END IF;
  IF NEW.status IS DISTINCT FROM 'Ativa' OR NOT v_cliente_contabil THEN
    UPDATE public.atividades_rotinas rotina SET ativa = false, atualizado_em = now()
    WHERE rotina.empresa_id = NEW.empresa_id AND rotina.cliente_id = NEW.id
      AND rotina.protocolo_codigo IS NOT NULL AND rotina.ativa = true;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  SELECT cfg.configs INTO v_configs_salvas
  FROM public.configuracoes_protocolos_empresas cfg
  WHERE cfg.empresa_id = NEW.empresa_id AND cfg.cliente_id = NEW.id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_configs := app_private.normalizar_configs_protocolos_cliente(
    NEW.empresa_id, NEW.id, COALESCE(v_configs_salvas, '[]'::jsonb)
  );
  PERFORM set_config('app.obrigacao_config_internal_write', 'on', true);
  INSERT INTO public.configuracoes_protocolos_empresas (empresa_id, cliente_id, configs)
  VALUES (NEW.empresa_id, NEW.id, v_configs)
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE SET configs = EXCLUDED.configs;
  PERFORM set_config('app.obrigacao_config_internal_write', v_guard_anterior, true);
  PERFORM public.sincronizar_rotinas_protocolos_cliente(NEW.empresa_id, NEW.id, v_configs);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.sincronizar_obrigacoes_ciclo_cliente() FROM PUBLIC, anon, authenticated;

-- Toda alteração que possa propagar à filial toma o lock do tenant antes do
-- row lock da matriz, preservando a mesma ordem usada pelas RPCs.
DROP TRIGGER IF EXISTS bloquear_obrigacoes_cliente_statement ON public.clientes;
CREATE TRIGGER bloquear_obrigacoes_cliente_statement
  BEFORE INSERT OR UPDATE OF status, tipo, tipo_parceiro_id, tipo_empresa_id,
    tipo_empresa_catalogo_tipo, natureza_juridica_id,
    natureza_juridica_catalogo_tipo, categoria_cliente ON public.clientes
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.bloquear_obrigacoes_cliente_statement();

-- A matriz é a fonte das classificações comuns; filiais não podem divergir.
CREATE OR REPLACE FUNCTION app_private.sincronizar_classificacoes_matriz_filiais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ciclo boolean := NEW.tipo IS DISTINCT FROM OLD.tipo
    OR NEW.tipo_parceiro_id IS DISTINCT FROM OLD.tipo_parceiro_id;
  v_demais boolean := NEW.tipo_empresa_id IS DISTINCT FROM OLD.tipo_empresa_id
    OR NEW.tipo_empresa_catalogo_tipo IS DISTINCT FROM OLD.tipo_empresa_catalogo_tipo
    OR NEW.natureza_juridica_id IS DISTINCT FROM OLD.natureza_juridica_id
    OR NEW.natureza_juridica_catalogo_tipo IS DISTINCT FROM OLD.natureza_juridica_catalogo_tipo
    OR NEW.categoria_cliente IS DISTINCT FROM OLD.categoria_cliente;
BEGIN
  IF NEW.matriz_cliente_id IS NOT NULL OR NOT (v_ciclo OR v_demais) THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.empresa_id::text, 913331));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.empresa_id::text || ':' || NEW.id::text, 913332)
  );
  IF v_ciclo THEN
    UPDATE public.clientes filial
    SET tipo = NEW.tipo, tipo_parceiro_id = NEW.tipo_parceiro_id
    WHERE filial.empresa_id = NEW.empresa_id AND filial.matriz_cliente_id = NEW.id
      AND (filial.tipo IS DISTINCT FROM NEW.tipo
        OR filial.tipo_parceiro_id IS DISTINCT FROM NEW.tipo_parceiro_id);
  END IF;
  IF v_demais THEN
    UPDATE public.clientes filial
    SET tipo_empresa_id = NEW.tipo_empresa_id,
        tipo_empresa_catalogo_tipo = NEW.tipo_empresa_catalogo_tipo,
        natureza_juridica_id = NEW.natureza_juridica_id,
        natureza_juridica_catalogo_tipo = NEW.natureza_juridica_catalogo_tipo,
        categoria_cliente = NEW.categoria_cliente
    WHERE filial.empresa_id = NEW.empresa_id AND filial.matriz_cliente_id = NEW.id
      AND (filial.tipo_empresa_id IS DISTINCT FROM NEW.tipo_empresa_id
        OR filial.tipo_empresa_catalogo_tipo IS DISTINCT FROM NEW.tipo_empresa_catalogo_tipo
        OR filial.natureza_juridica_id IS DISTINCT FROM NEW.natureza_juridica_id
        OR filial.natureza_juridica_catalogo_tipo IS DISTINCT FROM NEW.natureza_juridica_catalogo_tipo
        OR filial.categoria_cliente IS DISTINCT FROM NEW.categoria_cliente);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_classificacoes_matriz_filiais ON public.clientes;
CREATE TRIGGER sincronizar_classificacoes_matriz_filiais
  AFTER UPDATE OF tipo, tipo_parceiro_id, tipo_empresa_id,
    tipo_empresa_catalogo_tipo, natureza_juridica_id,
    natureza_juridica_catalogo_tipo, categoria_cliente ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION app_private.sincronizar_classificacoes_matriz_filiais();

REVOKE ALL ON FUNCTION app_private.sincronizar_classificacoes_matriz_filiais()
  FROM PUBLIC, anon, authenticated;
