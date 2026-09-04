-- Consolida riscos/SLA em Atividades; preserva o histórico legado para rollback.
BEGIN;
CREATE OR REPLACE FUNCTION public.obter_painel_operacional(
  p_periodo text DEFAULT 'mes', p_data_referencia date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = on
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_referencia date := coalesce(p_data_referencia,
    (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date);
  v_inicio date;
  v_fim date;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT coalesce(public.current_user_has_permission(
       v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Painel operacional não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF p_periodo NOT IN ('dia', 'semana', 'mes', 'todos') THEN
    RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT public.current_user_can_access_client_row(
    v_empresa_id, p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF p_periodo = 'dia' THEN
    v_inicio := v_referencia;
    v_fim := v_referencia;
  ELSIF p_periodo = 'semana' THEN
    v_inicio := date_trunc('week', v_referencia::timestamp)::date;
    v_fim := v_inicio + 6;
  ELSIF p_periodo = 'mes' THEN
    v_inicio := date_trunc('month', v_referencia::timestamp)::date;
    v_fim := (v_inicio + interval '1 month - 1 day')::date;
  END IF;
  WITH escopo AS (
    SELECT
      tarefa.id,
      tarefa.cliente_id,
      tarefa.rotina_id,
      tarefa.responsavel_config_usuario_id,
      tarefa.titulo,
      tarefa.cliente_nome,
      coalesce(usuario.nome, tarefa.responsavel_nome) AS responsavel_nome,
      coalesce(rotina.nome, tarefa.titulo) AS rotina_nome,
      tarefa.categoria,
      tarefa.prioridade,
      tarefa.status,
      tarefa.observacao_falta,
      tarefa.evidencia,
      tarefa.revisao_status,
      tarefa.atualizado_em,
      coalesce(tarefa.prazo_legal, tarefa.vencimento) AS prazo_legal,
      coalesce(tarefa.prazo_interno, tarefa.vencimento) AS prazo_operacional,
      coalesce(tarefa.concluido_em, tarefa.data_hora_conclusao) AS concluida_em
    FROM public.atividades_tarefas tarefa
    LEFT JOIN public.atividades_rotinas rotina
      ON rotina.id = tarefa.rotina_id
     AND rotina.empresa_id = tarefa.empresa_id
    LEFT JOIN public.configuracoes_usuarios usuario
      ON usuario.id = tarefa.responsavel_config_usuario_id
     AND usuario.empresa_id = tarefa.empresa_id
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
      AND tarefa.status <> 'Cancelada'
      AND (p_cliente_id IS NULL OR tarefa.cliente_id = p_cliente_id)
      AND (
        tarefa.cliente_id IS NULL
        OR public.current_user_can_access_client_row(
          tarefa.empresa_id, tarefa.cliente_id
        )
      )
      AND (
        p_periodo = 'todos'
        OR coalesce(tarefa.prazo_interno, tarefa.vencimento)
          BETWEEN v_inicio AND v_fim
      )
  ), base AS (
    SELECT
      escopo.*,
      greatest(0, v_referencia - escopo.prazo_operacional) AS dias_atraso,
      escopo.prazo_operacional - v_referencia AS dias_vencimento,
      nullif(trim(coalesce(escopo.observacao_falta, '')), '') IS NOT NULL
        AS pendencia_registrada,
      nullif(trim(coalesce(escopo.evidencia, '')), '') IS NOT NULL
        AS evidencia_registrada,
      CASE
        WHEN escopo.status = 'Concluída' THEN 'concluido'
        WHEN escopo.prazo_operacional < v_referencia THEN 'critico'
        WHEN nullif(trim(coalesce(escopo.observacao_falta, '')), '') IS NOT NULL
          THEN 'alto'
        WHEN escopo.prioridade = 'Alta'
          AND escopo.prazo_operacional <= v_referencia + 7 THEN 'alto'
        WHEN escopo.prazo_operacional <= v_referencia + 3 THEN 'alto'
        WHEN escopo.status = 'Aguardando revisão'
          OR escopo.revisao_status = 'Pendente' THEN 'medio'
        WHEN escopo.prazo_operacional <= v_referencia + 7 THEN 'medio'
        ELSE 'baixo'
      END AS nivel_risco
    FROM escopo
  ), metricas AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER (WHERE status = 'Concluída')::integer AS concluidas,
      count(*) FILTER (WHERE status IN (
        'Em andamento', 'Aguardando revisão'
      ))::integer AS em_andamento,
      count(*) FILTER (WHERE status = 'Pendente')::integer AS pendentes,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional < v_referencia)::integer AS atrasadas,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND pendencia_registrada)::integer AS com_pendencia,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional = v_referencia)::integer AS vencendo_hoje,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional BETWEEN v_referencia AND v_referencia + 7
      )::integer AS vencendo_sete_dias,
      count(*) FILTER (WHERE nivel_risco IN ('critico', 'alto'))::integer
        AS em_risco,
      CASE WHEN count(*) FILTER (
        WHERE status = 'Concluída' AND concluida_em IS NOT NULL
      ) = 0 THEN 0 ELSE round(
        count(*) FILTER (
          WHERE status = 'Concluída'
            AND concluida_em IS NOT NULL
            AND concluida_em::date <= prazo_legal
        )::numeric * 100
        / count(*) FILTER (
          WHERE status = 'Concluída' AND concluida_em IS NOT NULL
        )
      )::integer END AS taxa_no_prazo
    FROM base
  ), colaboradores AS (
    SELECT
      responsavel_config_usuario_id,
      coalesce(nullif(responsavel_nome, ''), 'Sem responsável') AS responsavel,
      count(*)::integer AS total,
      count(*) FILTER (WHERE status = 'Concluída')::integer AS concluidas,
      count(*) FILTER (WHERE status IN (
        'Em andamento', 'Aguardando revisão'
      ))::integer AS em_andamento,
      count(*) FILTER (WHERE status = 'Pendente')::integer AS pendentes,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional < v_referencia)::integer AS atrasadas,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND pendencia_registrada)::integer AS com_pendencia,
      count(*) FILTER (WHERE nivel_risco IN ('critico', 'alto'))::integer
        AS em_risco,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional = v_referencia)::integer AS vencendo_hoje,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional BETWEEN v_referencia AND v_referencia + 7
      )::integer AS vencendo_sete_dias,
      CASE WHEN count(*) FILTER (
        WHERE status = 'Concluída' AND concluida_em IS NOT NULL
      ) = 0 THEN 0 ELSE round(
        count(*) FILTER (
          WHERE status = 'Concluída' AND concluida_em IS NOT NULL
            AND concluida_em::date <= prazo_legal
        )::numeric * 100
        / count(*) FILTER (
          WHERE status = 'Concluída' AND concluida_em IS NOT NULL
        )
      )::integer END AS taxa_no_prazo
    FROM base
    GROUP BY responsavel_config_usuario_id,
      coalesce(nullif(responsavel_nome, ''), 'Sem responsável')
  ), clientes AS (
    SELECT
      cliente_id,
      coalesce(nullif(cliente_nome, ''), 'Escritório') AS cliente,
      count(*)::integer AS total,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional < v_referencia)::integer AS atrasadas,
      count(*) FILTER (WHERE nivel_risco IN ('critico', 'alto'))::integer
        AS em_risco
    FROM base
    GROUP BY cliente_id, coalesce(nullif(cliente_nome, ''), 'Escritório')
  ), rotinas AS (
    SELECT
      rotina_id,
      rotina_nome AS rotina,
      count(*)::integer AS total,
      count(*) FILTER (WHERE status <> 'Concluída'
        AND prazo_operacional < v_referencia)::integer AS atrasadas,
      count(*) FILTER (WHERE nivel_risco IN ('critico', 'alto'))::integer
        AS em_risco
    FROM base
    GROUP BY rotina_id, rotina_nome
  )
  SELECT jsonb_build_object(
    'periodo', p_periodo,
    'dataReferencia', v_referencia::text,
    'metricas', jsonb_build_object(
      'total', metricas.total,
      'concluidas', metricas.concluidas,
      'emAndamento', metricas.em_andamento,
      'pendentes', metricas.pendentes,
      'atrasadas', metricas.atrasadas,
      'comPendencia', metricas.com_pendencia,
      'vencendoHoje', metricas.vencendo_hoje,
      'vencendoSeteDias', metricas.vencendo_sete_dias,
      'emRisco', metricas.em_risco,
      'taxaNoPrazo', metricas.taxa_no_prazo
    ),
    'colaboradores', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'responsavelConfigUsuarioId', responsavel_config_usuario_id::text,
      'responsavel', responsavel,
      'total', total,
      'concluidas', concluidas,
      'emAndamento', em_andamento,
      'pendentes', pendentes,
      'atrasadas', atrasadas,
      'comPendencia', com_pendencia,
      'emRisco', em_risco,
      'vencendoHoje', vencendo_hoje,
      'vencendoSeteDias', vencendo_sete_dias,
      'taxaNoPrazo', taxa_no_prazo,
      'percentualConcluido', CASE WHEN total = 0 THEN 0
        ELSE round(concluidas::numeric * 100 / total)::integer END
    ) ORDER BY em_risco DESC, atrasadas DESC, responsavel)
      FROM colaboradores), '[]'::jsonb),
    'rankings', jsonb_build_object(
      'clientes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', cliente_id::text, 'nome', cliente, 'total', total,
        'atrasadas', atrasadas, 'emRisco', em_risco
      ) ORDER BY em_risco DESC, atrasadas DESC, cliente) FROM clientes), '[]'::jsonb),
      'rotinas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', rotina_id::text, 'nome', rotina, 'total', total,
        'atrasadas', atrasadas, 'emRisco', em_risco
      ) ORDER BY em_risco DESC, atrasadas DESC, rotina) FROM rotinas), '[]'::jsonb)
    ),
    'riscos', coalesce((SELECT jsonb_agg(item) FROM (
      SELECT jsonb_build_object(
        'tarefaId', id::text,
        'titulo', titulo,
        'clienteId', cliente_id::text,
        'cliente', coalesce(nullif(cliente_nome, ''), 'Escritório'),
        'responsavelConfigUsuarioId', responsavel_config_usuario_id::text,
        'responsavel', coalesce(nullif(responsavel_nome, ''), 'Sem responsável'),
        'categoria', categoria,
        'prioridade', prioridade,
        'status', status,
        'prazoLegal', prazo_legal::text,
        'prazoInterno', prazo_operacional::text,
        'diasEmAtraso', dias_atraso,
        'diasParaVencimento', dias_vencimento,
        'nivelRisco', nivel_risco,
        'motivoPendencia', coalesce(observacao_falta, ''),
        'evidenciaRegistrada', evidencia_registrada,
        'revisaoPendente', status = 'Aguardando revisão'
          OR revisao_status = 'Pendente',
        'ultimaMovimentacao', atualizado_em::text
      ) AS item
      FROM base
      WHERE nivel_risco IN ('critico', 'alto', 'medio')
      ORDER BY CASE nivel_risco WHEN 'critico' THEN 1
        WHEN 'alto' THEN 2 ELSE 3 END, prazo_operacional, id
      LIMIT 50
    ) riscos_ordenados), '[]'::jsonb)
  ) INTO v_resultado
  FROM metricas;
  RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.obter_painel_operacional(text, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_painel_operacional(text, date, uuid) TO authenticated;
COMMENT ON FUNCTION public.obter_painel_operacional(text, date, uuid) IS
  'Fonte única de métricas, SLA e riscos para Equipe e Painel Operacional.';
-- Enriquecimento da leitura já usada pelo workspace, sem cálculo de risco no React.
CREATE OR REPLACE FUNCTION public.obter_progresso_tarefas_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Progresso das tarefas não encontrado.' USING ERRCODE = '42501';
  END IF;
  WITH progresso AS (
    SELECT
      tarefa.id,
      tarefa.cliente_id,
      tarefa.competencia,
      tarefa.prioridade,
      tarefa.status,
      tarefa.observacao_falta,
      tarefa.evidencia,
      tarefa.revisao_status,
      tarefa.atualizado_em,
      coalesce(tarefa.prazo_legal, tarefa.vencimento) AS prazo_legal,
      coalesce(tarefa.prazo_interno, tarefa.vencimento) AS prazo_operacional,
      jsonb_array_length(CASE WHEN jsonb_typeof(tarefa.checklist) = 'array'
        THEN tarefa.checklist ELSE '[]'::jsonb END) AS etapas_total,
      (SELECT count(*)::integer FROM jsonb_array_elements(CASE
        WHEN jsonb_typeof(tarefa.checklist) = 'array' THEN tarefa.checklist
        ELSE '[]'::jsonb END) etapa(item)
        WHERE etapa.item -> 'concluida' = 'true'::jsonb) AS etapas_concluidas
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.empresa_id = v_empresa_id AND tarefa.ativo = true
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'tarefaId', progresso.id::text,
    'clienteId', progresso.cliente_id::text,
    'competencia', progresso.competencia,
    'etapasTotal', progresso.etapas_total,
    'etapasConcluidas', progresso.etapas_concluidas,
    'percentual', CASE WHEN progresso.etapas_total > 0 THEN least(100,
      greatest(0, round(progresso.etapas_concluidas::numeric * 100
        / progresso.etapas_total)::integer))
      WHEN progresso.status = 'Concluída' THEN 100 ELSE 0 END,
    'prazoLegal', progresso.prazo_legal::text,
    'prazoInterno', progresso.prazo_operacional::text,
    'diasEmAtraso', greatest(0, v_hoje - progresso.prazo_operacional),
    'diasParaVencimento', progresso.prazo_operacional - v_hoje,
    'pendenciaRegistrada', nullif(trim(coalesce(
      progresso.observacao_falta, '')), '') IS NOT NULL,
    'evidenciaRegistrada', nullif(trim(coalesce(
      progresso.evidencia, '')), '') IS NOT NULL,
    'revisaoPendente', progresso.status = 'Aguardando revisão'
      OR progresso.revisao_status = 'Pendente',
    'nivelRisco', CASE
      WHEN progresso.status = 'Concluída' THEN 'concluido'
      WHEN progresso.prazo_operacional < v_hoje THEN 'critico'
      WHEN nullif(trim(coalesce(progresso.observacao_falta, '')), '') IS NOT NULL
        THEN 'alto'
      WHEN progresso.prioridade = 'Alta' AND progresso.prazo_operacional <= v_hoje + 7 THEN 'alto'
      WHEN progresso.prazo_operacional <= v_hoje + 3 THEN 'alto'
      WHEN progresso.status = 'Aguardando revisão'
        OR progresso.revisao_status = 'Pendente' THEN 'medio'
      WHEN progresso.prazo_operacional <= v_hoje + 7 THEN 'medio'
      ELSE 'baixo' END,
    'ultimaMovimentacao', progresso.atualizado_em::text
  ) ORDER BY progresso.id), '[]'::jsonb)
  INTO v_resultado
  FROM progresso;
  RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.obter_progresso_tarefas_operacionais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_progresso_tarefas_operacionais() TO authenticated;
-- Remove Conformidade do catálogo configurável e das permissões existentes.
UPDATE public.configuracoes_perfis_acesso
SET permissoes = array_remove(permissoes, 'conformidade:view'),
    updated_at = now()
WHERE 'conformidade:view' = ANY(permissoes);
DELETE FROM public.configuracoes_modulos_sistema WHERE modulo = 'conformidade';
ALTER TABLE public.configuracoes_modulos_sistema
  DROP CONSTRAINT IF EXISTS configuracoes_modulos_sistema_modulo_check;
ALTER TABLE public.configuracoes_modulos_sistema
  ADD CONSTRAINT configuracoes_modulos_sistema_modulo_check CHECK (modulo IN (
    'inicio', 'clientes', 'atividades', 'protocolos', 'simulacoes-calculos',
    'reforma-tributaria', 'faturamento', 'financeiro', 'documentos', 'agenda',
    'parametrizacao', 'configuracoes'
  ));
CREATE OR REPLACE FUNCTION public.modulo_sistema_habilitado(p_modulo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR public.current_empresa_id() IS NULL
      OR NOT public.current_user_access_allowed(public.current_empresa_id()) THEN false
    WHEN p_modulo IN ('inicio', 'clientes', 'configuracoes') THEN true
    WHEN p_modulo NOT IN (
      'atividades', 'protocolos', 'simulacoes-calculos', 'reforma-tributaria',
      'faturamento', 'financeiro', 'documentos', 'agenda', 'parametrizacao'
    ) THEN false
    ELSE coalesce((SELECT modulo.habilitado
      FROM public.configuracoes_modulos_sistema modulo
      WHERE modulo.empresa_id = public.current_empresa_id()
        AND modulo.modulo = p_modulo), true)
  END;
$$;
CREATE OR REPLACE FUNCTION public.listar_configuracoes_modulos_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_modulos jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id) THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;
  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem, permissoes) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10, ARRAY['inicio:view']),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20, ARRAY['clientes:view','clientes:create','clientes:update']),
      ('atividades', 'Atividades', 'Filas, equipe, rotinas, prazos e riscos.', 'Operação', false, 30, ARRAY['atividades:view','atividades:view-own','atividades:manage']),
      ('protocolos', 'Acompanhamento', 'Histórico mensal, evidências e entregas por empresa.', 'Operação', false, 50, ARRAY['protocolos:view','protocolos:create','protocolos:manage']),
      ('simulacoes-calculos', 'Simulações', 'Calculadora de Rescisão.', 'Trabalhista', false, 60, ARRAY['simulacoes:view']),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80, ARRAY['faturamento:view','faturamento:manage']),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90, ARRAY['financeiro:view','financeiro:manage']),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100, ARRAY['documentos:view','documentos:view-own','documentos:create','documentos:create-own','documentos:manage']),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110, ARRAY['agenda:view','agenda:view-own','agenda:manage']),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120, ARRAY['parametrizacao:view','parametrizacao:manage']),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130, ARRAY['configuracoes:view','configuracoes:manage','meu-perfil:manage','usuarios:manage','perfis:manage','contas-bancarias:manage','integracao-bancaria:manage','integracao-fiscal:manage'])
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', catalogo.modulo, 'nome', catalogo.nome,
    'descricao', catalogo.descricao, 'categoria', catalogo.categoria,
    'obrigatorio', catalogo.obrigatorio,
    'habilitado', (CASE WHEN catalogo.obrigatorio THEN true
      ELSE coalesce(configuracao.habilitado, true) END)
      AND EXISTS (SELECT 1 FROM pg_catalog.unnest(catalogo.permissoes) permissao
        WHERE public.current_user_has_permission(v_empresa_id, permissao)),
    'ordem', catalogo.ordem
  ) ORDER BY catalogo.ordem), '[]'::jsonb)
  INTO v_modulos
  FROM catalogo
  LEFT JOIN public.configuracoes_modulos_sistema configuracao
    ON configuracao.empresa_id = v_empresa_id
   AND configuracao.modulo = catalogo.modulo;
  RETURN jsonb_build_object(
    'canManage', public.configuracoes_modulos_can_manage(),
    'modulos', v_modulos
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.salvar_configuracoes_modulos_sistema(p_modulos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_item jsonb; v_modulo text; v_habilitado boolean; v_anterior boolean;
  v_permitidos constant text[] := ARRAY[
    'atividades', 'protocolos', 'simulacoes-calculos', 'reforma-tributaria',
    'faturamento', 'financeiro', 'documentos', 'agenda', 'parametrizacao'
  ];
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode alterar os modulos.'
      USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(coalesce(p_modulos, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_modulos) > 9 THEN
    RAISE EXCEPTION 'A lista de modulos é inválida.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_modulos)
  LOOP
    v_modulo := nullif(trim(v_item ->> 'id'), '');
    IF v_modulo IS NULL OR NOT (v_modulo = ANY(v_permitidos))
       OR jsonb_typeof(v_item -> 'habilitado') <> 'boolean' THEN
      RAISE EXCEPTION 'Modulo inválido ou obrigatório: %', coalesce(v_modulo, '(vazio)')
        USING ERRCODE = '22023';
    END IF;
    v_habilitado := (v_item ->> 'habilitado')::boolean;
    SELECT modulo.habilitado INTO v_anterior
      FROM public.configuracoes_modulos_sistema modulo
      WHERE modulo.empresa_id = v_empresa_id AND modulo.modulo = v_modulo;
    v_anterior := coalesce(v_anterior, true);
    INSERT INTO public.configuracoes_modulos_sistema
      (empresa_id, modulo, habilitado, atualizado_por)
    VALUES (v_empresa_id, v_modulo, v_habilitado, auth.uid())
    ON CONFLICT (empresa_id, modulo) DO UPDATE SET
      habilitado = excluded.habilitado,
      atualizado_por = auth.uid(), updated_at = now();
    IF v_anterior IS DISTINCT FROM v_habilitado THEN
      INSERT INTO public.configuracoes_modulos_auditoria
        (empresa_id, modulo, habilitado_anterior, habilitado_novo, alterado_por)
      VALUES (v_empresa_id, v_modulo, v_anterior, v_habilitado, auth.uid());
    END IF;
  END LOOP;
  RETURN public.listar_configuracoes_modulos_sistema();
END;
$$;
REVOKE ALL ON FUNCTION public.modulo_sistema_habilitado(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_configuracoes_modulos_sistema(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modulo_sistema_habilitado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_modulos_sistema(jsonb) TO authenticated;
COMMIT;
