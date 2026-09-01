-- Ajustes RLS estritamente ligados a identidade de usuario. As policies dos
-- demais modulos permanecem intactas e herdam as guardas centralizadas de
-- current_user_access_allowed/current_user_has_permission.

ALTER TABLE public.configuracoes_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_usuarios_select_self_or_manager
  ON public.configuracoes_usuarios;
CREATE POLICY configuracoes_usuarios_select_self_or_manager
ON public.configuracoes_usuarios
FOR SELECT TO authenticated
USING (
  (
    auth_user_id = auth.uid()
    AND public.current_user_access_allowed(empresa_id)
  )
  OR public.current_user_has_permission(empresa_id, 'usuarios:manage')
);

DROP POLICY IF EXISTS configuracoes_usuarios_insert_manager
  ON public.configuracoes_usuarios;
DROP POLICY IF EXISTS configuracoes_usuarios_insert_email_manager
  ON public.configuracoes_usuarios;
CREATE POLICY configuracoes_usuarios_insert_manager
ON public.configuracoes_usuarios
FOR INSERT TO authenticated
WITH CHECK (
  login_method = 'email'
  AND public.current_user_has_permission(empresa_id, 'usuarios:manage')
);

DROP POLICY IF EXISTS perfis_select_self_or_manager ON public.perfis;
CREATE POLICY perfis_select_self_or_manager ON public.perfis
FOR SELECT TO authenticated
USING (
  (
    user_id = auth.uid()
    AND public.current_user_access_allowed(empresa_id)
  )
  OR public.current_user_has_permission(empresa_id, 'usuarios:manage')
);

CREATE OR REPLACE FUNCTION public.proteger_perfil_acesso_funcionario_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.ativo AND NOT NEW.ativo AND EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.perfil_acesso_id = OLD.id
      AND usuario.login_method = 'cpf'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Perfil vinculado a funcionario CPF nao pode ser desativado.';
  END IF;

  IF (
    pg_catalog.lower(COALESCE(NEW.codigo, ''))
      IN ('gestor', 'admin', 'administrador')
    OR pg_catalog.lower(NEW.nome) IN ('gestor', 'admin', 'administrador')
    OR NEW.permissoes && ARRAY[
      'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
    ]::text[]
  ) AND EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.perfil_acesso_id = OLD.id
      AND usuario.login_method = 'cpf'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Perfil em uso por funcionario CPF nao pode receber privilegios de gestao.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_perfil_acesso_funcionario_cpf()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_perfil_acesso_funcionario_cpf_trigger
  ON public.configuracoes_perfis_acesso;
CREATE TRIGGER proteger_perfil_acesso_funcionario_cpf_trigger
BEFORE UPDATE OF codigo, nome, permissoes, ativo
ON public.configuracoes_perfis_acesso
FOR EACH ROW
EXECUTE FUNCTION public.proteger_perfil_acesso_funcionario_cpf();

COMMENT ON COLUMN public.configuracoes_usuarios.email IS
  'Email de contato opcional; nunca armazena o alias tecnico de login por CPF.';
COMMENT ON COLUMN private.identidades_funcionarios_cpf.auth_alias IS
  'Alias opaco do Supabase Auth, isolado de PostgREST e Realtime.';
COMMENT ON FUNCTION public.obter_contexto_usuario_atual() IS
  'Resolve somente por auth.uid/auth_user_id, valida status e janela no servidor e registra o ultimo acesso.';
