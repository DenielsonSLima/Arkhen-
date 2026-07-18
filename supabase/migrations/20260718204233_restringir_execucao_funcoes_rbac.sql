REVOKE EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_manage_empresa(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agenda_current_user_can_manage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() FROM anon;

GRANT EXECUTE ON FUNCTION public.current_user_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_empresa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_current_user_can_manage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_atualizado_em() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_operational_user_link() FROM anon, authenticated;
