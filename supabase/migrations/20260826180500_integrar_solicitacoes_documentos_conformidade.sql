-- EXPAND: enriquece a projeção canônica de tarefas da migration 173100.
-- A base é preservada internamente; nenhuma instância ou resumo legado é lido.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_conformidade_operacional_tarefas_base(uuid,character varying)') IS NULL THEN
    ALTER FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar)
      RENAME TO get_conformidade_operacional_tarefas_base;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional_tarefas_base(uuid, varchar)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_conformidade_operacional_tarefas(
  p_cliente_id uuid DEFAULT NULL,
  p_competencia varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = on
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_base jsonb; v_obrigacoes jsonb; v_metricas jsonb; v_competencia_iso text;
  v_pode_ver_documentos boolean; v_pode_criar_documentos boolean;
  v_documentos_visiveis boolean; v_pode_gerenciar_atividades boolean;
  v_pode_ver_fila_propria boolean; v_pode_ver_clientes_atividades boolean;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'conformidade:view'), false) THEN
    RAISE EXCEPTION 'Conformidade não encontrada.' USING ERRCODE = '42501';
  END IF;
  v_pode_gerenciar_atividades := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false);
  v_pode_ver_fila_propria := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:view')
    OR public.current_user_has_permission(v_empresa_id, 'atividades:update-own'), false);
  v_pode_ver_clientes_atividades := coalesce(
    public.current_user_has_permission(v_empresa_id, 'atividades:view-own'), false);
  IF NOT (v_pode_gerenciar_atividades OR v_pode_ver_fila_propria
    OR v_pode_ver_clientes_atividades) THEN
    RAISE EXCEPTION 'Seu perfil precisa de acesso a Atividades.' USING ERRCODE = '42501';
  END IF;
  v_base := public.get_conformidade_operacional_tarefas_base(p_cliente_id, p_competencia);
  v_competencia_iso := v_base ->> 'competencia';
  v_pode_ver_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:view')
    OR public.current_user_has_permission(v_empresa_id, 'documentos:manage'), false);
  v_pode_criar_documentos := coalesce(
    public.current_user_has_permission(v_empresa_id, 'documentos:create'), false);
  v_documentos_visiveis := coalesce((v_base ->> 'solicitacoesDocumentaisVisiveis')::boolean, false)
    OR EXISTS (SELECT 1 FROM public.documentos_solicitacoes s
      LEFT JOIN public.configuracoes_usuarios r
        ON r.id = s.responsavel_config_usuario_id AND r.empresa_id = s.empresa_id AND r.status = 'Ativo'
      LEFT JOIN public.configuracoes_usuarios v
        ON v.id = s.revisor_config_usuario_id AND v.empresa_id = s.empresa_id AND v.status = 'Ativo'
      WHERE s.empresa_id = v_empresa_id AND to_char(s.competencia, 'YYYY-MM') = v_competencia_iso
        AND (p_cliente_id IS NULL OR s.cliente_id = p_cliente_id)
        AND public.current_user_can_access_client_row(s.empresa_id, s.cliente_id)
        AND (r.auth_user_id = auth.uid() OR v.auth_user_id = auth.uid()));

  WITH atividades AS (
    SELECT item, ordem
    FROM jsonb_array_elements(coalesce(v_base -> 'obrigacoes', '[]'::jsonb))
      WITH ORDINALITY origem(item, ordem)
    WHERE item ->> 'origem' <> 'solicitacoes-documentos'
      AND EXISTS (
        SELECT 1 FROM public.atividades_tarefas tarefa_permitida
        WHERE tarefa_permitida.id::text = item ->> 'id'
          AND tarefa_permitida.empresa_id = v_empresa_id AND tarefa_permitida.ativo = true
          AND public.current_user_can_access_client_row(
            tarefa_permitida.empresa_id, tarefa_permitida.cliente_id
          )
          AND (
            v_pode_gerenciar_atividades
            OR (v_pode_ver_fila_propria AND (
              tarefa_permitida.responsavel_user_id = auth.uid()
              OR tarefa_permitida.revisor_user_id = auth.uid()
            ))
            OR (v_pode_ver_clientes_atividades
              AND tarefa_permitida.cliente_id IS NOT NULL
              AND public.current_user_has_client_access(
                tarefa_permitida.empresa_id, tarefa_permitida.cliente_id
              ))
          )
      )
  ), solicitacoes AS (
    SELECT jsonb_build_object(
      'id', 'solicitacoes-documentos:' || s.cliente_id::text || ':' || v_competencia_iso,
      'origem', 'solicitacoes-documentos', 'tipo', 'atendimento',
      'clienteId', s.cliente_id::text, 'clienteNome', cliente.nome,
      'cnpj', coalesce(cliente.cnpj, ''), 'competencia', v_competencia_iso,
      'rotina', 'Solicitações de documentos',
      'descricao', CASE WHEN count(*) = 1 THEN '1 solicitação documental aberta.'
        ELSE count(*)::text || ' solicitações documentais abertas.' END,
      'responsavel', coalesce(string_agg(DISTINCT nullif(btrim(responsavel.nome), ''), ', '
        ORDER BY nullif(btrim(responsavel.nome), '')), ''),
      'vencimento', coalesce(min(s.data_limite)::text, ''),
      'prazoLegal', coalesce(min(s.data_limite)::text, ''),
      'prazoInterno', coalesce(min(s.data_limite)::text, ''),
      'diasParaVencimento', min(s.data_limite) - v_hoje,
      'prioridade', CASE WHEN min(s.data_limite) IS NULL THEN 'sem-prazo'
        WHEN min(s.data_limite) < v_hoje THEN 'vermelho'
        WHEN min(s.data_limite) <= v_hoje + 3 THEN 'amarelo' ELSE 'verde' END,
      'status', CASE WHEN bool_or(s.status = 'Pendente') THEN 'Pendente' ELSE 'Em andamento' END,
      'revisaoStatus', CASE WHEN bool_or(s.revisor_config_usuario_id IS NOT NULL)
        THEN 'Configurada' ELSE 'Não necessária' END,
      'atrasoDias', CASE WHEN min(s.data_limite) IS NULL THEN 0
        ELSE greatest(0, v_hoje - min(s.data_limite)) END,
      'podeAtualizar', bool_or(public.current_user_has_permission(v_empresa_id, 'documentos:manage')
        OR responsavel.auth_user_id = auth.uid() OR revisor.auth_user_id = auth.uid()),
      'regraContrato', NULL, 'etapas', '[]'::jsonb,
      'solicitacoesDocumentos', jsonb_agg(jsonb_build_object(
        'id', s.id::text, 'nome', s.titulo, 'status', s.status,
        'solicitadoEm', s.created_at::text, 'atualizadoEm', s.updated_at::text,
        'dataLimite', coalesce(s.data_limite::text, ''),
        'responsavel', coalesce(responsavel.nome, ''), 'revisor', coalesce(revisor.nome, ''),
        'tarefaId', coalesce(s.tarefa_id::text, ''), 'tarefaTitulo', coalesce(tarefa.titulo, ''),
        'documentoId', coalesce(s.documento_id::text, ''),
        'documentoNome', coalesce(documento.nome, ''), 'semArquivo', s.documento_id IS NULL,
        'auditoriaPendente', s.auditoria_pendente
      ) ORDER BY s.data_limite NULLS LAST, s.created_at, s.id),
      'criadoEm', min(s.created_at)::text, 'atualizadoEm', max(s.updated_at)::text
    ) AS item
    FROM public.documentos_solicitacoes s
    JOIN public.clientes cliente ON cliente.id = s.cliente_id AND cliente.empresa_id = s.empresa_id
    LEFT JOIN public.configuracoes_usuarios responsavel
      ON responsavel.id = s.responsavel_config_usuario_id AND responsavel.empresa_id = s.empresa_id
     AND responsavel.status = 'Ativo'
    LEFT JOIN public.configuracoes_usuarios revisor
      ON revisor.id = s.revisor_config_usuario_id AND revisor.empresa_id = s.empresa_id
     AND revisor.status = 'Ativo'
    LEFT JOIN public.atividades_tarefas tarefa
      ON tarefa.id = s.tarefa_id AND tarefa.empresa_id = s.empresa_id
    LEFT JOIN public.documentos documento
      ON documento.id = s.documento_id AND documento.empresa_id = s.empresa_id
    WHERE s.empresa_id = v_empresa_id AND s.status NOT IN ('Concluído', 'Cancelado')
      AND to_char(s.competencia, 'YYYY-MM') = v_competencia_iso
      AND public.current_user_can_access_client_row(s.empresa_id, s.cliente_id)
      AND (p_cliente_id IS NULL OR s.cliente_id = p_cliente_id)
      AND (v_pode_ver_documentos OR (v_pode_criar_documentos AND s.criado_por = auth.uid())
        OR responsavel.auth_user_id = auth.uid() OR revisor.auth_user_id = auth.uid())
    GROUP BY s.cliente_id, cliente.nome, cliente.cnpj
  ), unificadas AS (
    SELECT item, ordem::bigint FROM atividades
    UNION ALL SELECT item, 1000000::bigint + row_number() OVER () FROM solicitacoes
  ) SELECT coalesce(jsonb_agg(item ORDER BY ordem), '[]'::jsonb)
    INTO v_obrigacoes FROM unificadas;

  WITH itens AS (SELECT item FROM jsonb_array_elements(v_obrigacoes) item),
  atraso_responsavel AS (SELECT item ->> 'responsavel' label, count(*) quantidade FROM itens
    WHERE (item ->> 'atrasoDias')::integer > 0 AND nullif(btrim(item ->> 'responsavel'), '') IS NOT NULL
    GROUP BY item ->> 'responsavel' ORDER BY quantidade DESC, label LIMIT 3),
  atraso_cliente AS (SELECT item ->> 'clienteNome' label, count(*) quantidade FROM itens
    WHERE (item ->> 'atrasoDias')::integer > 0 GROUP BY item ->> 'clienteNome'
    ORDER BY quantidade DESC, label LIMIT 3),
  atraso_rotina AS (SELECT item ->> 'rotina' label, count(*) quantidade FROM itens
    WHERE (item ->> 'atrasoDias')::integer > 0 GROUP BY item ->> 'rotina'
    ORDER BY quantidade DESC, label LIMIT 3)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM itens),
    'pendente', (SELECT count(*) FROM itens WHERE item ->> 'status' = 'Pendente'),
    'andamento', (SELECT count(*) FROM itens WHERE item ->> 'status' = 'Em andamento'),
    'concluidas', (SELECT count(*) FROM itens WHERE item ->> 'status' = 'Concluído'),
    'atrasadas', (SELECT count(*) FROM itens WHERE (item ->> 'atrasoDias')::integer > 0),
    'vencendoHoje', (SELECT count(*) FROM itens WHERE (item ->> 'diasParaVencimento')::integer = 0
      AND item ->> 'status' <> 'Concluído'),
    'comPrazoDefinido', (SELECT count(*) FROM itens WHERE nullif(item ->> 'vencimento', '') IS NOT NULL),
    'semPrazo', (SELECT count(*) FROM itens WHERE nullif(item ->> 'vencimento', '') IS NULL),
    'atrasadasPorResponsavel', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'quantidade', quantidade)) FROM atraso_responsavel), '[]'::jsonb),
    'atrasadasPorCliente', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'quantidade', quantidade)) FROM atraso_cliente), '[]'::jsonb),
    'atrasadasPorRotina', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'quantidade', quantidade)) FROM atraso_rotina), '[]'::jsonb)
  ) INTO v_metricas;

  RETURN jsonb_build_object('dataReferencia', v_base ->> 'dataReferencia',
    'competencia', v_competencia_iso, 'solicitacoesDocumentaisVisiveis', v_documentos_visiveis,
    'obrigacoes', v_obrigacoes, 'metricas', v_metricas);
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar) TO authenticated;

COMMIT;
