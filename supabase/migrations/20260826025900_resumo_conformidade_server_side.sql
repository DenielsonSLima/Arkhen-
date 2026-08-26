-- Projeta o painel de Conformidade no servidor sem contornar RLS. Datas,
-- prioridades e metricas usam o dia operacional do escritorio em Sao Paulo.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_resumo_conformidade(
  p_cliente_id uuid DEFAULT NULL
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
  v_pode_ver_documentos boolean;
  v_pode_criar_documentos boolean;
  v_obrigacoes jsonb;
  v_metricas jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'conformidade:view'),
       false
     ) THEN
    RAISE EXCEPTION 'Conformidade nao encontrada.' USING ERRCODE = '42501';
  END IF;

  IF NOT coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:view')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:view-own'),
    false
  ) THEN
    RAISE EXCEPTION
      'Seu perfil precisa de acesso a Atividades para consultar a Conformidade.'
      USING ERRCODE = '42501';
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

  v_pode_ver_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:view')
    OR public.current_user_has_permission(v_empresa_id, 'documentos:manage'),
    false
  );
  v_pode_criar_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:create'),
    false
  );

  WITH
  tarefas_fonte AS MATERIALIZED (
    SELECT
      tarefa.*,
      cliente.nome AS nome_cliente,
      cliente.cnpj,
      modelo.nome AS nome_modelo,
      modelo.descricao AS descricao_modelo
    FROM public.atividades_tarefas tarefa
    LEFT JOIN public.clientes cliente
      ON cliente.empresa_id = tarefa.empresa_id
     AND cliente.id = tarefa.cliente_id
    LEFT JOIN public.atividades_modelos modelo
      ON modelo.empresa_id = tarefa.empresa_id
     AND modelo.id = tarefa.modelo_id
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND (p_cliente_id IS NULL OR tarefa.cliente_id = p_cliente_id)
  ),
  instancias_fonte AS MATERIALIZED (
    SELECT
      instancia.*,
      cliente.nome AS nome_cliente,
      cliente.cnpj,
      modelo.nome AS nome_modelo,
      modelo.descricao AS descricao_modelo,
      modelo.categoria AS categoria_modelo,
      modelo.etapas AS etapas_modelo,
      tarefa.id AS tarefa_id,
      tarefa.categoria AS categoria_tarefa,
      tarefa.titulo AS titulo_tarefa,
      tarefa.notas AS notas_tarefa,
      tarefa.responsavel_nome AS responsavel_tarefa,
      tarefa.vencimento AS vencimento_tarefa,
      tarefa.prioridade AS prioridade_tarefa,
      tarefa.criado_em AS criado_em_tarefa,
      tarefa.atualizado_em AS atualizado_em_tarefa
    FROM public.atividades_instancias instancia
    LEFT JOIN public.clientes cliente
      ON cliente.empresa_id = instancia.empresa_id
     AND cliente.id = instancia.cliente_id
    LEFT JOIN public.atividades_modelos modelo
      ON modelo.empresa_id = instancia.empresa_id
     AND modelo.id = instancia.modelo_id
    LEFT JOIN LATERAL (
      SELECT candidata.*
      FROM tarefas_fonte candidata
      WHERE candidata.cliente_id IS NOT DISTINCT FROM instancia.cliente_id
        AND (
          candidata.modelo_id = instancia.modelo_id
          OR (
            candidata.modelo_id IS NULL
            AND instancia.modelo_id IS NULL
            AND lower(btrim(candidata.titulo)) = lower(btrim(instancia.modelo_codigo))
          )
        )
        AND (
          candidata.competencia = instancia.competencia
          OR to_char(candidata.vencimento, 'YYYY-MM') = CASE
            WHEN instancia.competencia ~ '^[0-9]{2}/[0-9]{4}$'
              THEN right(instancia.competencia, 4) || '-' || left(instancia.competencia, 2)
            ELSE instancia.competencia
          END
        )
      ORDER BY (candidata.status <> 'Concluída') DESC, candidata.vencimento, candidata.id
      LIMIT 1
    ) tarefa ON true
    WHERE instancia.empresa_id = v_empresa_id
      AND instancia.ativo = true
      AND public.current_user_can_access_client_row(instancia.empresa_id, instancia.cliente_id)
      AND (p_cliente_id IS NULL OR instancia.cliente_id = p_cliente_id)
  ),
  tarefas AS MATERIALIZED (
    SELECT
      'tarefa:' || tarefa.id::text AS id,
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
      coalesce(nullif(btrim(tarefa.nome_cliente), ''), nullif(btrim(tarefa.cliente_nome), ''), 'Escritório') AS cliente_nome,
      coalesce(tarefa.cnpj, '') AS cnpj,
      CASE
        WHEN coalesce(tarefa.competencia, '') ~ '^[0-9]{2}/[0-9]{4}$'
          THEN right(tarefa.competencia, 4) || '-' || left(tarefa.competencia, 2)
        WHEN coalesce(tarefa.competencia, '') ~ '^[0-9]{4}-[0-9]{2}$'
          THEN tarefa.competencia
        ELSE to_char(tarefa.vencimento, 'YYYY-MM')
      END AS competencia,
      coalesce(nullif(btrim(tarefa.nome_modelo), ''), nullif(btrim(tarefa.titulo), ''), 'Atividade operacional') AS rotina,
      coalesce(nullif(btrim(tarefa.descricao_modelo), ''), nullif(btrim(tarefa.notas), ''), '') AS descricao,
      coalesce(nullif(btrim(tarefa.responsavel_nome), ''), 'Não atribuído') AS responsavel,
      tarefa.vencimento,
      CASE
        WHEN tarefa.status = 'Concluída' THEN 'verde'
        WHEN tarefa.vencimento IS NULL THEN 'sem-prazo'
        WHEN tarefa.vencimento < v_hoje THEN 'vermelho'
        WHEN tarefa.prioridade = 'Alta' THEN 'vermelho'
        WHEN tarefa.vencimento <= v_hoje + 3 THEN 'amarelo'
        WHEN tarefa.prioridade = 'Média' THEN 'amarelo'
        ELSE 'verde'
      END AS prioridade,
      CASE
        WHEN tarefa.status = 'Concluída' THEN 'Concluído'
        WHEN tarefa.status = 'Em andamento' THEN 'Em andamento'
        ELSE 'Pendente'
      END AS status,
      CASE WHEN tarefa.status <> 'Concluída'
        THEN greatest(0, v_hoje - tarefa.vencimento)
        ELSE 0
      END AS atraso_dias,
      tarefa.vencimento - v_hoje AS dias_para_vencimento,
      false AS pode_atualizar,
      '[]'::jsonb AS etapas,
      '[]'::jsonb AS solicitacoes_documentos,
      tarefa.criado_em::text AS criado_em,
      tarefa.atualizado_em::text AS atualizado_em
    FROM tarefas_fonte tarefa
    WHERE NOT EXISTS (
      SELECT 1
      FROM instancias_fonte instancia
      WHERE instancia.tarefa_id = tarefa.id
    )
  ),
  instancias AS MATERIALIZED (
    SELECT
      instancia.id::text AS id,
      'atividade'::text AS origem,
      CASE lower(coalesce(instancia.categoria_tarefa, instancia.categoria_modelo, ''))
        WHEN 'fiscal' THEN 'fiscal'
        WHEN 'folha' THEN 'folha'
        WHEN 'contabil' THEN 'contabil'
        WHEN 'contábil' THEN 'contabil'
        WHEN 'atendimento' THEN 'atendimento'
        ELSE 'atividade'
      END AS tipo,
      coalesce(instancia.cliente_id::text, 'escritorio') AS cliente_id,
      coalesce(nullif(btrim(instancia.nome_cliente), ''), nullif(btrim(instancia.cliente_nome), ''), 'Escritório') AS cliente_nome,
      coalesce(instancia.cnpj, '') AS cnpj,
      CASE
        WHEN instancia.competencia ~ '^[0-9]{2}/[0-9]{4}$'
          THEN right(instancia.competencia, 4) || '-' || left(instancia.competencia, 2)
        ELSE instancia.competencia
      END AS competencia,
      coalesce(nullif(btrim(instancia.nome_modelo), ''), nullif(btrim(instancia.titulo_tarefa), ''), nullif(btrim(instancia.modelo_codigo), ''), 'Atividade operacional') AS rotina,
      coalesce(nullif(btrim(instancia.descricao_modelo), ''), nullif(btrim(instancia.notas_tarefa), ''), '') AS descricao,
      coalesce(nullif(btrim(instancia.responsavel_tarefa), ''), 'Não atribuído') AS responsavel,
      instancia.vencimento_tarefa AS vencimento,
      CASE
        WHEN instancia.status = 'Concluída' THEN 'verde'
        WHEN instancia.vencimento_tarefa IS NULL THEN 'sem-prazo'
        WHEN instancia.vencimento_tarefa < v_hoje THEN 'vermelho'
        WHEN instancia.prioridade_tarefa = 'Alta' THEN 'vermelho'
        WHEN instancia.vencimento_tarefa <= v_hoje + 3 THEN 'amarelo'
        WHEN instancia.prioridade_tarefa = 'Média' THEN 'amarelo'
        ELSE 'verde'
      END AS prioridade,
      CASE
        WHEN instancia.status = 'Concluída' THEN 'Concluído'
        WHEN instancia.status = 'Em andamento' THEN 'Em andamento'
        ELSE 'Pendente'
      END AS status,
      CASE
        WHEN instancia.status <> 'Concluída'
          AND instancia.vencimento_tarefa IS NOT NULL
          THEN greatest(0, v_hoje - instancia.vencimento_tarefa)
        ELSE 0
      END AS atraso_dias,
      instancia.vencimento_tarefa - v_hoje AS dias_para_vencimento,
      coalesce(
        public.current_user_has_permission(v_empresa_id, 'atividades:manage')
        OR (
          public.current_user_has_permission(v_empresa_id, 'atividades:update-own')
          AND (
            (
              instancia.cliente_id IS NOT NULL
              AND public.current_user_has_client_access(v_empresa_id, instancia.cliente_id)
            )
            OR EXISTS (
              SELECT 1
              FROM public.atividades_tarefas tarefa_autorizada
              WHERE tarefa_autorizada.empresa_id = v_empresa_id
                AND tarefa_autorizada.cliente_id IS NOT DISTINCT FROM instancia.cliente_id
                AND tarefa_autorizada.modelo_id IS NOT DISTINCT FROM instancia.modelo_id
                AND tarefa_autorizada.competencia = instancia.competencia
                AND tarefa_autorizada.responsavel_user_id = auth.uid()
                AND tarefa_autorizada.ativo = true
            )
          )
        ),
        false
      ) AS pode_atualizar,
      CASE
        WHEN jsonb_typeof(instancia.checklists) = 'object' THEN coalesce((
          SELECT jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'id', etapa.label,
              'label', etapa.label,
              'concluida', coalesce(instancia.checklists -> etapa.label, 'false'::jsonb) = 'true'::jsonb,
              'concluidaEm', nullif(instancia.checklist_dates ->> etapa.label, ''),
              'responsavel', nullif(instancia.checklist_users ->> etapa.label, '')
            )) ORDER BY etapa.ordem
          )
          FROM (
            SELECT
              historica.label,
              coalesce((
                SELECT atual.ordem::bigint
                FROM jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(instancia.etapas_modelo) = 'array'
                      THEN instancia.etapas_modelo
                    ELSE '[]'::jsonb
                  END
                ) WITH ORDINALITY atual(label, ordem)
                WHERE atual.label = historica.label
                LIMIT 1
              ), 1000000::bigint + row_number() OVER (ORDER BY historica.label)) AS ordem
            FROM jsonb_object_keys(instancia.checklists) historica(label)
            WHERE nullif(btrim(historica.label), '') IS NOT NULL
          ) etapa
        ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS etapas,
      '[]'::jsonb AS solicitacoes_documentos,
      least(instancia.criado_em, coalesce(instancia.criado_em_tarefa, instancia.criado_em))::text AS criado_em,
      greatest(instancia.atualizado_em, coalesce(instancia.atualizado_em_tarefa, instancia.atualizado_em))::text AS atualizado_em
    FROM instancias_fonte instancia
  ),
  solicitacoes_agrupadas AS MATERIALIZED (
    SELECT
      'solicitacoes-documentos:' || solicitacao.cliente_id::text || ':' || to_char(solicitacao.competencia, 'YYYY-MM') AS id,
      'solicitacoes-documentos'::text AS origem,
      'atendimento'::text AS tipo,
      solicitacao.cliente_id::text AS cliente_id,
      cliente.nome AS cliente_nome,
      coalesce(cliente.cnpj, '') AS cnpj,
      to_char(solicitacao.competencia, 'YYYY-MM') AS competencia,
      'Solicitações de documentos'::text AS rotina,
      CASE WHEN count(*) = 1
        THEN '1 solicitação documental aberta nesta competência.'
        ELSE count(*)::text || ' solicitações documentais abertas nesta competência.'
      END AS descricao,
      'Não atribuído'::text AS responsavel,
      min(solicitacao.data_limite) AS vencimento,
      CASE
        WHEN min(solicitacao.data_limite) IS NULL THEN 'sem-prazo'
        WHEN min(solicitacao.data_limite) < v_hoje THEN 'vermelho'
        WHEN min(solicitacao.data_limite) <= v_hoje + 3 THEN 'amarelo'
        ELSE 'verde'
      END AS prioridade,
      CASE WHEN bool_or(solicitacao.status = 'Pendente')
        THEN 'Pendente' ELSE 'Em andamento'
      END AS status,
      greatest(0, v_hoje - min(solicitacao.data_limite)) AS atraso_dias,
      min(solicitacao.data_limite) - v_hoje AS dias_para_vencimento,
      false AS pode_atualizar,
      '[]'::jsonb AS etapas,
      jsonb_agg(jsonb_build_object(
        'id', solicitacao.id::text,
        'nome', solicitacao.titulo,
        'status', solicitacao.status,
        'solicitadoEm', solicitacao.created_at::text,
        'atualizadoEm', solicitacao.updated_at::text,
        'dataLimite', coalesce(solicitacao.data_limite::text, '')
      ) ORDER BY solicitacao.data_limite NULLS LAST, solicitacao.created_at, solicitacao.id) AS solicitacoes_documentos,
      min(solicitacao.created_at)::text AS criado_em,
      max(solicitacao.updated_at)::text AS atualizado_em
    FROM public.documentos_solicitacoes solicitacao
    JOIN public.clientes cliente
      ON cliente.empresa_id = solicitacao.empresa_id
     AND cliente.id = solicitacao.cliente_id
    WHERE (
        v_pode_ver_documentos
        OR (v_pode_criar_documentos AND solicitacao.criado_por = auth.uid())
      )
      AND solicitacao.empresa_id = v_empresa_id
      AND solicitacao.status <> 'Concluído'
      AND public.current_user_can_access_client_row(solicitacao.empresa_id, solicitacao.cliente_id)
      AND (p_cliente_id IS NULL OR solicitacao.cliente_id = p_cliente_id)
    GROUP BY solicitacao.cliente_id, cliente.nome, cliente.cnpj, solicitacao.competencia
  ),
  obrigacoes AS MATERIALIZED (
    SELECT * FROM tarefas
    UNION ALL SELECT * FROM instancias
    UNION ALL SELECT * FROM solicitacoes_agrupadas
  )
  SELECT
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', obrigacao.id,
        'origem', obrigacao.origem,
        'tipo', obrigacao.tipo,
        'clienteId', obrigacao.cliente_id,
        'clienteNome', obrigacao.cliente_nome,
        'cnpj', obrigacao.cnpj,
        'competencia', obrigacao.competencia,
        'rotina', obrigacao.rotina,
        'descricao', obrigacao.descricao,
        'responsavel', obrigacao.responsavel,
        'vencimento', coalesce(obrigacao.vencimento::text, ''),
        'diasParaVencimento', obrigacao.dias_para_vencimento,
        'prioridade', obrigacao.prioridade,
        'status', obrigacao.status,
        'atrasoDias', obrigacao.atraso_dias,
        'podeAtualizar', obrigacao.pode_atualizar,
        'regraContrato', NULL,
        'etapas', obrigacao.etapas,
        'solicitacoesDocumentos', obrigacao.solicitacoes_documentos,
        'criadoEm', obrigacao.criado_em,
        'atualizadoEm', obrigacao.atualizado_em
      ) ORDER BY
        CASE obrigacao.prioridade
          WHEN 'vermelho' THEN 3 WHEN 'amarelo' THEN 2
          WHEN 'verde' THEN 1 ELSE 0
        END DESC,
        obrigacao.vencimento NULLS LAST,
        obrigacao.cliente_nome,
        obrigacao.id
      ) FROM obrigacoes obrigacao
    ), '[]'::jsonb),
    jsonb_build_object(
      'total', (SELECT count(*) FROM obrigacoes),
      'pendente', (SELECT count(*) FROM obrigacoes WHERE status = 'Pendente'),
      'andamento', (SELECT count(*) FROM obrigacoes WHERE status = 'Em andamento'),
      'concluidas', (SELECT count(*) FROM obrigacoes WHERE status = 'Concluído'),
      'atrasadas', (SELECT count(*) FROM obrigacoes WHERE atraso_dias > 0),
      'vencendoHoje', (SELECT count(*) FROM obrigacoes WHERE dias_para_vencimento = 0 AND status <> 'Concluído'),
      'comPrazoDefinido', (SELECT count(*) FROM obrigacoes WHERE vencimento IS NOT NULL),
      'semPrazo', (SELECT count(*) FROM obrigacoes WHERE vencimento IS NULL),
      'atrasadasPorResponsavel', coalesce((
        SELECT jsonb_agg(jsonb_build_object('label', top.label, 'quantidade', top.quantidade) ORDER BY top.quantidade DESC, top.label)
        FROM (
          SELECT responsavel AS label, count(*) AS quantidade
          FROM obrigacoes WHERE atraso_dias > 0
          GROUP BY responsavel ORDER BY quantidade DESC, responsavel LIMIT 3
        ) top
      ), '[]'::jsonb),
      'atrasadasPorCliente', coalesce((
        SELECT jsonb_agg(jsonb_build_object('label', top.label, 'quantidade', top.quantidade) ORDER BY top.quantidade DESC, top.label)
        FROM (
          SELECT cliente_nome AS label, count(*) AS quantidade
          FROM obrigacoes WHERE atraso_dias > 0
          GROUP BY cliente_nome ORDER BY quantidade DESC, cliente_nome LIMIT 3
        ) top
      ), '[]'::jsonb),
      'atrasadasPorRotina', coalesce((
        SELECT jsonb_agg(jsonb_build_object('label', top.label, 'quantidade', top.quantidade) ORDER BY top.quantidade DESC, top.label)
        FROM (
          SELECT rotina AS label, count(*) AS quantidade
          FROM obrigacoes WHERE atraso_dias > 0
          GROUP BY rotina ORDER BY quantidade DESC, rotina LIMIT 3
        ) top
      ), '[]'::jsonb)
    )
  INTO v_obrigacoes, v_metricas;

  RETURN jsonb_build_object(
    'dataReferencia', to_char(v_hoje, 'YYYY-MM-DD'),
    'solicitacoesDocumentaisVisiveis',
      v_pode_ver_documentos OR v_pode_criar_documentos,
    'obrigacoes', v_obrigacoes,
    'metricas', v_metricas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resumo_conformidade(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resumo_conformidade(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_resumo_conformidade(uuid) IS
  'Resumo tenant-safe de Conformidade com datas e metricas calculadas no servidor.';

COMMIT;
