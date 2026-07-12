-- Respeita os meios habilitados na integracao e evita checkout com cartao quando o app permite apenas boleto/Pix.

CREATE OR REPLACE FUNCTION public.preparar_cobranca_asaas(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_empresa_id', '')::uuid;
  v_contrato_id uuid := NULLIF(p_payload->>'contrato_id', '')::uuid;
  v_cliente public.clientes;
  v_config jsonb;
  v_environment text;
  v_environment_config jsonb;
  v_api_key_secret_id uuid;
  v_api_key text;
  v_asaas_customer_id text;
  v_valor numeric := COALESCE((p_payload->>'valor')::numeric, 0);
  v_vencimento date := COALESCE((p_payload->>'data_vencimento')::date, CURRENT_DATE);
  v_meio_pagamento text := COALESCE(NULLIF(p_payload->>'meio_pagamento', ''), 'Boleto');
  v_aceita_boleto boolean;
  v_aceita_pix boolean;
  v_aceita_cartao boolean;
  v_desconto_percentual numeric := GREATEST(COALESCE((p_payload->>'desconto_percentual')::numeric, 0), 0);
  v_juros_percentual numeric := GREATEST(COALESCE((p_payload->>'juros_percentual')::numeric, 0), 0);
  v_multa_percentual numeric := GREATEST(COALESCE((p_payload->>'multa_percentual')::numeric, 0), 0);
  v_mensagem_boleto text := left(COALESCE(NULLIF(p_payload->>'mensagem_boleto', ''), ''), 220);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio para gerar cobranca.';
  END IF;

  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor da cobranca deve ser maior que zero.';
  END IF;

  SELECT *
    INTO v_cliente
  FROM public.clientes c
  WHERE c.id = v_cliente_id
    AND c.empresa_id = v_empresa_id
  LIMIT 1;

  IF v_cliente.id IS NULL THEN
    RAISE EXCEPTION 'Cliente nao encontrado para esta empresa.';
  END IF;

  IF v_contrato_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.financeiro_configuracoes fc
    WHERE fc.id = v_contrato_id
      AND fc.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Recorrencia financeira nao encontrada.';
  END IF;

  SELECT c.configuracao
    INTO v_config
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id
    AND c.provedor = 'asaas'
  LIMIT 1;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Integracao Asaas nao configurada.';
  END IF;

  v_environment := public.normalize_asaas_environment(coalesce(v_config->>'activeEnvironment', 'homologacao'));
  v_environment_config := coalesce(v_config->'environments'->v_environment, '{}'::jsonb);
  v_api_key_secret_id := NULLIF(v_environment_config->>'api_key_secret_id', '')::uuid;
  v_aceita_boleto := COALESCE((v_environment_config->>'aceitaBoleto')::boolean, true);
  v_aceita_pix := COALESCE((v_environment_config->>'aceitaPix')::boolean, true);
  v_aceita_cartao := COALESCE((v_environment_config->>'aceitaCartao')::boolean, false);

  IF v_meio_pagamento = 'Pix' AND NOT v_aceita_pix THEN
    RAISE EXCEPTION 'Pix nao esta habilitado na configuracao Asaas.';
  END IF;

  IF v_meio_pagamento IN ('Boleto', 'Ambos') AND NOT v_aceita_boleto THEN
    IF v_meio_pagamento = 'Ambos' AND v_aceita_pix THEN
      v_meio_pagamento := 'Pix';
    ELSE
      RAISE EXCEPTION 'Boleto nao esta habilitado na configuracao Asaas.';
    END IF;
  END IF;

  IF v_meio_pagamento = 'Cartao' AND NOT v_aceita_cartao THEN
    RAISE EXCEPTION 'Cartao de credito nao esta habilitado na configuracao Asaas.';
  END IF;

  IF v_api_key_secret_id IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas nao configurada para o ambiente ativo.';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_api_key
  FROM vault.decrypted_secrets ds
  WHERE ds.id = v_api_key_secret_id
  LIMIT 1;

  IF NULLIF(trim(coalesce(v_api_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Chave de API Asaas indisponivel no Vault.';
  END IF;

  v_asaas_customer_id := NULLIF(v_cliente.asaas_customer_ids->>v_environment, '');

  RETURN jsonb_build_object(
    'empresaId', v_empresa_id,
    'environment', v_environment,
    'baseUrl', CASE WHEN v_environment = 'producao' THEN 'https://api.asaas.com/v3' ELSE 'https://api-sandbox.asaas.com/v3' END,
    'apiKey', v_api_key,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'name', COALESCE(NULLIF(v_cliente.razao_social, ''), NULLIF(v_cliente.nome, ''), 'Cliente sem nome'),
      'cpfCnpj', regexp_replace(coalesce(v_cliente.cnpj, ''), '\D', '', 'g'),
      'email', NULLIF(v_cliente.email, ''),
      'phone', NULLIF(regexp_replace(coalesce(v_cliente.telefone, ''), '\D', '', 'g'), ''),
      'asaasCustomerId', v_asaas_customer_id
    ),
    'cobranca', jsonb_build_object(
      'clienteEmpresaId', v_cliente.id,
      'contratoId', v_contrato_id,
      'descricao', COALESCE(NULLIF(p_payload->>'descricao', ''), 'Cobranca avulsa'),
      'categoria', COALESCE(NULLIF(p_payload->>'categoria', ''), 'Faturamento'),
      'valor', v_valor,
      'dataVencimento', v_vencimento,
      'meioPagamento', v_meio_pagamento,
      'descontoPercentual', v_desconto_percentual,
      'jurosPercentual', v_juros_percentual,
      'multaPercentual', v_multa_percentual,
      'mensagemBoleto', v_mensagem_boleto
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_cobranca_asaas(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_cobranca_asaas(uuid, jsonb) TO service_role;
