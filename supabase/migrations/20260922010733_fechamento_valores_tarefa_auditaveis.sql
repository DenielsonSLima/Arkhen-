BEGIN;
CREATE OR REPLACE FUNCTION public.salvar_valores_tarefa_operacional(p_tarefa_id uuid, p_valores jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_empresa uuid := public.current_empresa_id(); v_tarefa public.atividades_tarefas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT coalesce(public.current_user_access_allowed(v_empresa),false) THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_valores) IS DISTINCT FROM 'object' OR octet_length(p_valores::text)>8192
    OR EXISTS (SELECT 1 FROM jsonb_each(p_valores) e WHERE
      e.key NOT IN ('valorInss','valorIrrf','valorReinf','valorPis','valorCofins','valorIrpj','valorCsll',
        'valorRetencao1708','valorRetencao3208','valorRetencao5952','valorIssRetido','valorFunrural','database')
      OR (e.key <> 'database' AND jsonb_typeof(e.value) <> 'number')
      OR (e.key = 'database' AND (jsonb_typeof(e.value) <> 'string' OR length(e.value #>> '{}')>100))) THEN
    RAISE EXCEPTION 'Valores inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_tarefa FROM public.atividades_tarefas t
    WHERE t.id=p_tarefa_id AND t.empresa_id=v_empresa AND t.ativo
      AND public.current_user_can_access_client_row(v_empresa,t.cliente_id) FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(
    public.current_user_has_permission(v_empresa,'atividades:manage') OR
      (public.current_user_has_permission(v_empresa,'atividades:update-own') AND v_tarefa.responsavel_user_id=auth.uid()), false) THEN
    RAISE EXCEPTION 'Tarefa não encontrada' USING ERRCODE='42501';
  END IF;
  IF v_tarefa.status IN ('Concluída','Aguardando revisão','Cancelada') THEN
    RAISE EXCEPTION 'Reabra a tarefa antes de alterar os valores' USING ERRCODE='22023';
  END IF;
  UPDATE public.atividades_tarefas SET valores=coalesce(valores,'{}'::jsonb)||p_valores WHERE id=p_tarefa_id AND empresa_id=v_empresa;
  PERFORM public.registrar_evento_tarefa_operacional(v_empresa,p_tarefa_id,'dados_atualizados',NULL,
    jsonb_build_object('camposValores', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_valores) k)));
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_valores_tarefa_operacional(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_valores_tarefa_operacional(uuid,jsonb) TO authenticated;
COMMIT;
