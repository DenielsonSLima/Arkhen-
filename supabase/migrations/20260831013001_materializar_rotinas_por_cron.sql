-- Materializa tarefas operacionais no banco. O cron usa ator de sistema;
-- execuções manuais preservam o usuário autenticado no histórico.
BEGIN;

ALTER TABLE public.atividades_tarefa_eventos
  ADD COLUMN IF NOT EXISTS ator_tipo text;

UPDATE public.atividades_tarefa_eventos
SET ator_tipo = 'usuario'
WHERE ator_tipo IS NULL;

ALTER TABLE public.atividades_tarefa_eventos
  ALTER COLUMN ator_tipo SET DEFAULT 'usuario',
  ALTER COLUMN ator_tipo SET NOT NULL,
  ALTER COLUMN ator_user_id DROP NOT NULL;

ALTER TABLE public.atividades_tarefa_eventos
  DROP CONSTRAINT IF EXISTS atividades_tarefa_eventos_ator_tipo_check;

ALTER TABLE public.atividades_tarefa_eventos
  ADD CONSTRAINT atividades_tarefa_eventos_ator_tipo_check CHECK (
    (ator_tipo = 'usuario' AND ator_user_id IS NOT NULL)
    OR (ator_tipo = 'sistema' AND ator_user_id IS NULL)
  );

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS app_private.materializacao_rotinas_falhas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_limite date NOT NULL,
  erro text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE app_private.materializacao_rotinas_falhas
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE app_private.materializacao_rotinas_falhas_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.materializar_rotinas_empresa(
  p_empresa_id uuid,
  p_ate date,
  p_ator_tipo text,
  p_ator_user_id uuid DEFAULT NULL,
  p_restringir_escopo_cliente boolean DEFAULT false,
  p_rotina_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rotina public.atividades_rotinas%rowtype;
  v_execucao date;
  v_checklist jsonb;
  v_tarefa_id uuid;
  v_responsavel_user_id uuid;
  v_responsavel_nome text;
  v_cliente_nome text;
  v_ator_nome text;
  v_criadas integer := 0;
  v_passos integer;
BEGIN
  IF p_empresa_id IS NULL OR p_ate IS NULL OR p_ate > v_hoje + 31
     OR NOT EXISTS (
       SELECT 1 FROM public.empresas empresa
       WHERE empresa.id = p_empresa_id AND empresa.status = 'ativo'
     ) THEN
    RAISE EXCEPTION 'Parâmetros de materialização inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_ator_tipo NOT IN ('usuario', 'sistema')
     OR (p_ator_tipo = 'usuario' AND p_ator_user_id IS NULL)
     OR (p_ator_tipo = 'sistema' AND p_ator_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Ator de materialização inválido' USING ERRCODE = '22023';
  END IF;

  IF p_ator_tipo = 'usuario' THEN
    SELECT coalesce(NULLIF(btrim(usuario.nome), ''), p_ator_user_id::text)
    INTO v_ator_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = p_empresa_id
      AND usuario.auth_user_id = p_ator_user_id
      AND usuario.status = 'Ativo'
    ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ator não pertence à empresa ativa' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_ator_nome := 'Sistema — materialização automática';
  END IF;

  FOR v_rotina IN
    SELECT rotina.*
    FROM public.atividades_rotinas rotina
    WHERE rotina.empresa_id = p_empresa_id
      AND rotina.ativa = true
      AND rotina.proxima_execucao <= p_ate
      AND (p_rotina_id IS NULL OR rotina.id = p_rotina_id)
      AND (
        rotina.cliente_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.clientes cliente
          WHERE cliente.id = rotina.cliente_id
            AND cliente.empresa_id = rotina.empresa_id
            AND cliente.status = 'Ativa'
        )
      )
      AND (
        NOT p_restringir_escopo_cliente
        OR public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
      )
    ORDER BY rotina.proxima_execucao, rotina.id
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT usuario.auth_user_id, usuario.nome
    INTO v_responsavel_user_id, v_responsavel_nome
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = v_rotina.responsavel_config_usuario_id
      AND usuario.empresa_id = p_empresa_id
      AND usuario.auth_user_id IS NOT NULL
      AND usuario.status = 'Ativo';
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_rotina.cliente_id IS NULL THEN
      v_cliente_nome := 'Escritório';
    ELSE
      SELECT cliente.nome INTO v_cliente_nome
      FROM public.clientes cliente
      WHERE cliente.id = v_rotina.cliente_id
        AND cliente.empresa_id = p_empresa_id
        AND cliente.status = 'Ativa'
        AND (
          NOT p_restringir_escopo_cliente
          OR public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
        );
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
    END IF;

    IF NULLIF(btrim(v_rotina.nome), '') IS NULL
       OR octet_length(v_rotina.nome) > 240
       OR v_rotina.categoria IS NULL
       OR v_rotina.categoria NOT IN ('Interna', 'Cliente', 'Fiscal', 'Folha', 'Contábil', 'Controle')
       OR v_rotina.frequencia IS NULL
       OR v_rotina.frequencia NOT IN ('Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Personalizada', 'Única')
       OR v_rotina.prioridade IS NULL
       OR v_rotina.prioridade NOT IN ('Baixa', 'Média', 'Alta')
       OR octet_length(coalesce(v_rotina.observacoes, '')) > 10000 THEN
      RAISE EXCEPTION 'Configuração inválida na rotina: %', v_rotina.id USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'titulo', CASE jsonb_typeof(item)
        WHEN 'string' THEN item #>> '{}'
        WHEN 'object' THEN item ->> 'titulo'
        ELSE NULL
      END,
      'concluida', false
    ) ORDER BY posicao), '[]'::jsonb)
    INTO v_checklist
    FROM jsonb_array_elements(coalesce(v_rotina.checklist, '[]'::jsonb))
      WITH ORDINALITY AS etapa(item, posicao);
    IF NOT public.atividade_checklist_valido(v_checklist) THEN
      RAISE EXCEPTION 'Checklist inválido na rotina: %', v_rotina.id USING ERRCODE = '22023';
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
        p_empresa_id, v_rotina.id, v_rotina.modelo_id, v_rotina.cliente_id,
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
        INSERT INTO public.atividades_tarefa_eventos (
          empresa_id, tarefa_id, tipo, ator_user_id, ator_tipo, ator_nome, dados
        ) VALUES (
          p_empresa_id, v_tarefa_id, 'criada', p_ator_user_id, p_ator_tipo,
          v_ator_nome, jsonb_build_object(
            'rotinaId', v_rotina.id,
            'competencia', to_char(v_execucao, 'MM/YYYY'),
            'prazoLegal', v_execucao,
            'prazoInterno', v_execucao,
            'origem', 'materializacao_rotina'
          )
        );
      END IF;

      IF v_rotina.frequencia = 'Única' THEN
        EXIT;
      END IF;
      v_execucao := public.proxima_data_rotina(
        v_execucao, v_rotina.frequencia, v_rotina.intervalo_dias,
        v_rotina.incluir_finais_de_semana
      );
      v_passos := v_passos + 1;
    END LOOP;

    UPDATE public.atividades_rotinas
    SET proxima_execucao = v_execucao,
        ativa = CASE WHEN v_rotina.frequencia = 'Única' THEN false ELSE ativa END,
        atualizado_em = now()
    WHERE id = v_rotina.id AND empresa_id = p_empresa_id;
  END LOOP;

  RETURN v_criadas;
END;
$$;

REVOKE ALL ON FUNCTION app_private.materializar_rotinas_empresa(uuid, date, text, uuid, boolean, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.materializar_rotinas_todas_empresas(
  p_ate date DEFAULT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid;
  v_criadas integer := 0;
BEGIN
  IF p_ate IS NULL THEN
    RAISE EXCEPTION 'Data limite inválida' USING ERRCODE = '22023';
  END IF;

  DELETE FROM app_private.materializacao_rotinas_falhas
  WHERE criado_em < now() - interval '90 days';

  FOR v_empresa_id IN
    SELECT DISTINCT rotina.empresa_id
    FROM public.atividades_rotinas rotina
    JOIN public.empresas empresa ON empresa.id = rotina.empresa_id AND empresa.status = 'ativo'
    WHERE rotina.ativa = true
      AND rotina.proxima_execucao <= p_ate
      AND (
        rotina.cliente_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.clientes cliente
          WHERE cliente.id = rotina.cliente_id
            AND cliente.empresa_id = rotina.empresa_id
            AND cliente.status = 'Ativa'
        )
      )
  LOOP
    BEGIN
      v_criadas := v_criadas + app_private.materializar_rotinas_empresa(
        v_empresa_id, p_ate, 'sistema', NULL, false, NULL
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO app_private.materializacao_rotinas_falhas (
        empresa_id, data_limite, erro
      ) VALUES (
        v_empresa_id, p_ate, left(SQLERRM, 2000)
      );
      RAISE WARNING 'Materialização automática ignorou a empresa %: %', v_empresa_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_criadas;
END;
$$;

REVOKE ALL ON FUNCTION app_private.materializar_rotinas_todas_empresas(date)
  FROM PUBLIC, anon, authenticated, service_role;

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
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Sem permissão para materializar rotinas' USING ERRCODE = '42501';
  END IF;
  IF p_ate IS NULL OR p_ate > v_hoje + 31 THEN
    RAISE EXCEPTION 'Data limite inválida' USING ERRCODE = '22023';
  END IF;

  RETURN app_private.materializar_rotinas_empresa(
    v_empresa_id, p_ate, 'usuario', auth.uid(), true, NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_atividades_rotinas(date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materializar_atividades_rotinas(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_rotina_protocolo(
  p_rotina_id uuid,
  p_responsavel_config_usuario_id uuid
)
RETURNS public.atividades_rotinas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado public.atividades_rotinas%rowtype;
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR p_rotina_id IS NULL OR p_responsavel_config_usuario_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.atividades_rotinas rotina
  JOIN public.clientes cliente
    ON cliente.id = rotina.cliente_id
   AND cliente.empresa_id = rotina.empresa_id
   AND cliente.status = 'Ativa'
  WHERE rotina.id = p_rotina_id
    AND rotina.empresa_id = v_empresa_id
    AND rotina.ativa = true
    AND rotina.protocolo_codigo IS NOT NULL
    AND public.current_user_can_access_client_row(rotina.empresa_id, rotina.cliente_id)
  FOR UPDATE OF rotina;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rotina de protocolo não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.id = p_responsavel_config_usuario_id
      AND usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
      AND usuario.auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Responsável ativo ainda não possui acesso ao sistema.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.atividades_rotinas
  SET responsavel_config_usuario_id = p_responsavel_config_usuario_id,
      proxima_execucao = greatest(proxima_execucao, v_hoje),
      atualizado_em = now()
  WHERE id = p_rotina_id AND empresa_id = v_empresa_id
  RETURNING * INTO v_resultado;

  PERFORM app_private.materializar_rotinas_empresa(
    v_empresa_id, v_hoje, 'usuario', auth.uid(), true, p_rotina_id
  );
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_rotina_protocolo(uuid, uuid)
  TO authenticated;

CREATE INDEX IF NOT EXISTS atividades_rotinas_materializacao_idx
  ON public.atividades_rotinas (proxima_execucao, empresa_id)
  WHERE ativa = true;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'materializar-atividades-operacionais-15min';

SELECT cron.schedule(
  'materializar-atividades-operacionais-15min',
  '*/15 * * * *',
  $cron$SELECT app_private.materializar_rotinas_todas_empresas(
    (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  );$cron$
);

COMMIT;
