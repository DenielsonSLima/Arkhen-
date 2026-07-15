-- Restringe as funcoes do modulo a papeis autenticados. As RPCs SECURITY
-- DEFINER mantem validacoes internas de empresa, modulo e permissao.

DO $$
DECLARE
  v_func regprocedure;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE '%reforma_tributaria%'
        OR p.proname LIKE 'salvar_reforma_simulacao_%'
        OR p.proname LIKE '%configuracoes_modulos%'
        OR p.proname = 'modulo_sistema_habilitado'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_func);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_func);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modulo_sistema_habilitado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reforma_tributaria_tem_permissao(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_modulos_sistema(jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.listar_reforma_tributaria_painel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_tributaria_adequacao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_reforma_tributaria_checklist(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_reforma_tributaria_xml(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_simulacao_ibs_cbs(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_simulacao_split_payment(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_tributaria_decisao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_reforma_tributaria_historico(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
