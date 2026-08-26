-- EXPAND: homologação por competência com histórico append-only e reabertura
-- justificada. A RPC legada permanece disponível até o LOCKDOWN.
BEGIN;

ALTER TABLE public.atividades_fechamentos
  ADD COLUMN IF NOT EXISTS finalizado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberto_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reaberto_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS atividades_fechamentos_id_empresa_id_unq
  ON public.atividades_fechamentos (id, empresa_id);

CREATE TABLE IF NOT EXISTS public.atividades_fechamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  fechamento_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  competencia varchar NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('homologado', 'reaberto')),
  ator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ator_nome text NOT NULL,
  justificativa text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atividades_fechamento_eventos_fechamento_tenant_fkey
    FOREIGN KEY (fechamento_id, empresa_id)
    REFERENCES public.atividades_fechamentos (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT atividades_fechamento_eventos_cliente_tenant_fkey
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES public.clientes (id, empresa_id)
    ON DELETE RESTRICT,
  CONSTRAINT atividades_fechamento_eventos_competencia_chk
    CHECK (competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'),
  CONSTRAINT atividades_fechamento_eventos_justificativa_chk
    CHECK (octet_length(coalesce(justificativa, '')) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_atividades_fechamento_eventos_cliente_data
  ON public.atividades_fechamento_eventos (
    empresa_id, cliente_id, competencia, criado_em DESC, id
  );

ALTER TABLE public.atividades_fechamento_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atividades_fechamento_eventos_select_scope
  ON public.atividades_fechamento_eventos;
CREATE POLICY atividades_fechamento_eventos_select_scope
ON public.atividades_fechamento_eventos FOR SELECT TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND public.current_user_can_access_client_row(empresa_id, cliente_id)
  AND (
    public.current_user_has_permission(empresa_id, 'atividades:manage')
    OR (
      public.current_user_has_permission(empresa_id, 'atividades:view-own')
      AND public.current_user_has_client_access(empresa_id, cliente_id)
    )
  )
);

REVOKE ALL ON TABLE public.atividades_fechamento_eventos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.atividades_fechamento_eventos TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_fechamento_operacional(
  p_cliente_id uuid,
  p_competencia varchar,
  p_finalizado boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS public.atividades_fechamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_existente public.atividades_fechamentos%rowtype;
  v_resultado public.atividades_fechamentos%rowtype;
  v_usuario text;
  v_motivo text := NULLIF(btrim(p_justificativa), '');
  v_agora timestamptz := now();
  v_tem_existente boolean := false;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(
       public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false
     ) THEN
    RAISE EXCEPTION 'Sem permissão para homologar fechamento'
      USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NULL OR p_finalizado IS NULL OR p_competencia IS NULL
     OR p_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
     OR octet_length(coalesce(v_motivo, '')) > 4000 THEN
    RAISE EXCEPTION 'Dados do fechamento inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.clientes cliente
    WHERE cliente.id = p_cliente_id AND cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  SELECT fechamento.* INTO v_existente
  FROM public.atividades_fechamentos fechamento
  WHERE fechamento.empresa_id = v_empresa_id
    AND fechamento.cliente_ref = p_cliente_id::text
    AND fechamento.competencia = p_competencia
  FOR UPDATE;
  v_tem_existente := FOUND;

  SELECT coalesce(
    (SELECT NULLIF(btrim(usuario.nome), '')
     FROM public.configuracoes_usuarios usuario
     WHERE usuario.empresa_id = v_empresa_id
       AND usuario.auth_user_id = auth.uid()
       AND usuario.status = 'Ativo'
     ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.created_at DESC
     LIMIT 1),
    auth.uid()::text
  ) INTO v_usuario;

  IF p_finalizado THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.atividades_tarefas tarefa
      WHERE tarefa.empresa_id = v_empresa_id
        AND tarefa.cliente_id = p_cliente_id
        AND tarefa.competencia = p_competencia
        AND tarefa.ativo = true
    ) THEN
      RAISE EXCEPTION 'Não há tarefas nesta competência para homologar'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.atividades_tarefas tarefa
      WHERE tarefa.empresa_id = v_empresa_id
        AND tarefa.cliente_id = p_cliente_id
        AND tarefa.competencia = p_competencia
        AND tarefa.ativo = true
        AND tarefa.status <> 'Concluída'
    ) THEN
      RAISE EXCEPTION 'Conclua e revise todas as tarefas antes de homologar'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.documentos_solicitacoes solicitacao
      WHERE solicitacao.empresa_id = v_empresa_id
        AND solicitacao.cliente_id = p_cliente_id
        AND to_char(solicitacao.competencia, 'MM/YYYY') = p_competencia
        AND solicitacao.status NOT IN ('Concluído', 'Cancelado')
    ) THEN
      RAISE EXCEPTION 'Resolva as solicitações documentais abertas antes de homologar'
        USING ERRCODE = '22023';
    END IF;
    IF v_tem_existente AND v_existente.finalizado THEN RETURN v_existente; END IF;

    INSERT INTO public.atividades_fechamentos (
      empresa_id, cliente_id, cliente_ref, competencia, finalizado,
      data_hora, usuario, finalizado_por_user_id, finalizado_em,
      reaberto_por_user_id, reaberto_em
    ) VALUES (
      v_empresa_id, p_cliente_id, p_cliente_id::text, p_competencia, true,
      v_agora, v_usuario, auth.uid(), v_agora, NULL, NULL
    )
    ON CONFLICT (empresa_id, cliente_ref, competencia) DO UPDATE
    SET cliente_id = EXCLUDED.cliente_id,
        finalizado = true,
        data_hora = EXCLUDED.data_hora,
        usuario = EXCLUDED.usuario,
        finalizado_por_user_id = EXCLUDED.finalizado_por_user_id,
        finalizado_em = EXCLUDED.finalizado_em,
        reaberto_por_user_id = NULL,
        reaberto_em = NULL
    RETURNING * INTO v_resultado;

    INSERT INTO public.atividades_fechamento_eventos (
      empresa_id, fechamento_id, cliente_id, competencia, tipo,
      ator_user_id, ator_nome
    ) VALUES (
      v_empresa_id, v_resultado.id, p_cliente_id, p_competencia,
      'homologado', auth.uid(), v_usuario
    );
  ELSE
    IF NOT v_tem_existente OR NOT v_existente.finalizado THEN
      RAISE EXCEPTION 'O fechamento ainda não está homologado'
        USING ERRCODE = '22023';
    END IF;
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe a justificativa da reabertura'
        USING ERRCODE = '22023';
    END IF;
    IF char_length(v_motivo) < 8 THEN
      RAISE EXCEPTION 'A justificativa deve ter pelo menos 8 caracteres'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.atividades_fechamentos
    SET finalizado = false,
        data_hora = NULL,
        usuario = '',
        finalizado_por_user_id = NULL,
        finalizado_em = NULL,
        reaberto_por_user_id = auth.uid(),
        reaberto_em = v_agora,
        atualizado_em = v_agora
    WHERE id = v_existente.id AND empresa_id = v_empresa_id
    RETURNING * INTO v_resultado;

    INSERT INTO public.atividades_fechamento_eventos (
      empresa_id, fechamento_id, cliente_id, competencia, tipo,
      ator_user_id, ator_nome, justificativa
    ) VALUES (
      v_empresa_id, v_resultado.id, p_cliente_id, p_competencia,
      'reaberto', auth.uid(), v_usuario, v_motivo
    );
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_fechamento_operacional(
  uuid, varchar, boolean, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_fechamento_operacional(
  uuid, varchar, boolean, text
) TO authenticated;

COMMIT;
