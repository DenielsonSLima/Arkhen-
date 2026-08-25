-- Garante os seis modelos operacionais canônicos por empresa e vincula clientes
-- ativos sem configuração válida. A migration é idempotente e não expõe funções
-- administrativas à API.
-- Versao registrada no Supabase de producao: 20260825234336.

CREATE OR REPLACE FUNCTION public.provisionar_atividades_modelos_empresa(
  p_empresa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_empresa_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.atividades_modelos (
    empresa_id,
    codigo,
    nome,
    descricao,
    categoria,
    tipos,
    etapas,
    sistema,
    ativo,
    ordem
  )
  SELECT
    p_empresa_id,
    modelo.codigo,
    modelo.nome,
    modelo.descricao,
    'Controle',
    modelo.tipos,
    modelo.etapas,
    true,
    true,
    modelo.ordem
  FROM (
    VALUES
      (
        'folha-pagamento',
        'Folha de Pagamento',
        'Checklist para apuração de folha de funcionários da empresa.',
        ARRAY['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir quinzenas',
          'Conferir empréstimo consignado',
          'Fechar folha no sistema',
          'Conferir pró-labore vinculado à folha',
          'Gerar guias FGTS (FGTS Digital)',
          'Conferir PIS',
          'Enviar eventos ao eSocial',
          'Conferir valor INSS',
          'Conferir valor IRRF',
          'Conferir valor REINF',
          'Transmitir DCTFWeb',
          'Gerar DARF INSS',
          'Conferir data-base e sindicato',
          'Emitir recibos de pagamento',
          'Enviar relação de férias',
          'Registrar contato da empresa e forma de envio',
          'Arquivar comprovantes e protocolos'
        ]::text[]),
        10
      ),
      (
        'pro-labore',
        'Pró-Labore',
        'Checklist para apuração de pró-labore de sócios e diretores.',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir sócios ativos',
          'Calcular retirada e INSS',
          'Conferir DARF IRRF',
          'Conferir SEFIP',
          'Conferir PIS',
          'Gerar DARF de Pró-Labore',
          'Enviar informações ao eSocial',
          'Transmitir DCTFWeb',
          'Gerar DARF INSS',
          'Enviar ao cliente',
          'Registrar contato da empresa e forma de envio',
          'Arquivar comprovantes do período'
        ]::text[]),
        20
      ),
      (
        'obras',
        'Obras',
        'Checklist para controle fiscal e de folha de obras de construção civil.',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir folha de pagamento da obra',
          'Conferir valor INSS',
          'Conferir FGTS',
          'Gerar FGTS da obra',
          'Transmitir eSocial de obra específica',
          'Transmitir DCTFWeb',
          'Gerar DARF INSS',
          'Conferir retenções de INSS',
          'Atualizar cadastro CNO/CEI',
          'Enviar para contabilidade/cliente',
          'Arquivar comprovantes da obra'
        ]::text[]),
        30
      ),
      (
        'dctfweb-tributos-federais',
        'DCTFWeb / Tributos Federais',
        'Fechamento e consolidação de obrigações e valores tributários federais.',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir PIS e COFINS',
          'Calcular IRPJ e CSLL Trimestral',
          'Verificar retenções (1708, 3208, 5952)',
          'Conferir ISS retido',
          'Conferir Funrural',
          'Preencher valores da competência',
          'Transmitir DCTFWeb',
          'Gerar DARFs federais',
          'Arquivar recibos e guias'
        ]::text[]),
        40
      ),
      (
        'obrigacoes-mensais',
        'Obrigações Mensais',
        'Envio de declarações acessórias mensais da empresa.',
        ARRAY['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Verificar notas fiscais emitidas',
          'Gerar guia DAS (Simples) ou guias federais',
          'Transmitir PGDAS-D ou EFD-Contribuições',
          'Enviar guias e comprovantes ao cliente'
        ]::text[]),
        50
      ),
      (
        'tarefas-internas',
        'Tarefas Internas',
        'Procedimentos e tarefas administrativas internas do escritório.',
        ARRAY['PF', 'MEI', 'Isento', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Organizar documentos recebidos',
          'Conciliar extrato bancário',
          'Arquivar recibos e protocolos',
          'Atualizar painel de acompanhamento'
        ]::text[]),
        60
      )
  ) AS modelo(codigo, nome, descricao, tipos, etapas, ordem)
  ON CONFLICT (empresa_id, codigo)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    tipos = EXCLUDED.tipos,
    etapas = EXCLUDED.etapas,
    sistema = true,
    ativo = true,
    ordem = EXCLUDED.ordem,
    atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.provisionar_atividades_modelos_nova_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.provisionar_atividades_modelos_empresa(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provisionar_atividades_modelos_after_insert
  ON public.empresas;
CREATE TRIGGER provisionar_atividades_modelos_after_insert
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.provisionar_atividades_modelos_nova_empresa();

CREATE OR REPLACE FUNCTION public.set_default_clientes_modelos_ativos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.modelos_ativos IS NULL OR cardinality(NEW.modelos_ativos) = 0 THEN
    SELECT COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}')
    INTO NEW.modelos_ativos
    FROM public.atividades_modelos am
    WHERE am.empresa_id = NEW.empresa_id
      AND am.ativo = true
      AND (
        am.tipos IS NULL
        OR cardinality(am.tipos) = 0
        OR NEW.tipo = ANY(am.tipos)
        OR (NEW.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
        OR (NEW.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_clientes_modelos_ativos_before_insert
  ON public.clientes;
CREATE TRIGGER set_clientes_modelos_ativos_before_insert
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_clientes_modelos_ativos();

DO $$
DECLARE
  v_empresa record;
BEGIN
  FOR v_empresa IN
    SELECT e.id
    FROM public.empresas e
  LOOP
    PERFORM public.provisionar_atividades_modelos_empresa(v_empresa.id);
  END LOOP;
END;
$$;

WITH clientes_reparar AS (
  SELECT c.id, c.empresa_id, c.tipo
  FROM public.clientes c
  WHERE c.status = 'Ativa'
    AND (
      c.modelos_ativos IS NULL
      OR cardinality(c.modelos_ativos) = 0
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(c.modelos_ativos) AS modelo_ativo(modelo_id)
        JOIN public.atividades_modelos am
          ON am.id::text = modelo_ativo.modelo_id
         AND am.empresa_id = c.empresa_id
         AND am.ativo = true
         AND (
           am.tipos IS NULL
           OR cardinality(am.tipos) = 0
           OR c.tipo = ANY(am.tipos)
           OR (c.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
           OR (c.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
         )
      )
    )
),
modelos_compativeis AS (
  SELECT
    c.id AS cliente_id,
    COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}') AS modelos_ativos
  FROM clientes_reparar c
  JOIN public.atividades_modelos am
    ON am.empresa_id = c.empresa_id
   AND am.ativo = true
   AND (
     am.tipos IS NULL
     OR cardinality(am.tipos) = 0
     OR c.tipo = ANY(am.tipos)
     OR (c.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
     OR (c.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
   )
  GROUP BY c.id
)
UPDATE public.clientes c
SET modelos_ativos = mc.modelos_ativos
FROM modelos_compativeis mc
WHERE c.id = mc.cliente_id
  AND cardinality(mc.modelos_ativos) > 0
  AND c.modelos_ativos IS DISTINCT FROM mc.modelos_ativos;

REVOKE ALL ON FUNCTION public.provisionar_atividades_modelos_empresa(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.provisionar_atividades_modelos_nova_empresa()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_default_clientes_modelos_ativos()
  FROM PUBLIC, anon, authenticated, service_role;
