-- EXPAND: perfis externos continuam client-scoped mesmo sem vínculo ativo.
-- Assim, desativar o último vínculo nega o acesso em vez de ampliar para o tenant.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_client_scoped(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_empresa_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.cliente_usuario_acessos acesso
        WHERE acesso.auth_user_id = auth.uid()
          AND acesso.empresa_id = p_empresa_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_usuarios usuario
        LEFT JOIN public.configuracoes_perfis_acesso perfil
          ON perfil.empresa_id = usuario.empresa_id
         AND (
           perfil.id = usuario.perfil_id
           OR lower(perfil.nome) = lower(coalesce(usuario.perfil, ''))
         )
        WHERE usuario.empresa_id = p_empresa_id
          AND usuario.auth_user_id = auth.uid()
          AND (
            lower(coalesce(usuario.perfil, '')) IN ('cliente', 'cliente externo')
            OR lower(coalesce(perfil.codigo, '')) IN (
              'cliente', 'cliente-externo', 'cliente_externo'
            )
            OR lower(coalesce(perfil.nome, '')) IN ('cliente', 'cliente externo')
            OR 'cliente-portal:view' = ANY(coalesce(perfil.permissoes, '{}'::text[]))
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.perfis membership
        WHERE membership.empresa_id = p_empresa_id
          AND membership.user_id = auth.uid()
          AND lower(coalesce(membership.papel, '')) = 'cliente'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_client_scoped(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_client_scoped(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_is_client_scoped(uuid) IS
  'Fail-closed: vínculo histórico ou marcador explícito de perfil externo mantém escopo de cliente; permissões genéricas view-own não reclassificam perfis internos.';

COMMIT;
