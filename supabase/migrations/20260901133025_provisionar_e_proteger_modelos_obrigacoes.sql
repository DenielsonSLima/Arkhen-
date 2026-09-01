-- Provisiona a raiz canônica para novos tenants e protege os modelos espelho.

-- A reconciliação anterior pode ter alterado regimes/estado da obrigação antes
-- de o trigger canônico existir. Alinha imediatamente todo modelo já vinculado.
DO $$
DECLARE
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_canonica_write', true), 'off'
  );
BEGIN
  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);
  UPDATE public.atividades_modelos modelo
  SET nome = tipo.nome,
      descricao = tipo.descricao,
      categoria = CASE
        WHEN tipo.categoria = 'Trabalhista' THEN 'Folha'
        WHEN tipo.categoria IN ('Fiscal', 'Financeiro', 'Contábil')
          THEN tipo.categoria
        ELSE 'Controle'
      END,
      tipos = tipo.regimes,
      etapas = tipo.etapas,
      sistema = tipo.sistema,
      ativo = tipo.ativo,
      ordem = tipo.ordem,
      atualizado_em = now()
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = modelo.empresa_id
    AND tipo.modelo_atividade_id = modelo.id;
  PERFORM set_config('app.obrigacao_canonica_write', v_guard_anterior, true);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.unificar_obrigacoes_nova_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.parametrizacao_protocolos_tipos (
    empresa_id, codigo, nome, categoria, orgao, dia_limite, descricao, regimes,
    periodicidade_padrao, origem_padrao, sistema, ativo, etapas, tem_vencimento,
    referencia_mes_anterior, dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena, ordem, modelo_atividade_id
  )
  SELECT
    modelo.empresa_id,
    modelo.codigo,
    modelo.nome,
    CASE
      WHEN modelo.codigo = 'obras' THEN 'Trabalhista'
      WHEN modelo.codigo IN ('dctfweb-tributos-federais', 'obrigacoes-mensais')
        THEN 'Fiscal'
      WHEN modelo.categoria IN ('Fiscal', 'Contábil', 'Trabalhista', 'Financeiro')
        THEN modelo.categoria
      WHEN lower(modelo.nome) LIKE '%folha%' OR lower(modelo.nome) LIKE '%pró-labore%'
        THEN 'Trabalhista'
      ELSE 'Documentos'
    END,
    '',
    20,
    modelo.descricao,
    CASE WHEN COALESCE(cardinality(modelo.tipos), 0) = 0
      THEN ARRAY[
        'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'
      ]::text[]
      ELSE ARRAY(
        SELECT DISTINCT CASE WHEN regime = 'Isento' THEN 'Isenta' ELSE regime END
        FROM unnest(modelo.tipos) regime
        WHERE regime IN (
          'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido',
          'Lucro Real', 'Isenta', 'Isento'
        )
      )
    END,
    'mensal',
    'Ambos',
    modelo.sistema,
    modelo.ativo,
    modelo.etapas,
    false,
    true,
    15,
    30,
    modelo.ordem,
    modelo.id
  FROM public.atividades_modelos modelo
  WHERE modelo.empresa_id = NEW.id
    AND modelo.codigo <> 'tarefas-internas'
    AND NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_protocolos_tipos tipo
      WHERE tipo.empresa_id = modelo.empresa_id
        AND tipo.codigo = modelo.codigo
    );

  -- Os seeds históricos só alcançavam empresas já existentes. Depois de
  -- aproveitar qualquer modelo criado por outro provisionador, completa os
  -- fluxos padrão diretamente na raiz canônica do novo tenant.
  WITH padroes(
    codigo, nome, descricao, categoria, regimes, etapas, ordem
  ) AS (
    VALUES
      (
        'folha-pagamento',
        'Folha de Pagamento',
        'Checklist para apuração de folha normal, encargos, DCTFWeb e envio ao cliente.',
        'Trabalhista',
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
          'Enviar relação de férias',
          'Registrar contato da empresa e forma de envio',
          'Arquivar comprovantes e protocolos'
        ]::text[]),
        10
      ),
      (
        'pro-labore',
        'Pró-Labore',
        'Checklist para empresas que possuem apenas pró-labore ou retirada de sócios.',
        'Trabalhista',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir sócios ativos',
          'Calcular retirada e INSS',
          'Conferir DARF IRRF',
          'Conferir SEFIP',
          'Conferir PIS',
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
        'Checklist para controle de obras, FGTS, eSocial, DCTFWeb e DARF INSS.',
        'Trabalhista',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir folha de pagamento da obra',
          'Conferir valor INSS',
          'Conferir FGTS',
          'Gerar guia FGTS',
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
        'Controle de valores da competência para DCTFWeb geral e tributos federais.',
        'Fiscal',
        ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Conferir PIS',
          'Conferir COFINS',
          'Calcular IRPJ',
          'Calcular CSLL',
          'Verificar retenções 1708, 3208 e 5952',
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
        'Fiscal',
        ARRAY['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
        to_jsonb(ARRAY[
          'Verificar notas fiscais emitidas',
          'Gerar guia DAS (Simples) ou guias federais',
          'Transmitir PGDAS-D ou EFD-Contribuições',
          'Enviar guias e comprovantes ao cliente'
        ]::text[]),
        50
      )
  )
  INSERT INTO public.parametrizacao_protocolos_tipos (
    empresa_id, codigo, nome, categoria, orgao, dia_limite, descricao, regimes,
    periodicidade_padrao, origem_padrao, sistema, ativo, etapas, tem_vencimento,
    referencia_mes_anterior, dia_vencimento_primeira_quinzena,
    dia_vencimento_segunda_quinzena, ordem
  )
  SELECT
    NEW.id, padrao.codigo, padrao.nome, padrao.categoria, '', 20,
    padrao.descricao, padrao.regimes, 'mensal', 'Ambos', true, true,
    padrao.etapas, false, true, 15, 30, padrao.ordem
  FROM padroes padrao
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.empresa_id = NEW.id
      AND tipo.codigo = padrao.codigo
  )
  ON CONFLICT (empresa_id, codigo) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_unificar_obrigacoes_after_empresa_insert
  ON public.empresas;
CREATE TRIGGER zz_unificar_obrigacoes_after_empresa_insert
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.unificar_obrigacoes_nova_empresa();

REVOKE ALL ON FUNCTION app_private.unificar_obrigacoes_nova_empresa()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.proteger_modelo_obrigacao_canonica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_modelo_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_empresa_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.empresa_id ELSE NEW.empresa_id END;
BEGIN
  IF current_setting('app.obrigacao_canonica_write', true) IS DISTINCT FROM 'on'
     AND EXISTS (
       SELECT 1
       FROM public.parametrizacao_protocolos_tipos tipo
       WHERE tipo.empresa_id = v_empresa_id
         AND tipo.modelo_atividade_id = v_modelo_id
     ) THEN
    RAISE EXCEPTION 'Edite este fluxo pelo módulo Obrigações.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_modelo_obrigacao_canonica
  ON public.atividades_modelos;
CREATE TRIGGER proteger_modelo_obrigacao_canonica
  BEFORE UPDATE OR DELETE ON public.atividades_modelos
  FOR EACH ROW
  EXECUTE FUNCTION app_private.proteger_modelo_obrigacao_canonica();

REVOKE ALL ON FUNCTION app_private.proteger_modelo_obrigacao_canonica()
  FROM PUBLIC, anon, authenticated;
