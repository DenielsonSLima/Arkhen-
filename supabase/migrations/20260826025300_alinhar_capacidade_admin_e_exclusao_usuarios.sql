-- Alinha a visibilidade administrativa do frontend com a autoridade real do
-- tenant e impede que uma identidade Auth vinculada seja órfã por DELETE REST.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_active_empresa_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.current_user_is_empresa_admin(public.current_empresa_id()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active_empresa_admin()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_active_empresa_admin()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL
     AND COALESCE((SELECT auth.role()), '') NOT IN ('', 'service_role') THEN
    RAISE EXCEPTION 'Contas vinculadas ao login devem ser inativadas, não excluídas.'
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_exclusao_usuario_auth_vinculado()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_exclusao_usuario_auth_vinculado_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER proteger_exclusao_usuario_auth_vinculado_trigger
  BEFORE DELETE ON public.configuracoes_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_exclusao_usuario_auth_vinculado();

COMMIT;
