-- A materializacao de atividades depende da empresa do usuario autenticado.
-- Mantem a RPC fora do papel anonimo.

REVOKE EXECUTE ON FUNCTION public.ensure_atividades_instancias(varchar) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_atividades_instancias(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_atividades_instancias(varchar) TO authenticated;
