-- Remove o Asaas do runtime sem apagar o histórico contábil de cobranças.
-- Novas operações bancárias são exclusivamente Banco Inter.

ALTER TABLE public.financeiro_cobrancas
  ADD COLUMN IF NOT EXISTS nfse_id text,
  ADD COLUMN IF NOT EXISTS nfse_status text,
  ADD COLUMN IF NOT EXISTS nfse_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.financeiro_cobrancas
SET nfse_id = coalesce(nfse_id, asaas_nfse_id),
    nfse_status = coalesce(nfse_status, CASE WHEN asaas_nfse_id IS NOT NULL THEN 'historico' END)
WHERE asaas_nfse_id IS NOT NULL;

DROP TRIGGER IF EXISTS sync_asaas_cobranca_integracao_trigger ON public.financeiro_cobrancas;
DROP FUNCTION IF EXISTS public.sync_asaas_cobranca_integracao();

DO $$
DECLARE
  v_row record;
  v_env text;
  v_secret_id uuid;
  v_config jsonb;
BEGIN
  FOR v_row IN
    SELECT id, empresa_id, configuracao
    FROM public.configuracoes_integracao_bancaria
    WHERE provedor = 'asaas'
  LOOP
    v_config := coalesce(v_row.configuracao, '{}'::jsonb);
    FOREACH v_env IN ARRAY ARRAY['producao', 'homologacao'] LOOP
      FOREACH v_secret_id IN ARRAY ARRAY[
        NULLIF(v_config->'environments'->v_env->>'api_key_secret_id', '')::uuid,
        NULLIF(v_config->'environments'->v_env->>'webhook_token_secret_id', '')::uuid
      ] LOOP
        IF v_secret_id IS NOT NULL THEN
          PERFORM vault.update_secret(
            v_secret_id,
            'removed-' || gen_random_uuid()::text,
            'asaas_removed_' || replace(gen_random_uuid()::text, '-', ''),
            'Credencial Asaas inutilizada na remocao da integracao em ' || now()::text
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

DELETE FROM public.configuracoes_integracao_bancaria WHERE provedor = 'asaas';
DROP TABLE IF EXISTS public.asaas_webhook_eventos CASCADE;

DO $$
DECLARE v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname ILIKE '%asaas%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function.signature);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_integracoes_bancarias()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_resultado jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'provedor', c.provedor, 'ambiente', c.ambiente, 'ativo', c.ativo,
    'status', c.status, 'configurado', c.status <> 'nao_configurado', 'modulos', c.modulos,
    'ultimoErro', c.ultimo_erro, 'validadoEm', c.validado_em, 'atualizadoEm', c.updated_at
  )), '[]'::jsonb)
  INTO v_resultado
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter';
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.selecionar_provedor_bancario(p_provedor text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode selecionar o banco.';
  END IF;
  IF lower(trim(coalesce(p_provedor, ''))) <> 'inter' OR NOT EXISTS (
    SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter' AND c.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Banco Inter ainda nao foi validado.';
  END IF;
  UPDATE public.configuracoes_integracao_bancaria
  SET ativo = (provedor = 'inter'), updated_at = now()
  WHERE empresa_id = v_empresa_id;
  RETURN public.listar_integracoes_bancarias();
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_provedor_bancario_ativo(p_user_id uuid, p_provedor text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  IF lower(trim(coalesce(p_provedor, ''))) <> 'inter' THEN RAISE EXCEPTION 'Banco nao suportado.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.configuracoes_integracao_bancaria c
    WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter' AND c.ativo AND c.status = 'ativo'
  ) THEN RAISE EXCEPTION 'Banco Inter nao esta selecionado e validado.'; END IF;
  RETURN jsonb_build_object('ok', true, 'empresaId', v_empresa_id, 'provedor', 'inter');
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_operacao_cobranca_inter(
  p_user_id uuid, p_cobranca_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_charge public.financeiro_cobrancas;
  v_integration public.financeiro_cobrancas_integracoes;
  v_config public.configuracoes_integracao_bancaria;
  v_environment jsonb;
  v_ambiente text;
BEGIN
  IF v_empresa_id IS NULL OR p_cobranca_id IS NULL THEN RAISE EXCEPTION 'Cobranca invalida.'; END IF;
  SELECT * INTO v_charge FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fora do tenant.'; END IF;
  IF v_charge.status = 'Pago' THEN RAISE EXCEPTION 'Cobranca paga nao pode ser cancelada.'; END IF;
  SELECT * INTO v_integration FROM public.financeiro_cobrancas_integracoes
  WHERE empresa_id = v_empresa_id AND cobranca_id = p_cobranca_id AND provedor = 'inter'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('externa', false, 'cobrancaId', v_charge.id);
  END IF;
  SELECT * INTO v_config FROM public.configuracoes_integracao_bancaria
  WHERE empresa_id = v_empresa_id AND provedor = 'inter';
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuracao Banco Inter ausente.'; END IF;
  v_ambiente := public.normalize_inter_environment(v_integration.ambiente);
  v_environment := coalesce(v_config.configuracao->'environments'->v_ambiente, '{}'::jsonb);
  RETURN jsonb_build_object(
    'externa', true, 'cobrancaId', v_charge.id, 'externalId', v_integration.external_id,
    'ambiente', v_ambiente, 'baseUrl', v_environment->>'baseUrl', 'authUrl', v_environment->>'authUrl',
    'clientId', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_environment->>'client_id_secret_id','')::uuid),
    'clientSecret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_environment->>'client_secret_secret_id','')::uuid),
    'certificadoPem', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_environment->>'certificado_pem_secret_id','')::uuid),
    'chavePrivadaPem', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = NULLIF(v_environment->>'chave_privada_pem_secret_id','')::uuid),
    'contaCorrente', v_environment->>'contaCorrente', 'modulos', v_config.modulos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_cancelamento_cobranca_inter(
  p_user_id uuid, p_cobranca_id uuid, p_external_id text, p_resultado jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  UPDATE public.financeiro_cobrancas_integracoes
  SET status = 'CANCELADO', payload = coalesce(payload, '{}'::jsonb) || coalesce(p_resultado, '{}'::jsonb),
      sincronizado_em = now(), updated_at = now()
  WHERE empresa_id = v_empresa_id AND cobranca_id = p_cobranca_id
    AND provedor = 'inter' AND external_id = p_external_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao da cobranca nao encontrada.'; END IF;
  UPDATE public.financeiro_cobrancas
  SET status = 'Cancelado', data_cancelamento = now(), updated_at = now()
  WHERE empresa_id = v_empresa_id AND id = p_cobranca_id AND status <> 'Pago';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_operacao_cobranca_inter(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_cancelamento_cobranca_inter(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_operacao_cobranca_inter(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_cancelamento_cobranca_inter(uuid, uuid, text, jsonb) TO service_role;

REVOKE ALL ON public.financeiro_cobrancas_integracoes FROM authenticated;
GRANT SELECT (
  id, empresa_id, cobranca_id, provedor, ambiente, external_id, tipo, status,
  boleto_url, pix_copia_cola, pix_qr_code, payload, sincronizado_em, created_at, updated_at
) ON public.financeiro_cobrancas_integracoes TO authenticated;
