-- Remove grants padrao de PUBLIC nas RPCs sensiveis da integracao Asaas.

REVOKE ALL ON FUNCTION public.upsert_vault_secret(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.build_asaas_environment_config(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_configuracao_asaas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_configuracao_asaas(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listar_configuracao_asaas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configuracao_asaas(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_asaas_webhook_evento(text, text, jsonb) TO service_role;
