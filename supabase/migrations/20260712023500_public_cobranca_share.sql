ALTER TABLE public.financeiro_cobrancas
ADD COLUMN IF NOT EXISTS public_token uuid;

UPDATE public.financeiro_cobrancas
SET public_token = gen_random_uuid()
WHERE public_token IS NULL;

ALTER TABLE public.financeiro_cobrancas
ALTER COLUMN public_token SET DEFAULT gen_random_uuid(),
ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_cobrancas_public_token
ON public.financeiro_cobrancas (public_token);

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
  SELECT
    cb.id,
    cb.public_token,
    cb.descricao,
    cb.valor,
    cb.data_vencimento,
    cb.status,
    cb.meio_pagamento,
    cb.asaas_boleto_url,
    cb.asaas_invoice_url,
    cb.asaas_bank_slip_url,
    cb.asaas_payload,
    fc.descricao_servico,
    cl.nome AS cliente_nome,
    cl.razao_social AS cliente_razao_social,
    cl.cnpj AS cliente_cnpj,
    cl.email AS cliente_email,
    cl.telefone AS cliente_telefone,
    cl.tipo AS cliente_tipo,
    cl.tipo_estabelecimento AS cliente_tipo_estabelecimento,
    COALESCE(NULLIF(ce.razao_social, ''), NULLIF(ce.nome_fantasia, ''), NULLIF(e.razao_social, ''), NULLIF(e.nome, ''), 'Empresa emissora') AS emissor_nome,
    COALESCE(NULLIF(ce.razao_social, ''), NULLIF(e.razao_social, ''), NULLIF(ce.nome_fantasia, ''), NULLIF(e.nome, ''), 'Empresa emissora') AS emissor_razao_social,
    COALESCE(NULLIF(ce.cnpj, ''), NULLIF(e.cnpj, '')) AS emissor_cnpj,
    ce.logo_url AS emissor_logo_url
  INTO v_row
  FROM public.financeiro_cobrancas cb
  LEFT JOIN public.financeiro_configuracoes fc ON fc.id = cb.contrato_id
  LEFT JOIN public.clientes cl ON cl.id = cb.cliente_empresa_id
  LEFT JOIN public.configuracoes_empresa ce ON ce.empresa_id = cb.empresa_id
  LEFT JOIN public.empresas e ON e.id = cb.empresa_id
  WHERE cb.public_token = p_public_token;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_payload := COALESCE(v_row.asaas_payload, '{}'::jsonb);
  v_expired := v_row.status IN ('Pago', 'Cancelado');
  v_pix_copy := COALESCE(
    NULLIF(v_payload #>> '{pixQrCode,payload}', ''),
    NULLIF(v_payload #>> '{pixQrCode,copyPaste}', ''),
    NULLIF(v_payload #>> '{pixQrCode,copyPasteCode}', ''),
    NULLIF(v_payload #>> '{pixQrCode,encodedPayload}', ''),
    NULLIF(v_payload #>> '{pixQrCode,qrCode}', ''),
    NULLIF(v_payload #>> '{pix,payload}', ''),
    NULLIF(v_payload #>> '{payment,pixQrCode,payload}', ''),
    NULLIF(v_payload #>> '{payment,pixQrCode,copyPaste}', '')
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'publicToken', v_row.public_token,
    'descricao', COALESCE(NULLIF(v_row.descricao, ''), 'Cobrança'),
    'servicoDescricao', COALESCE(NULLIF(v_row.descricao_servico, ''), NULLIF(v_row.descricao, ''), 'Serviço contratado'),
    'valor', COALESCE(v_row.valor, 0),
    'dataVencimento', v_row.data_vencimento,
    'status', v_row.status,
    'meioPagamento', v_row.meio_pagamento,
    'paymentLink', CASE WHEN v_expired THEN '' ELSE COALESCE(NULLIF(v_row.asaas_bank_slip_url, ''), NULLIF(v_row.asaas_boleto_url, ''), NULLIF(v_row.asaas_invoice_url, ''), '') END,
    'bankSlipLink', CASE WHEN v_expired THEN '' ELSE COALESCE(NULLIF(v_row.asaas_bank_slip_url, ''), NULLIF(v_row.asaas_boleto_url, ''), '') END,
    'pixCopyPaste', CASE WHEN v_expired THEN '' ELSE COALESCE(v_pix_copy, '') END,
    'clienteNome', COALESCE(NULLIF(v_row.cliente_razao_social, ''), NULLIF(v_row.cliente_nome, ''), 'Cliente'),
    'clienteCnpj', COALESCE(NULLIF(v_row.cliente_cnpj, ''), ''),
    'clienteEmail', COALESCE(NULLIF(v_row.cliente_email, ''), ''),
    'clienteTelefone', COALESCE(NULLIF(v_row.cliente_telefone, ''), ''),
    'clienteTipo', COALESCE(NULLIF(v_row.cliente_tipo, ''), ''),
    'clienteTipoEstabelecimento', COALESCE(NULLIF(v_row.cliente_tipo_estabelecimento, ''), ''),
    'emissorNome', v_row.emissor_nome,
    'emissorRazaoSocial', v_row.emissor_razao_social,
    'emissorCnpj', COALESCE(v_row.emissor_cnpj, ''),
    'emissorLogoUrl', COALESCE(v_row.emissor_logo_url, ''),
    'isExpired', v_expired,
    'expiredReason', CASE
      WHEN v_row.status = 'Pago' THEN 'Esta cobrança já foi paga.'
      WHEN v_row.status = 'Cancelado' THEN 'Esta cobrança foi cancelada.'
      ELSE ''
    END,
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_cobranca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_cobranca(uuid) TO anon, authenticated;
