-- Documento BolePix protegido por token publico e leitura publica agnostica de provedor.
CREATE OR REPLACE FUNCTION public.preparar_documento_cobranca_inter(p_public_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_cobranca public.financeiro_cobrancas;
  v_integracao_cobranca public.financeiro_cobrancas_integracoes;
  v_integracao public.configuracoes_integracao_bancaria;
  v_cfg jsonb;
BEGIN
  SELECT * INTO v_cobranca FROM public.financeiro_cobrancas c
  WHERE c.public_token = p_public_token AND c.status NOT IN ('Pago', 'Cancelado');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca indisponivel.'; END IF;
  SELECT * INTO v_integracao_cobranca FROM public.financeiro_cobrancas_integracoes i
  WHERE i.empresa_id = v_cobranca.empresa_id AND i.cobranca_id = v_cobranca.id
    AND i.provedor = 'inter' AND i.tipo IN ('boleto', 'bolepix')
  ORDER BY i.created_at DESC LIMIT 1;
  IF NOT FOUND OR NULLIF(v_integracao_cobranca.external_id, '') IS NULL THEN
    RAISE EXCEPTION 'Documento Inter indisponivel.';
  END IF;
  SELECT * INTO v_integracao FROM public.configuracoes_integracao_bancaria i
  WHERE i.empresa_id = v_cobranca.empresa_id AND i.provedor = 'inter';
  IF NOT FOUND THEN RAISE EXCEPTION 'Integracao Inter indisponivel.'; END IF;
  v_cfg := coalesce(v_integracao.configuracao->'environments'->v_integracao_cobranca.ambiente, '{}'::jsonb);
  RETURN jsonb_build_object(
    'ambiente', v_integracao_cobranca.ambiente,
    'externalId', v_integracao_cobranca.external_id,
    'baseUrl', v_cfg->>'baseUrl', 'authUrl', v_cfg->>'authUrl',
    'clientId', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_cfg->>'client_id_secret_id', '')::uuid),
    'clientSecret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_cfg->>'client_secret_secret_id', '')::uuid),
    'certificadoPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_cfg->>'certificado_pem_secret_id', '')::uuid),
    'chavePrivadaPem', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = NULLIF(v_cfg->>'chave_privada_pem_secret_id', '')::uuid),
    'contaCorrente', v_cfg->>'contaCorrente',
    'modulos', jsonb_build_object('boleto', true, 'pix', false, 'webhook', false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_cobranca(p_public_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_payload jsonb;
  v_pix_copy text;
  v_expired boolean;
BEGIN
  SELECT cb.*, fc.descricao_servico, cl.nome AS cliente_nome,
    cl.razao_social AS cliente_razao_social, cl.cnpj AS cliente_cnpj,
    cl.email AS cliente_email, cl.telefone AS cliente_telefone,
    cl.tipo AS cliente_tipo, cl.tipo_estabelecimento AS cliente_tipo_estabelecimento,
    coalesce(nullif(ce.razao_social,''), nullif(ce.nome_fantasia,''), nullif(e.razao_social,''), nullif(e.nome,''), 'Empresa emissora') AS emissor_nome,
    coalesce(nullif(ce.razao_social,''), nullif(e.razao_social,''), nullif(ce.nome_fantasia,''), nullif(e.nome,''), 'Empresa emissora') AS emissor_razao_social,
    coalesce(nullif(ce.cnpj,''), nullif(e.cnpj,'')) AS emissor_cnpj,
    ce.logo_url AS emissor_logo_url, ci.provedor AS bank_provider,
    ci.boleto_url AS integration_boleto_url, ci.pix_copia_cola, ci.payload AS integration_payload
  INTO v_row FROM public.financeiro_cobrancas cb
  LEFT JOIN public.financeiro_configuracoes fc ON fc.id = cb.contrato_id
  LEFT JOIN public.clientes cl ON cl.id = cb.cliente_empresa_id
  LEFT JOIN public.configuracoes_empresa ce ON ce.empresa_id = cb.empresa_id
  LEFT JOIN public.empresas e ON e.id = cb.empresa_id
  LEFT JOIN LATERAL (
    SELECT i.provedor, i.boleto_url, i.pix_copia_cola, i.payload
    FROM public.financeiro_cobrancas_integracoes i
    WHERE i.empresa_id = cb.empresa_id AND i.cobranca_id = cb.id
    ORDER BY i.created_at DESC LIMIT 1
  ) ci ON true
  WHERE cb.public_token = p_public_token;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  v_payload := coalesce(v_row.asaas_payload, '{}'::jsonb) || coalesce(v_row.integration_payload, '{}'::jsonb);
  v_expired := v_row.status IN ('Pago', 'Cancelado');
  v_pix_copy := coalesce(NULLIF(v_row.pix_copia_cola, ''),
    NULLIF(v_payload #>> '{pixCopiaECola}', ''), NULLIF(v_payload #>> '{pix,pixCopiaECola}', ''),
    NULLIF(v_payload #>> '{pixQrCode,payload}', ''), NULLIF(v_payload #>> '{pixQrCode,copyPaste}', ''),
    NULLIF(v_payload #>> '{pix,payload}', ''), NULLIF(v_payload #>> '{payment,pixQrCode,payload}', ''));
  RETURN jsonb_build_object(
    'id', v_row.id, 'publicToken', v_row.public_token,
    'descricao', coalesce(nullif(v_row.descricao,''), 'Cobrança'),
    'servicoDescricao', coalesce(nullif(v_row.descricao_servico,''), nullif(v_row.descricao,''), 'Serviço contratado'),
    'valor', coalesce(v_row.valor,0), 'dataVencimento', v_row.data_vencimento,
    'status', v_row.status, 'meioPagamento', v_row.meio_pagamento,
    'bankProvider', coalesce(v_row.bank_provider, CASE WHEN v_row.asaas_cobranca_id IS NOT NULL THEN 'asaas' END),
    'paymentLink', CASE WHEN v_expired THEN '' ELSE coalesce(nullif(v_row.asaas_bank_slip_url,''),
      nullif(v_row.asaas_boleto_url,''), nullif(v_row.asaas_invoice_url,''), nullif(v_row.integration_boleto_url,''), '') END,
    'bankSlipLink', CASE WHEN v_expired THEN '' ELSE coalesce(nullif(v_row.asaas_bank_slip_url,''),
      nullif(v_row.asaas_boleto_url,''), nullif(v_row.integration_boleto_url,''), '') END,
    'pixCopyPaste', CASE WHEN v_expired THEN '' ELSE coalesce(v_pix_copy,'') END,
    'clienteNome', coalesce(nullif(v_row.cliente_razao_social,''), nullif(v_row.cliente_nome,''), 'Cliente'),
    'clienteCnpj', coalesce(nullif(v_row.cliente_cnpj,''),''), 'clienteEmail', coalesce(nullif(v_row.cliente_email,''),''),
    'clienteTelefone', coalesce(nullif(v_row.cliente_telefone,''),''), 'clienteTipo', coalesce(nullif(v_row.cliente_tipo,''),''),
    'clienteTipoEstabelecimento', coalesce(nullif(v_row.cliente_tipo_estabelecimento,''),''),
    'emissorNome', v_row.emissor_nome, 'emissorRazaoSocial', v_row.emissor_razao_social,
    'emissorCnpj', coalesce(v_row.emissor_cnpj,''), 'emissorLogoUrl', coalesce(v_row.emissor_logo_url,''),
    'isExpired', v_expired, 'expiredReason', CASE WHEN v_row.status='Pago' THEN 'Esta cobrança já foi paga.'
      WHEN v_row.status='Cancelado' THEN 'Esta cobrança foi cancelada.' ELSE '' END, 'generatedAt', now());
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_documento_cobranca_inter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_documento_cobranca_inter(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_public_cobranca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_cobranca(uuid) TO anon, authenticated;
