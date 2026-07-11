-- Garante modelos padrão de checklists para todas as empresas/tenants existentes.

WITH modelos(codigo, nome, descricao, tipos, etapas, ordem) AS (
  VALUES
    (
      'folha-pagamento',
      'Folha de Pagamento',
      'Checklist para apuração de folha de funcionários da empresa.',
      ARRAY['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
      to_jsonb(ARRAY[
        'Fechar folha no sistema',
        'Gerar guias FGTS (FGTS Digital)',
        'Enviar eventos ao eSocial',
        'Conferir INSS e IRRF',
        'Emitir recibos de pagamento',
        'Gerar relatórios para o cliente',
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
        'Gerar DARF de Pró-Labore',
        'Enviar informações ao eSocial',
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
        'Gerar FGTS da obra',
        'Transmitir eSocial de obra específica',
        'Conferir retenções de INSS',
        'Atualizar cadastro CNO/CEI',
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
WHERE NOT EXISTS (
  SELECT 1
  FROM public.atividades_modelos am
  WHERE am.empresa_id = e.id
    AND am.codigo = m.codigo
);
