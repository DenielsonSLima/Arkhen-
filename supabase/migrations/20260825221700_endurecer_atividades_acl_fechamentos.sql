-- Remove privilegios de owner-like concedidos a authenticated e separa leitura
-- de escrita em modelos e fechamentos. Policies restritivas de cliente permanecem.

ALTER TABLE public.atividades_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atividades_modelos_empresa_policy ON public.atividades_modelos;
DROP POLICY IF EXISTS atividades_modelos_select_scope ON public.atividades_modelos;
DROP POLICY IF EXISTS atividades_modelos_insert_manager ON public.atividades_modelos;
DROP POLICY IF EXISTS atividades_modelos_update_manager ON public.atividades_modelos;
DROP POLICY IF EXISTS atividades_modelos_delete_manager ON public.atividades_modelos;

CREATE POLICY atividades_modelos_select_scope
ON public.atividades_modelos FOR SELECT TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  OR public.current_user_has_permission(empresa_id, 'atividades:view')
  OR public.current_user_has_permission(empresa_id, 'atividades:view-own')
);
CREATE POLICY atividades_modelos_insert_manager
ON public.atividades_modelos FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND NOT public.current_user_is_client_scoped(empresa_id)
);
CREATE POLICY atividades_modelos_update_manager
ON public.atividades_modelos FOR UPDATE TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND NOT public.current_user_is_client_scoped(empresa_id)
)
WITH CHECK (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND NOT public.current_user_is_client_scoped(empresa_id)
);
CREATE POLICY atividades_modelos_delete_manager
ON public.atividades_modelos FOR DELETE TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  AND NOT public.current_user_is_client_scoped(empresa_id)
);

DROP POLICY IF EXISTS atividades_fechamentos_empresa_policy ON public.atividades_fechamentos;
DROP POLICY IF EXISTS atividades_fechamentos_select_scope ON public.atividades_fechamentos;
CREATE POLICY atividades_fechamentos_select_scope
ON public.atividades_fechamentos FOR SELECT TO authenticated
USING (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  OR public.current_user_has_permission(empresa_id, 'atividades:view')
  OR public.current_user_has_permission(empresa_id, 'atividades:view-own')
);

CREATE OR REPLACE FUNCTION public.salvar_atividade_fechamento(
  p_cliente_id uuid,
  p_competencia varchar,
  p_finalizado boolean
)
RETURNS public.atividades_fechamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_usuario text;
  v_resultado public.atividades_fechamentos%rowtype;
  v_existente public.atividades_fechamentos%rowtype;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'atividades:manage'), false) THEN
    RAISE EXCEPTION 'Sem permissão para homologar fechamento' USING ERRCODE = '42501';
  END IF;
  IF p_cliente_id IS NULL OR p_finalizado IS NULL
     OR p_competencia IS NULL
     OR p_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
    RAISE EXCEPTION 'Dados do fechamento inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(
    public.current_user_can_access_client_row(v_empresa_id, p_cliente_id), false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- Bloqueia e valida também a linha que será atualizada pelo ON CONFLICT. Isso
  -- evita corrigir silenciosamente um fechamento legado de outro cliente.
  SELECT f.* INTO v_existente
  FROM public.atividades_fechamentos f
  WHERE f.empresa_id = v_empresa_id
    AND f.cliente_ref = p_cliente_id::text
    AND f.competencia = p_competencia
  FOR UPDATE;
  IF FOUND AND NOT coalesce(
    public.current_user_can_access_client_row(
      v_existente.empresa_id, v_existente.cliente_id
    ), false
  ) THEN
    RAISE EXCEPTION 'Fechamento não encontrado';
  END IF;

  SELECT coalesce(
    (SELECT NULLIF(btrim(u.nome), '') FROM public.configuracoes_usuarios u
     WHERE u.empresa_id = v_empresa_id AND u.auth_user_id = auth.uid()
       AND u.status = 'Ativo'
     ORDER BY (u.perfil_id IS NOT NULL) DESC, u.created_at DESC LIMIT 1),
    (SELECT NULLIF(btrim(p.nome), '') FROM public.perfis p
     WHERE p.empresa_id = v_empresa_id AND p.user_id = auth.uid()
       AND p.ativo = true LIMIT 1),
    auth.uid()::text
  ) INTO v_usuario;

  INSERT INTO public.atividades_fechamentos (
    empresa_id, cliente_id, cliente_ref, competencia,
    finalizado, data_hora, usuario
  ) VALUES (
    v_empresa_id, p_cliente_id, p_cliente_id::text, p_competencia,
    p_finalizado, v_agora, v_usuario
  )
  ON CONFLICT (empresa_id, cliente_ref, competencia) DO UPDATE
  SET cliente_id = EXCLUDED.cliente_id,
      finalizado = EXCLUDED.finalizado,
      data_hora = EXCLUDED.data_hora,
      usuario = EXCLUDED.usuario
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_atividade_fechamento(uuid, varchar, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_atividade_fechamento(uuid, varchar, boolean)
  TO authenticated, service_role;

REVOKE ALL ON TABLE public.atividades_defaults FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.atividades_modelos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.atividades_fechamentos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades_modelos TO authenticated;
GRANT SELECT ON public.atividades_fechamentos TO authenticated;

-- Nenhum grant e devolvido para atividades_defaults: nao ha consumidor frontend.
-- Policies restritivas de modelo/cliente sao preservadas intencionalmente.
