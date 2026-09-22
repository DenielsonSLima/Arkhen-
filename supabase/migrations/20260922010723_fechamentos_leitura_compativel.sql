BEGIN;
-- Compatibilidade somente leitura. As permissões negadas das instâncias antigas
-- permanecem intactas; somente gestores autorizados consultam o histórico.
CREATE OR REPLACE FUNCTION public.ler_historico_fechamentos_operacionais()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_empresa uuid := public.current_empresa_id(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT coalesce(public.current_user_access_allowed(v_empresa),false) THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(public.current_user_has_permission(v_empresa, 'atividades:manage'), false) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) INTO v_result FROM (
    SELECT i.id, i.cliente_id, i.cliente_nome, i.modelo_id, i.modelo_codigo,
      i.competencia, i.status, i.checklists, i.checklist_dates, i.checklist_users,
      i.valores, NULL::text AS modelo_nome, '{}'::jsonb AS checklist_indices, 'historico'::text AS fonte
    FROM public.atividades_instancias i
    WHERE i.empresa_id = v_empresa AND i.ativo AND i.status <> 'Cancelada'
      AND i.cliente_id IS NOT NULL
      AND public.current_user_can_access_client_row(v_empresa, i.cliente_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.atividades_tarefas t
        WHERE t.empresa_id = v_empresa AND t.ativo
          AND t.cliente_id = i.cliente_id AND t.competencia = i.competencia
          AND t.modelo_id = i.modelo_id
      )
    ORDER BY i.competencia, i.cliente_nome, i.id
  ) h;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.ler_historico_fechamentos_operacionais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ler_historico_fechamentos_operacionais() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_fechamentos_operacionais_compativeis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_empresa_id() IS NULL OR NOT coalesce(public.current_user_access_allowed(public.current_empresa_id()),false) THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_result FROM (
    SELECT t.id, t.cliente_id, t.cliente_nome, t.modelo_id,
      NULL::text AS modelo_codigo, t.competencia, t.status,
      coalesce((SELECT jsonb_object_agg(e->>'titulo', e->'concluida')
        FROM jsonb_array_elements(t.checklist) e), '{}'::jsonb) AS checklists,
      coalesce((SELECT jsonb_object_agg(e.titulo, e.criado_em) FROM (
        SELECT DISTINCT ON (dados->>'titulo') dados->>'titulo' AS titulo, criado_em
        FROM public.atividades_tarefa_eventos WHERE tarefa_id=t.id AND empresa_id=t.empresa_id
          AND tipo='checklist' AND dados->>'concluida'='true'
        ORDER BY dados->>'titulo', criado_em DESC, id DESC
      ) e), '{}'::jsonb) AS checklist_dates,
      coalesce((SELECT jsonb_object_agg(e.titulo, e.ator_nome) FROM (
        SELECT DISTINCT ON (dados->>'titulo') dados->>'titulo' AS titulo, ator_nome
        FROM public.atividades_tarefa_eventos WHERE tarefa_id=t.id AND empresa_id=t.empresa_id
          AND tipo='checklist' AND dados->>'concluida'='true'
        ORDER BY dados->>'titulo', criado_em DESC, id DESC
      ) e), '{}'::jsonb) AS checklist_users,
      t.valores, t.titulo AS modelo_nome,
      coalesce((SELECT jsonb_object_agg(e.value->>'titulo', e.ordinality-1)
        FROM jsonb_array_elements(t.checklist) WITH ORDINALITY e), '{}'::jsonb) AS checklist_indices, 'tarefa'::text AS fonte
    FROM public.atividades_tarefas t
    WHERE t.empresa_id = public.current_empresa_id() AND t.ativo
      AND t.cliente_id IS NOT NULL AND t.competencia IS NOT NULL
      AND t.status <> 'Cancelada'
    ORDER BY t.competencia, t.cliente_nome, t.id
  ) c;
  RETURN v_result || public.ler_historico_fechamentos_operacionais();
END;
$$;
REVOKE ALL ON FUNCTION public.listar_fechamentos_operacionais_compativeis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_fechamentos_operacionais_compativeis() TO authenticated;
COMMIT;
