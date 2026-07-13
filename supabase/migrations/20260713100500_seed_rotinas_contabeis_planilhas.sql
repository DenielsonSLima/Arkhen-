-- Pré-cadastra as rotinas operacionais enviadas pela contabilidade
-- para todas as empresas existentes e garante que clientes não fiquem vazios.

CREATE OR REPLACE FUNCTION public.set_atividades_modelos_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_atividades_modelos ON public.atividades_modelos;
CREATE TRIGGER set_updated_at_atividades_modelos
  BEFORE UPDATE ON public.atividades_modelos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atividades_modelos_atualizado_em();

WITH modelos(codigo, nome, descricao, tipos, etapas, ordem) AS (
  VALUES
    (
      'folha-pagamento',
      'Folha de Pagamento',
      'Checklist para apuração de folha normal, encargos, DCTFWeb e envio ao cliente.',
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
    )
)
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
  e.id,
  m.codigo,
  m.nome,
  m.descricao,
  'Controle',
  m.tipos,
  m.etapas,
  true,
  true,
  m.ordem
FROM public.empresas e
CROSS JOIN modelos m
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

UPDATE public.clientes c
SET modelos_ativos = (
  SELECT COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}')
  FROM public.atividades_modelos am
  WHERE am.empresa_id = c.empresa_id
    AND am.ativo = true
    AND (
      am.tipos IS NULL
      OR cardinality(am.tipos) = 0
      OR c.tipo = ANY(am.tipos)
      OR (c.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
      OR (c.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
    )
)
WHERE c.modelos_ativos IS NULL
   OR cardinality(c.modelos_ativos) = 0
   OR NOT EXISTS (
     SELECT 1
     FROM unnest(c.modelos_ativos) AS modelo_ativo(modelo_id)
     JOIN public.atividades_modelos am
       ON am.id::text = modelo_ativo.modelo_id
      AND am.empresa_id = c.empresa_id
      AND am.ativo = true
   );
