-- Registra no ledger local o helper de escopo que as policies operacionais usam.
-- Em ambientes onde ele ja existe, preserva a definicao instalada.

DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.current_user_is_client_scoped(uuid)'
  ) IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION public.current_user_is_client_scoped(p_empresa_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = ''
      AS $function$
      DECLARE
        v_cliente_acesso boolean := false;
      BEGIN
        IF auth.uid() IS NULL OR p_empresa_id IS NULL THEN
          RETURN false;
        END IF;

        IF pg_catalog.to_regclass('public.cliente_usuario_acessos') IS NOT NULL THEN
          EXECUTE $query$
            SELECT EXISTS (
              SELECT 1
              FROM public.cliente_usuario_acessos acesso
              WHERE acesso.auth_user_id = $1
                AND acesso.empresa_id = $2
            )
          $query$
          INTO v_cliente_acesso
          USING auth.uid(), p_empresa_id;

          IF v_cliente_acesso THEN
            RETURN true;
          END IF;
        END IF;

        RETURN EXISTS (
          SELECT 1
          FROM public.configuracoes_usuarios usuario
          LEFT JOIN public.configuracoes_perfis_acesso perfil
            ON perfil.empresa_id = usuario.empresa_id
           AND (
             perfil.id = usuario.perfil_id
             OR lower(perfil.nome) = lower(COALESCE(usuario.perfil, ''))
           )
          WHERE usuario.empresa_id = p_empresa_id
            AND usuario.auth_user_id = auth.uid()
            AND (
              lower(COALESCE(usuario.perfil, '')) IN ('cliente', 'cliente externo')
              OR lower(COALESCE(perfil.codigo, '')) IN (
                'cliente', 'cliente-externo', 'cliente_externo'
              )
              OR lower(COALESCE(perfil.nome, '')) IN ('cliente', 'cliente externo')
              OR 'cliente-portal:view' = ANY(
                COALESCE(perfil.permissoes, '{}'::text[])
              )
            )
        ) OR EXISTS (
          SELECT 1
          FROM public.perfis membership
          WHERE membership.empresa_id = p_empresa_id
            AND membership.user_id = auth.uid()
            AND lower(COALESCE(membership.papel, '')) = 'cliente'
        );
      END;
      $function$
    $definition$;
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.current_user_is_client_scoped(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_client_scoped(uuid)
  TO authenticated;
