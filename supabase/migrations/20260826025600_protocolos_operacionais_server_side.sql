-- Projeta prazos/competencias no servidor e valida catálogo, regime e
-- periodicidade em toda configuração ou atualização de protocolo.
BEGIN;

-- Reconcilia o contrato versionado com o catálogo que o frontend e as RPCs
-- já consomem. Em bancos antigos o identificador de negócio estava somente
-- em `id`, que também não possuía default para novos tenants.
ALTER TABLE public.parametrizacao_protocolos_tipos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS orgao text,
  ADD COLUMN IF NOT EXISTS sistema boolean;

UPDATE public.parametrizacao_protocolos_tipos
SET codigo = COALESCE(NULLIF(btrim(codigo), ''), btrim(id::text)),
    sistema = COALESCE(sistema, true)
WHERE codigo IS NULL OR btrim(codigo) = '' OR sistema IS NULL;

ALTER TABLE public.parametrizacao_protocolos_tipos
  ALTER COLUMN codigo SET NOT NULL,
  ALTER COLUMN sistema SET DEFAULT true,
  ALTER COLUMN sistema SET NOT NULL;

-- O histórico possui instalações com `id` uuid e outras com `id` text.
-- Preserva o tipo real da coluna ao definir o default de novos catálogos.
DO $$
DECLARE
  v_id_type regtype;
BEGIN
  SELECT atributo.atttypid::regtype
  INTO v_id_type
  FROM pg_catalog.pg_attribute atributo
  WHERE atributo.attrelid = 'public.parametrizacao_protocolos_tipos'::regclass
    AND atributo.attname = 'id'
    AND atributo.attnum > 0
    AND NOT atributo.attisdropped;

  IF v_id_type = 'uuid'::regtype THEN
    EXECUTE 'ALTER TABLE public.parametrizacao_protocolos_tipos '
      || 'ALTER COLUMN id SET DEFAULT gen_random_uuid()';
  ELSE
    EXECUTE 'ALTER TABLE public.parametrizacao_protocolos_tipos '
      || 'ALTER COLUMN id SET DEFAULT gen_random_uuid()::text';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS parametrizacao_protocolos_tipos_empresa_codigo_uidx
  ON public.parametrizacao_protocolos_tipos (empresa_id, codigo);

CREATE OR REPLACE FUNCTION public.validar_catalogo_configuracao_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
BEGIN
  SELECT cliente.tipo
  INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.id = NEW.cliente_id
    AND cliente.empresa_id = NEW.empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de protocolos inválida.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(NEW.configs) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de protocolos inválida.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(NEW.configs) > 200
     OR octet_length(NEW.configs::text) > 65536 THEN
    RAISE EXCEPTION 'Configuração de protocolos inválida.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.configs) config_item(valor)
    WHERE jsonb_typeof(config_item.valor) IS DISTINCT FROM 'object'
  ) THEN
    RAISE EXCEPTION 'Itens da configuração de protocolos são inválidos.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.configs) config_item(valor)
    WHERE jsonb_typeof(config_item.valor -> 'entregaId') IS DISTINCT FROM 'string'
       OR char_length(btrim(config_item.valor ->> 'entregaId')) NOT BETWEEN 1 AND 180
       OR jsonb_typeof(config_item.valor -> 'ativo') IS DISTINCT FROM 'boolean'
       OR (
         config_item.valor ? 'periodicidade'
         AND (
           jsonb_typeof(config_item.valor -> 'periodicidade') IS DISTINCT FROM 'string'
           OR config_item.valor ->> 'periodicidade'
             NOT IN ('mensal', 'quinzenal', 'trimestral', 'semestral')
         )
       )
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(config_item.valor) chave
         WHERE chave NOT IN ('entregaId', 'ativo', 'periodicidade')
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.parametrizacao_protocolos_tipos tipo
         WHERE tipo.empresa_id = NEW.empresa_id
           AND tipo.codigo = btrim(config_item.valor ->> 'entregaId')
           AND tipo.ativo = true
           AND v_regime = ANY(tipo.regimes)
       )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.configs) config_item(valor)
    GROUP BY config_item.valor ->> 'entregaId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A configuração contém obrigação ausente, inativa ou incompatível com o regime.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_catalogo_configuracao_protocolo()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validar_catalogo_configuracao_protocolo_trigger
  ON public.configuracoes_protocolos_empresas;
CREATE TRIGGER validar_catalogo_configuracao_protocolo_trigger
  BEFORE INSERT OR UPDATE ON public.configuracoes_protocolos_empresas
  FOR EACH ROW EXECUTE FUNCTION public.validar_catalogo_configuracao_protocolo();

CREATE OR REPLACE FUNCTION public.validar_identidade_protocolo_operacional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
  v_cliente_criado_em timestamptz;
  v_periodicidade text;
  v_competencia date;
  v_periodo_key text;
  v_mes_atual date := date_trunc(
    'month', timezone('America/Sao_Paulo', now())
  )::date;
BEGIN
  SELECT cliente.tipo, cliente.created_at
  INTO v_regime, v_cliente_criado_em
  FROM public.clientes cliente
  WHERE cliente.id = NEW.cliente_id
    AND cliente.empresa_id = NEW.empresa_id;

  IF NOT FOUND OR NEW.competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Identidade de protocolo inválida.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
    NULLIF(btrim(config_item.valor ->> 'periodicidade'), ''),
    prazo.fechamento,
    tipo.periodicidade_padrao,
    'mensal'
  )
  INTO v_periodicidade
  FROM public.configuracoes_protocolos_empresas configuracao
  CROSS JOIN LATERAL jsonb_array_elements(configuracao.configs) config_item(valor)
  JOIN public.parametrizacao_protocolos_tipos tipo
    ON tipo.empresa_id = configuracao.empresa_id
   AND tipo.codigo = config_item.valor ->> 'entregaId'
   AND tipo.ativo = true
   AND v_regime = ANY(tipo.regimes)
  LEFT JOIN public.parametrizacao_prazos_entrega prazo
    ON prazo.empresa_id = configuracao.empresa_id
   AND prazo.regime = v_regime
   AND prazo.entrega_id = tipo.codigo
  WHERE configuracao.empresa_id = NEW.empresa_id
    AND configuracao.cliente_id = NEW.cliente_id
    AND config_item.valor ->> 'entregaId' = NEW.entrega_id
    AND config_item.valor ->> 'ativo' = 'true'
    AND (prazo.id IS NULL OR prazo.ativo = true)
  LIMIT 1;

  IF v_periodicidade IS NULL THEN
    RAISE EXCEPTION 'Protocolo não está ativo para o cliente e regime informados.'
      USING ERRCODE = '23514';
  END IF;

  IF v_periodicidade NOT IN ('mensal', 'quinzenal', 'trimestral', 'semestral') THEN
    RAISE EXCEPTION 'Periodicidade de protocolo inválida.'
      USING ERRCODE = '23514';
  END IF;

  v_competencia := to_date(NEW.competencia || '-01', 'YYYY-MM-DD');
  IF v_competencia < v_mes_atual - interval '2 months'
     OR v_competencia > v_mes_atual
     OR v_competencia < date_trunc(
       'month',
       v_cliente_criado_em AT TIME ZONE 'America/Sao_Paulo'
     )::date THEN
    RAISE EXCEPTION 'Competência fora da janela operacional permitida.'
      USING ERRCODE = '23514';
  END IF;

  IF (v_periodicidade = 'mensal' AND NEW.periodo_referencia <> 'Mensal')
     OR (v_periodicidade = 'quinzenal' AND NEW.periodo_referencia NOT IN ('1ª quinzena', '2ª quinzena'))
     OR (v_periodicidade = 'trimestral' AND (
       NEW.periodo_referencia <> 'Trimestral'
       OR extract(month FROM v_competencia)::integer NOT IN (3, 6, 9, 12)
     ))
     OR (v_periodicidade = 'semestral' AND (
       NEW.periodo_referencia <> 'Semestral'
       OR extract(month FROM v_competencia)::integer NOT IN (6, 12)
     )) THEN
    RAISE EXCEPTION 'Período incompatível com a periodicidade configurada.'
      USING ERRCODE = '23514';
  END IF;

  v_periodo_key := CASE NEW.periodo_referencia
    WHEN '1ª quinzena' THEN 'q1'
    WHEN '2ª quinzena' THEN 'q2'
    WHEN 'Trimestral' THEN 'trimestral'
    WHEN 'Semestral' THEN 'semestral'
    ELSE 'mensal'
  END;

  IF NEW.id <> NEW.cliente_id::text || '-' || NEW.competencia || '-'
    || NEW.entrega_id || '-' || v_periodo_key THEN
    RAISE EXCEPTION 'Identificador de protocolo inválido.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_identidade_protocolo_operacional()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validar_identidade_protocolo_operacional_trigger
  ON public.protocolos_entregas;
CREATE TRIGGER validar_identidade_protocolo_operacional_trigger
  BEFORE INSERT OR UPDATE ON public.protocolos_entregas
  FOR EACH ROW EXECUTE FUNCTION public.validar_identidade_protocolo_operacional();

CREATE OR REPLACE FUNCTION public.get_protocolos_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := (SELECT public.current_empresa_id());
  v_resultado jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_empresa_id IS NULL OR NOT (
    public.current_user_has_permission(v_empresa_id, 'protocolos:view')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:create')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:manage')
    OR public.current_user_has_permission(v_empresa_id, 'protocolos:view-own')
  ) THEN
    RAISE EXCEPTION 'Protocolos não encontrados.' USING ERRCODE = '42501';
  END IF;

  WITH competencias AS (
    SELECT (
      date_trunc('month', timezone('America/Sao_Paulo', now()))
      - make_interval(months => offset_value)
    )::date AS competencia
    FROM generate_series(0, 2) offset_value
  ), configurados AS (
    SELECT
      cliente.*,
      tipo.codigo AS entrega_id,
      tipo.nome AS entrega_nome,
      tipo.categoria,
      tipo.orgao,
      tipo.origem_padrao,
      competencia.competencia,
      COALESCE(
        NULLIF(btrim(config_item.valor ->> 'periodicidade'), ''),
        prazo.fechamento,
        tipo.periodicidade_padrao,
        'mensal'
      ) AS fechamento,
      COALESCE(prazo.referencia_mes_anterior, true) AS referencia_mes_anterior,
      COALESCE(prazo.dia_vencimento, tipo.dia_limite) AS dia_vencimento,
      COALESCE(prazo.dia_vencimento_primeira_quinzena, 20) AS dia_primeira,
      COALESCE(
        prazo.dia_vencimento_segunda_quinzena,
        prazo.dia_vencimento,
        tipo.dia_limite
      ) AS dia_segunda
    FROM public.clientes cliente
    JOIN public.configuracoes_protocolos_empresas configuracao
      ON configuracao.empresa_id = cliente.empresa_id
     AND configuracao.cliente_id = cliente.id
    CROSS JOIN LATERAL jsonb_array_elements(configuracao.configs) config_item(valor)
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = cliente.empresa_id
     AND tipo.codigo = config_item.valor ->> 'entregaId'
     AND tipo.ativo = true
     AND cliente.tipo = ANY(tipo.regimes)
    LEFT JOIN public.parametrizacao_prazos_entrega prazo
      ON prazo.empresa_id = cliente.empresa_id
     AND prazo.regime = cliente.tipo
     AND prazo.entrega_id = tipo.codigo
    CROSS JOIN competencias competencia
    WHERE cliente.empresa_id = v_empresa_id
      AND config_item.valor ->> 'ativo' = 'true'
      AND (prazo.id IS NULL OR prazo.ativo = true)
      AND competencia.competencia >= date_trunc(
        'month',
        cliente.created_at AT TIME ZONE 'America/Sao_Paulo'
      )::date
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ), periodos AS (
    SELECT configurado.*, periodo.periodo_referencia, periodo.periodo_key, periodo.dia
    FROM configurados configurado
    CROSS JOIN LATERAL (
      SELECT 'Mensal'::text, 'mensal'::text, configurado.dia_vencimento
      WHERE configurado.fechamento = 'mensal'
      UNION ALL
      SELECT '1ª quinzena', 'q1', configurado.dia_primeira
      WHERE configurado.fechamento = 'quinzenal'
      UNION ALL
      SELECT '2ª quinzena', 'q2', configurado.dia_segunda
      WHERE configurado.fechamento = 'quinzenal'
      UNION ALL
      SELECT 'Trimestral', 'trimestral', configurado.dia_vencimento
      WHERE configurado.fechamento = 'trimestral'
        AND extract(month FROM configurado.competencia)::integer IN (3, 6, 9, 12)
      UNION ALL
      SELECT 'Semestral', 'semestral', configurado.dia_vencimento
      WHERE configurado.fechamento = 'semestral'
        AND extract(month FROM configurado.competencia)::integer IN (6, 12)
    ) periodo(periodo_referencia, periodo_key, dia)
  ), projetados AS (
    SELECT
      periodo.*,
      periodo.id::text || '-' || to_char(periodo.competencia, 'YYYY-MM') || '-'
        || periodo.entrega_id || '-' || periodo.periodo_key AS protocolo_id,
      (
        date_trunc('month', periodo.competencia + CASE
          WHEN periodo.referencia_mes_anterior THEN interval '1 month'
          ELSE interval '0 month'
        END)
        + (
          least(
            periodo.dia,
            extract(day FROM (
              date_trunc('month', periodo.competencia + CASE
                WHEN periodo.referencia_mes_anterior THEN interval '2 months'
                ELSE interval '1 month'
              END) - interval '1 day'
            ))::integer
          ) - 1
        ) * interval '1 day'
      )::date AS prazo
    FROM periodos periodo
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', projetado.protocolo_id,
    'empresaId', projetado.id::text,
    'empresaNome', projetado.nome,
    'empresaCnpj', COALESCE(projetado.cnpj, ''),
    'empresaStatus', projetado.status,
    'empresaTipo', projetado.tipo,
    'empresaTipoEstabelecimento', projetado.tipo_estabelecimento,
    'empresaEmail', COALESCE(projetado.email, ''),
    'empresaTelefone', COALESCE(projetado.telefone, ''),
    'empresaLogo', projetado.logo,
    'competencia', to_char(projetado.competencia, 'YYYY-MM'),
    'periodoReferencia', projetado.periodo_referencia,
    'entregaId', projetado.entrega_id,
    'entregaNome', projetado.entrega_nome,
    'categoria', projetado.categoria,
    'orgao', projetado.orgao,
    'origemPadrao', COALESCE(projetado.origem_padrao, 'Ambos'),
    'prazo', projetado.prazo::text,
    'status', COALESCE(salvo.status, 'Pendente'),
    'atualizadoEm', COALESCE(salvo.atualizado_em::text, ''),
    'responsavel', '',
    'anotacoesList', COALESCE(salvo.anotacoes_list, '[]'::jsonb),
    'recebidoEm', COALESCE(salvo.recebido_em::text, ''),
    'concluidoPor', COALESCE(salvo.concluido_por, '')
  ) ORDER BY projetado.competencia DESC, projetado.nome, projetado.entrega_nome), '[]'::jsonb)
  INTO v_resultado
  FROM projetados projetado
  LEFT JOIN public.protocolos_entregas salvo
    ON salvo.id = projetado.protocolo_id
   AND salvo.empresa_id = projetado.empresa_id
   AND salvo.cliente_id = projetado.id
   AND salvo.entrega_id = projetado.entrega_id
   AND salvo.competencia = to_char(projetado.competencia, 'YYYY-MM')
   AND salvo.periodo_referencia = projetado.periodo_referencia;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.get_protocolos_operacionais()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_protocolos_operacionais()
  TO authenticated;

COMMIT;
