-- Cadastra a B & M Contabilidade e sua rotina mensal de folha.
-- Fonte: ROTINA FIXA SETOR PESSOAL.xlsx (somente dados operacionais não sensíveis).

DO $migration$
DECLARE
  v_empresa_id uuid;
  v_cliente_id uuid;
  v_modelo_id uuid;
  v_competencia varchar := to_char(CURRENT_DATE - interval '1 month', 'MM/YYYY');
  v_etapas jsonb := to_jsonb(ARRAY[
    'Conferir quinzenas',
    'Conferir empréstimo consignado',
    'Fechar folha de pagamento',
    'Conferir pró-labore',
    'Gerar guias FGTS (FGTS Digital)',
    'Conferir PIS',
    'Conferir valor INSS',
    'Conferir valor IRRF',
    'Conferir valor REINF',
    'Enviar eventos ao eSocial',
    'Transmitir DCTFWeb',
    'Gerar DARF INSS',
    'Conferir data-base',
    'Conferir sindicato',
    'Enviar relação de férias',
    'Enviar documentos ao cliente',
    'Arquivar comprovantes e protocolos'
  ]::text[]);
  v_checklists jsonb;
BEGIN
  SELECT e.id
    INTO v_empresa_id
  FROM public.empresas e
  WHERE e.status = 'ativo'
    AND EXISTS (
      SELECT 1
      FROM public.perfis p
      WHERE p.empresa_id = e.id
        AND p.ativo = true
    )
  ORDER BY e.created_at
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE NOTICE 'Tenant operacional da B & M não encontrado; cadastro ignorado.';
    RETURN;
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
  VALUES (
    v_empresa_id,
    'bm-folha-pagamento',
    'Folha de Pagamento - B & M Contabilidade',
    'Checklist mensal da B & M importado da rotina fixa do setor pessoal.',
    'Folha',
    ARRAY['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']::text[],
    v_etapas,
    false,
    true,
    70
  )
  ON CONFLICT (empresa_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      categoria = EXCLUDED.categoria,
      tipos = EXCLUDED.tipos,
      etapas = EXCLUDED.etapas,
      sistema = false,
      ativo = true,
      ordem = EXCLUDED.ordem,
      atualizado_em = now()
  RETURNING id INTO v_modelo_id;

  SELECT c.id
    INTO v_cliente_id
  FROM public.clientes c
  WHERE c.empresa_id = v_empresa_id
    AND regexp_replace(lower(trim(c.nome)), '[^a-z0-9]+', '', 'g') IN (
      'bmcontabilidade',
      'bmassessoriaeconsultoriacontabil'
    )
  ORDER BY c.created_at
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      empresa_id,
      nome,
      razao_social,
      tipo,
      tipo_estabelecimento,
      logo,
      contato,
      status,
      modelos_ativos
    )
    VALUES (
      v_empresa_id,
      'B & M Contabilidade',
      'B & M Assessoria e Consultoria Contábil',
      'Simples Nacional',
      'Matriz',
      'https://dgklhykjwzmeqxejlicz.supabase.co/storage/v1/object/public/app-assets/cliente-logos/bm-contabilidade/bm-logo.png',
      'Karine',
      'Ativa',
      ARRAY[v_modelo_id::text]
    )
    RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE public.clientes
    SET nome = 'B & M Contabilidade',
        razao_social = CASE
          WHEN trim(COALESCE(razao_social, '')) = ''
            THEN 'B & M Assessoria e Consultoria Contábil'
          ELSE razao_social
        END,
        logo = 'https://dgklhykjwzmeqxejlicz.supabase.co/storage/v1/object/public/app-assets/cliente-logos/bm-contabilidade/bm-logo.png',
        contato = CASE
          WHEN trim(COALESCE(contato, '')) = '' THEN 'Karine'
          ELSE contato
        END,
        status = 'Ativa',
        modelos_ativos = CASE
          WHEN v_modelo_id::text = ANY(COALESCE(modelos_ativos, ARRAY[]::text[]))
            THEN COALESCE(modelos_ativos, ARRAY[]::text[])
          ELSE array_append(COALESCE(modelos_ativos, ARRAY[]::text[]), v_modelo_id::text)
        END,
        updated_at = now()
    WHERE id = v_cliente_id;
  END IF;

  SELECT COALESCE(jsonb_object_agg(etapa.nome, false), '{}'::jsonb)
    INTO v_checklists
  FROM jsonb_array_elements_text(v_etapas) AS etapa(nome);

  INSERT INTO public.atividades_instancias (
    empresa_id,
    cliente_id,
    modelo_id,
    cliente_nome,
    modelo_codigo,
    competencia,
    status,
    checklists,
    checklist_dates,
    checklist_users,
    valores,
    ativo
  )
  VALUES (
    v_empresa_id,
    v_cliente_id,
    v_modelo_id,
    'B & M Contabilidade',
    'bm-folha-pagamento',
    v_competencia,
    'Pendente',
    v_checklists,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
  )
  ON CONFLICT (empresa_id, cliente_id, modelo_id, competencia)
    WHERE ativo = true
      AND cliente_id IS NOT NULL
      AND modelo_id IS NOT NULL
  DO UPDATE SET
    cliente_nome = EXCLUDED.cliente_nome,
    modelo_codigo = EXCLUDED.modelo_codigo,
    checklists = EXCLUDED.checklists || COALESCE(public.atividades_instancias.checklists, '{}'::jsonb),
    atualizado_em = now();

  INSERT INTO public.atividades_rotinas (
    empresa_id,
    modelo_id,
    codigo,
    nome,
    categoria,
    frequencia,
    intervalo_dias,
    responsavel_nome,
    cliente_nome,
    proxima_execucao,
    prioridade,
    checklist,
    observacoes,
    incluir_finais_de_semana,
    sistema,
    ativa
  )
  VALUES (
    v_empresa_id,
    v_modelo_id,
    'bm-folha-pagamento-mensal',
    'Fechamento mensal da folha - B & M Contabilidade',
    'Folha',
    'Mensal',
    30,
    '',
    'B & M Contabilidade',
    CURRENT_DATE,
    'Média',
    v_etapas,
    'Importada da rotina fixa do setor pessoal. Fechamento normal, sem modificações; envio previsto por e-mail.',
    false,
    false,
    true
  )
  ON CONFLICT (empresa_id, codigo) DO UPDATE
  SET modelo_id = EXCLUDED.modelo_id,
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      frequencia = EXCLUDED.frequencia,
      intervalo_dias = EXCLUDED.intervalo_dias,
      cliente_nome = EXCLUDED.cliente_nome,
      prioridade = EXCLUDED.prioridade,
      checklist = EXCLUDED.checklist,
      observacoes = EXCLUDED.observacoes,
      incluir_finais_de_semana = EXCLUDED.incluir_finais_de_semana,
      sistema = EXCLUDED.sistema,
      ativa = true,
      atualizado_em = now();
END;
$migration$;
