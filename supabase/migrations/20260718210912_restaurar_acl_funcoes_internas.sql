-- Restaura as ACLs de rotinas internas que devem ser chamadas apenas por
-- outras funções SECURITY DEFINER, triggers ou Edge Functions com service role.
DO $$
DECLARE
  func record;
  assinatura text;
BEGIN
  FOR func IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY (ARRAY[
        'upsert_vault_secret',
        'build_asaas_environment_config',
        'registrar_asaas_webhook_evento',
        'preparar_cobranca_asaas',
        'registrar_cobranca_asaas',
        'atualizar_cobranca_asaas_webhook',
        'preparar_baixa_manual_asaas',
        'registrar_baixa_manual_financeira',
        'tributario_numero_json',
        'tributario_competencia_json',
        'obter_parametro_tributario',
        'calculo_inss_progressivo_detalhado',
        'calculo_inss_progressivo',
        'calculo_irrf_detalhado',
        'calculo_irrf',
        'executar_simulacao_contabil_interna',
        'envelope_simulacao_existente',
        'ultimo_dia_util_estimado',
        'finalizar_simulacao_tributaria',
        'calculo_data_segura',
        'calcular_simulacao_contabil',
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
        'registrar_operacao_fiscal_edge',
        'seed_catalogo_cnaes_empresa'
      ])
  LOOP
    assinatura := format(
      '%I.%I(%s)',
      func.schema_name,
      func.function_name,
      func.identity_arguments
    );

    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      assinatura
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', assinatura);
  END LOOP;
END;
$$;
