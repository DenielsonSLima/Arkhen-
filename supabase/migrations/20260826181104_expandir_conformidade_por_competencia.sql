-- EXPAND: Conformidade passa a ter uma projeção canônica, somente de tarefas,
-- filtrada por uma competência explícita. A função antiga segue disponível.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_conformidade_operacional_tarefas(
  p_cliente_id uuid DEFAULT NULL,
  p_competencia varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
SET row_security = on
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_competencia varchar := coalesce(
    p_competencia,
    to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date, 'MM/YYYY')
  );
  v_competencia_iso varchar;
  v_pode_ver_documentos boolean;
  v_pode_criar_documentos boolean;
  v_obrigacoes jsonb;
  v_metricas jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'conformidade:view'), false
     ) THEN
    RAISE EXCEPTION 'Conformidade não encontrada' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:view')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:view-own'), false
  ) THEN
    RAISE EXCEPTION 'Seu perfil precisa de acesso a Atividades'
      USING ERRCODE = '42501';
  END IF;
  IF v_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023';
  END IF;
  v_competencia_iso := right(v_competencia, 4) || '-' || left(v_competencia, 2);

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id AND cliente.id = p_cliente_id
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
  ) THEN
    RAISE EXCEPTION 'Conformidade não encontrada' USING ERRCODE = '42501';
  END IF;

  v_pode_ver_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:view')
    OR public.current_user_has_permission(v_empresa_id, 'documentos:manage'), false
  );
  v_pode_criar_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:create'), false
  );

  WITH tarefas AS MATERIALIZED (
    SELECT
      tarefa.id::text AS id,
      'atividade'::text AS origem,
      CASE lower(coalesce(tarefa.categoria, ''))
        WHEN 'fiscal' THEN 'fiscal'
        WHEN 'folha' THEN 'folha'
        WHEN 'contabil' THEN 'contabil'
        WHEN 'contábil' THEN 'contabil'
        WHEN 'atendimento' THEN 'atendimento'
        ELSE 'atividade'
      END AS tipo,
      coalesce(tarefa.cliente_id::text, 'escritorio') AS cliente_id,
      coalesce(nullif(btrim(cliente.nome), ''), nullif(btrim(tarefa.cliente_nome), ''), 'Escritório') AS cliente_nome,
      coalesce(cliente.cnpj, '') AS cnpj,
      v_competencia_iso AS competencia,
      coalesce(nullif(btrim(modelo.nome), ''), nullif(btrim(tarefa.titulo), ''), 'Atividade operacional') AS rotina,
      coalesce(nullif(btrim(modelo.descricao), ''), nullif(btrim(tarefa.notas), ''), '') AS descricao,
      coalesce(nullif(btrim(tarefa.responsavel_nome), ''), 'Não atribuído') AS responsavel,
      coalesce(tarefa.prazo_interno, tarefa.vencimento) AS vencimento,
      coalesce(tarefa.prazo_legal, tarefa.vencimento) AS prazo_legal,
      coalesce(tarefa.prazo_interno, tarefa.vencimento) AS prazo_interno,
      CASE
        WHEN tarefa.status = 'Concluída' THEN 'verde'
        WHEN coalesce(tarefa.prazo_interno, tarefa.vencimento) < v_hoje THEN 'vermelho'
        WHEN tarefa.prioridade = 'Alta' THEN 'vermelho'
        WHEN coalesce(tarefa.prazo_interno, tarefa.vencimento) <= v_hoje + 3 THEN 'amarelo'
        WHEN tarefa.prioridade = 'Média' THEN 'amarelo'
        ELSE 'verde'
      END AS prioridade,
      CASE
        WHEN tarefa.status = 'Concluída' THEN 'Concluído'
        WHEN tarefa.status IN ('Em andamento', 'Aguardando revisão') THEN 'Em andamento'
        ELSE 'Pendente'
      END AS status,
      tarefa.revisao_status,
      tarefa.evidencia,
      tarefa.justificativa_conclusao,
      CASE WHEN tarefa.status <> 'Concluída' THEN greatest(
        0, v_hoje - coalesce(tarefa.prazo_interno, tarefa.vencimento)
      ) ELSE 0 END AS atraso_dias,
      coalesce(tarefa.prazo_interno, tarefa.vencimento) - v_hoje AS dias_para_vencimento,
      coalesce(
        tarefa.status NOT IN ('Aguardando revisão', 'Concluída', 'Cancelada')
        AND (
          public.current_user_has_permission(v_empresa_id, 'atividades:manage')
          OR (
            public.current_user_has_permission(v_empresa_id, 'atividades:update-own')
            AND tarefa.responsavel_user_id = auth.uid()
          )
        ), false
      ) AS pode_atualizar,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', (etapa.ordem - 1)::text,
          'label', etapa.item ->> 'titulo',
          'concluida', (etapa.item ->> 'concluida')::boolean
        ) ORDER BY etapa.ordem)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(tarefa.checklist) = 'array'
            THEN tarefa.checklist ELSE '[]'::jsonb END
        ) WITH ORDINALITY etapa(item, ordem)
      ), '[]'::jsonb) AS etapas,
      '[]'::jsonb AS solicitacoes_documentos,
      tarefa.criado_em::text AS criado_em,
      tarefa.atualizado_em::text AS atualizado_em
    FROM public.atividades_tarefas tarefa
    LEFT JOIN public.clientes cliente
      ON cliente.empresa_id = tarefa.empresa_id AND cliente.id = tarefa.cliente_id
    LEFT JOIN public.atividades_modelos modelo
      ON modelo.empresa_id = tarefa.empresa_id AND modelo.id = tarefa.modelo_id
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true AND tarefa.competencia = v_competencia
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND (p_cliente_id IS NULL OR tarefa.cliente_id = p_cliente_id)
  ),
  solicitacoes AS MATERIALIZED (
    SELECT
      'solicitacoes-documentos:' || solicitacao.cliente_id::text || ':' || v_competencia_iso AS id,
      'solicitacoes-documentos'::text AS origem,
      'atendimento'::text AS tipo,
      solicitacao.cliente_id::text AS cliente_id,
      cliente.nome AS cliente_nome,
      coalesce(cliente.cnpj, '') AS cnpj,
      v_competencia_iso AS competencia,
      'Solicitações de documentos'::text AS rotina,
      count(*)::text || ' solicitação(ões) documental(is) aberta(s).' AS descricao,
      'Não atribuído'::text AS responsavel,
      min(solicitacao.data_limite) AS vencimento,
      min(solicitacao.data_limite) AS prazo_legal,
      min(solicitacao.data_limite) AS prazo_interno,
      CASE
        WHEN min(solicitacao.data_limite) IS NULL THEN 'sem-prazo'
        WHEN min(solicitacao.data_limite) < v_hoje THEN 'vermelho'
        WHEN min(solicitacao.data_limite) <= v_hoje + 3 THEN 'amarelo'
        ELSE 'verde'
      END AS prioridade,
      CASE WHEN bool_or(solicitacao.status = 'Pendente')
        THEN 'Pendente' ELSE 'Em andamento' END AS status,
      'Não necessária'::text AS revisao_status,
      NULL::text AS evidencia,
      NULL::text AS justificativa_conclusao,
      CASE WHEN min(solicitacao.data_limite) IS NULL THEN 0
        ELSE greatest(0, v_hoje - min(solicitacao.data_limite)) END AS atraso_dias,
      min(solicitacao.data_limite) - v_hoje AS dias_para_vencimento,
      false AS pode_atualizar,
      '[]'::jsonb AS etapas,
      jsonb_agg(jsonb_build_object(
        'id', solicitacao.id::text, 'nome', solicitacao.titulo,
        'status', solicitacao.status, 'solicitadoEm', solicitacao.created_at::text,
        'atualizadoEm', solicitacao.updated_at::text,
        'dataLimite', coalesce(solicitacao.data_limite::text, '')
      ) ORDER BY solicitacao.data_limite NULLS LAST, solicitacao.created_at) AS solicitacoes_documentos,
      min(solicitacao.created_at)::text AS criado_em,
      max(solicitacao.updated_at)::text AS atualizado_em
    FROM public.documentos_solicitacoes solicitacao
    JOIN public.clientes cliente
      ON cliente.empresa_id = solicitacao.empresa_id AND cliente.id = solicitacao.cliente_id
    WHERE solicitacao.empresa_id = v_empresa_id
      AND solicitacao.status <> 'Concluído'
      AND to_char(solicitacao.competencia, 'YYYY-MM') = v_competencia_iso
      AND (v_pode_ver_documentos OR (
        v_pode_criar_documentos AND solicitacao.criado_por = auth.uid()
      ))
      AND public.current_user_can_access_client_row(solicitacao.empresa_id, solicitacao.cliente_id)
      AND (p_cliente_id IS NULL OR solicitacao.cliente_id = p_cliente_id)
    GROUP BY solicitacao.cliente_id, cliente.nome, cliente.cnpj
  ),
  obrigacoes AS MATERIALIZED (
    SELECT * FROM tarefas UNION ALL SELECT * FROM solicitacoes
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'origem', item.origem, 'tipo', item.tipo,
      'clienteId', item.cliente_id, 'clienteNome', item.cliente_nome,
      'cnpj', item.cnpj, 'competencia', item.competencia, 'rotina', item.rotina,
      'descricao', item.descricao, 'responsavel', item.responsavel,
      'vencimento', coalesce(item.vencimento::text, ''),
      'prazoLegal', coalesce(item.prazo_legal::text, ''),
      'prazoInterno', coalesce(item.prazo_interno::text, ''),
      'diasParaVencimento', item.dias_para_vencimento,
      'prioridade', item.prioridade, 'status', item.status,
      'revisaoStatus', item.revisao_status, 'atrasoDias', item.atraso_dias,
      'evidencia', coalesce(item.evidencia, ''),
      'justificativaConclusao', coalesce(item.justificativa_conclusao, ''),
      'podeAtualizar', item.pode_atualizar, 'regraContrato', NULL,
      'etapas', item.etapas, 'solicitacoesDocumentos', item.solicitacoes_documentos,
      'criadoEm', item.criado_em, 'atualizadoEm', item.atualizado_em
    ) ORDER BY item.vencimento NULLS LAST, item.cliente_nome, item.id), '[]'::jsonb),
    jsonb_build_object(
      'total', count(*),
      'pendente', count(*) FILTER (WHERE status = 'Pendente'),
      'andamento', count(*) FILTER (WHERE status = 'Em andamento'),
      'concluidas', count(*) FILTER (WHERE status = 'Concluído'),
      'atrasadas', count(*) FILTER (WHERE atraso_dias > 0),
      'vencendoHoje', count(*) FILTER (WHERE dias_para_vencimento = 0 AND status <> 'Concluído'),
      'comPrazoDefinido', count(*) FILTER (WHERE vencimento IS NOT NULL),
      'semPrazo', count(*) FILTER (WHERE vencimento IS NULL),
      'atrasadasPorResponsavel', '[]'::jsonb,
      'atrasadasPorCliente', '[]'::jsonb,
      'atrasadasPorRotina', '[]'::jsonb
    )
  INTO v_obrigacoes, v_metricas
  FROM obrigacoes item;

  RETURN jsonb_build_object(
    'dataReferencia', to_char(v_hoje, 'YYYY-MM-DD'),
    'competencia', v_competencia_iso,
    'solicitacoesDocumentaisVisiveis', v_pode_ver_documentos OR v_pode_criar_documentos,
    'obrigacoes', v_obrigacoes,
    'metricas', v_metricas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar)
  TO authenticated;

COMMIT;
