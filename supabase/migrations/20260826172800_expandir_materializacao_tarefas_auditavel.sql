-- EXPAND: materializa rotinas no contrato canônico de tarefas, com prazos,
-- responsável ativo e evento de criação derivado exclusivamente pelo servidor.
BEGIN;

CREATE OR REPLACE FUNCTION public.materializar_atividades_rotinas(
  p_ate date DEFAULT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rotina public.atividades_rotinas%rowtype;
  v_execucao date;
  v_checklist jsonb;
  v_tarefa_id uuid;
  v_responsavel_user_id uuid;
  v_responsavel_nome text;
  v_cliente_nome text;
  v_criadas integer := 0;
  v_passos integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
     ) THEN
    RAISE EXCEPTION 'Sem permissão para materializar rotinas'
      USING ERRCODE = '42501';
  END IF;
  IF p_ate IS NULL OR p_ate > v_hoje + 31 THEN
    RAISE EXCEPTION 'Data limite inválida' USING ERRCODE = '22023';
  END IF;

  FOR v_rotina IN
    SELECT rotina.*
    FROM public.atividades_rotinas rotina
    WHERE rotina.empresa_id = v_empresa_id
      AND rotina.ativa = true
      AND rotina.proxima_execucao <= p_ate
      AND public.current_user_can_access_client_row(
        rotina.empresa_id, rotina.cliente_id
      )
    ORDER BY rotina.proxima_execucao, rotina.id
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT usuario.auth_user_id, usuario.nome
    INTO v_responsavel_user_id, v_responsavel_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = v_rotina.responsavel_config_usuario_id
      AND usuario.empresa_id = v_empresa_id
      AND usuario.auth_user_id IS NOT NULL
      AND usuario.status = 'Ativo';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rotina sem responsável ativo: %', v_rotina.id
        USING ERRCODE = '22023';
    END IF;

    IF v_rotina.cliente_id IS NULL THEN
      v_cliente_nome := 'Escritório';
    ELSE
      SELECT cliente.nome INTO v_cliente_nome
      FROM public.clientes cliente
      WHERE cliente.id = v_rotina.cliente_id
        AND cliente.empresa_id = v_empresa_id
        AND cliente.status = 'Ativa'
        AND public.current_user_can_access_client_row(
          cliente.empresa_id, cliente.id
        );
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente da rotina não está ativo: %', v_rotina.id
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF NULLIF(btrim(v_rotina.nome), '') IS NULL
       OR octet_length(v_rotina.nome) > 240
       OR v_rotina.categoria IS NULL
       OR v_rotina.categoria NOT IN (
         'Interna', 'Cliente', 'Fiscal', 'Folha', 'Contábil', 'Controle'
       )
       OR v_rotina.frequencia IS NULL
       OR v_rotina.frequencia NOT IN (
         'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Personalizada', 'Única'
       )
       OR v_rotina.prioridade IS NULL
       OR v_rotina.prioridade NOT IN ('Baixa', 'Média', 'Alta')
       OR octet_length(coalesce(v_rotina.observacoes, '')) > 10000 THEN
      RAISE EXCEPTION 'Configuração inválida na rotina: %', v_rotina.id
        USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'titulo', CASE jsonb_typeof(item)
            WHEN 'string' THEN item #>> '{}'
            WHEN 'object' THEN item ->> 'titulo'
            ELSE NULL
          END,
          'concluida', false
        ) ORDER BY posicao
      ),
      '[]'::jsonb
    )
    INTO v_checklist
    FROM jsonb_array_elements(
      coalesce(v_rotina.checklist, '[]'::jsonb)
    ) WITH ORDINALITY AS etapa(item, posicao);
    IF NOT public.atividade_checklist_valido(v_checklist) THEN
      RAISE EXCEPTION 'Checklist inválido na rotina: %', v_rotina.id
        USING ERRCODE = '22023';
    END IF;

    v_execucao := v_rotina.proxima_execucao;
    v_passos := 0;
    WHILE v_execucao <= p_ate AND v_passos < 120 LOOP
      v_tarefa_id := NULL;
      INSERT INTO public.atividades_tarefas (
        empresa_id, rotina_id, modelo_id, cliente_id, titulo, categoria,
        frequencia, responsavel_nome, responsavel_user_id,
        responsavel_config_usuario_id, cliente_nome, competencia, vencimento,
        prazo_legal, prazo_interno, prioridade, status, origem, checklist,
        notas, revisor_user_id, revisor_nome, revisao_status, ativo
      ) VALUES (
        v_empresa_id, v_rotina.id, v_rotina.modelo_id, v_rotina.cliente_id,
        v_rotina.nome, v_rotina.categoria, v_rotina.frequencia,
        v_responsavel_nome, v_responsavel_user_id,
        v_rotina.responsavel_config_usuario_id, v_cliente_nome,
        to_char(v_execucao, 'MM/YYYY'), v_execucao, v_execucao, v_execucao,
        v_rotina.prioridade, 'Pendente', 'Rotina', v_checklist,
        coalesce(v_rotina.observacoes, ''), NULL, NULL, 'Não necessária', true
      )
      ON CONFLICT (empresa_id, rotina_id, vencimento)
        WHERE rotina_id IS NOT NULL AND ativo = true
      DO NOTHING
      RETURNING id INTO v_tarefa_id;

      IF v_tarefa_id IS NOT NULL THEN
        v_criadas := v_criadas + 1;
        PERFORM public.registrar_evento_tarefa_operacional(
          v_empresa_id,
          v_tarefa_id,
          'criada',
          NULL,
          jsonb_build_object(
            'rotinaId', v_rotina.id,
            'competencia', to_char(v_execucao, 'MM/YYYY'),
            'prazoLegal', v_execucao,
            'prazoInterno', v_execucao
          )
        );
      END IF;

      v_execucao := public.proxima_data_rotina(
        v_execucao,
        v_rotina.frequencia,
        v_rotina.intervalo_dias,
        v_rotina.incluir_finais_de_semana
      );
      v_passos := v_passos + 1;
    END LOOP;

    UPDATE public.atividades_rotinas
    SET proxima_execucao = v_execucao, atualizado_em = now()
    WHERE id = v_rotina.id AND empresa_id = v_empresa_id;
  END LOOP;

  RETURN v_criadas;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_atividades_rotinas(date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materializar_atividades_rotinas(date)
  TO authenticated;

COMMIT;
