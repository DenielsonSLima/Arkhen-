-- SECURITY DEFINER não deve herdar EXECUTE de PUBLIC. As duas funções
-- explicitamente públicas continuam disponíveis ao papel anônimo por token.
DO $$
DECLARE
  func record;
  assinatura text;
BEGIN
  FOR func IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments,
      p.prorettype
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    assinatura := format(
      '%I.%I(%s)',
      func.schema_name,
      func.function_name,
      func.identity_arguments
    );

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', assinatura);

    IF func.function_name IN ('get_public_cobranca', 'get_public_document_share') THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role',
        assinatura
      );
    ELSIF func.prorettype IN ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
      OR func.function_name IN (
        'upsert_vault_secret',
        'build_asaas_environment_config',
        'registrar_asaas_webhook_evento',
        'preparar_cobranca_asaas',
        'registrar_cobranca_asaas',
        'atualizar_cobranca_asaas_webhook',
        'preparar_baixa_manual_asaas',
        'registrar_baixa_manual_financeira',
        'build_inter_environment_config',
        'registrar_inter_teste_conexao',
        'preparar_configuracao_inter',
        'registrar_inter_webhook_eventos',
        'resolve_inter_manager_empresa_id',
        'validar_provedor_bancario_ativo',
        'registrar_integracao_cobranca_service',
        'preparar_cobranca_inter',
        'registrar_cobranca_inter',
        'resolve_empresa_id_for_user',
        'preparar_documento_cobranca_inter',
        'upsert_certificado_fiscal_edge',
        'registrar_operacao_fiscal_edge'
      )
    THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', assinatura);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', assinatura);
    ELSE
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        assinatura
      );
    END IF;
  END LOOP;
END;
$$;
