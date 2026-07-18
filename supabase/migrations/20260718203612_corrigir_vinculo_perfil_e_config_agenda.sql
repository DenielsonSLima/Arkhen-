CREATE OR REPLACE FUNCTION public.current_user_has_permission(
  p_empresa_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_empresa_member(p_empresa_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.perfis p
        WHERE p.user_id = auth.uid()
          AND p.empresa_id = p_empresa_id
          AND p.ativo = true
          AND p.papel = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios u
        JOIN public.configuracoes_perfis_acesso pa
          ON pa.empresa_id = u.empresa_id
         AND pa.ativo = true
         AND lower(pa.nome) = lower(u.perfil)
        WHERE u.empresa_id = p_empresa_id
          AND u.auth_user_id = auth.uid()
          AND u.status = 'Ativo'
          AND p_permission = ANY(pa.permissoes)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO authenticated;

DROP POLICY IF EXISTS agenda_tipos_evento_empresa_policy ON public.agenda_tipos_evento;
CREATE POLICY agenda_tipos_evento_select_permission ON public.agenda_tipos_evento
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:view')
    OR public.current_user_has_permission(empresa_id, 'agenda:manage')
  );
CREATE POLICY agenda_tipos_evento_insert_manager ON public.agenda_tipos_evento
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_tipos_evento_update_manager ON public.agenda_tipos_evento
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_tipos_evento_delete_manager ON public.agenda_tipos_evento
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'));

DROP POLICY IF EXISTS agenda_categorias_evento_empresa_policy ON public.agenda_categorias_evento;
CREATE POLICY agenda_categorias_evento_select_permission ON public.agenda_categorias_evento
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'agenda:view')
    OR public.current_user_has_permission(empresa_id, 'agenda:manage')
  );
CREATE POLICY agenda_categorias_evento_insert_manager ON public.agenda_categorias_evento
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_categorias_evento_update_manager ON public.agenda_categorias_evento
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'))
  WITH CHECK (public.current_user_has_permission(empresa_id, 'agenda:manage'));
CREATE POLICY agenda_categorias_evento_delete_manager ON public.agenda_categorias_evento
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'agenda:manage'));
