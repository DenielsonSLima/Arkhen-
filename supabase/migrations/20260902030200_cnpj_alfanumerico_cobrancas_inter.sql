-- Mantem os contratos Inter e passa CPF/CNPJ sem perda de caracteres.
BEGIN;

CREATE OR REPLACE FUNCTION public.preparar_cobranca_inter(p_user_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cliente_id uuid := NULLIF(coalesce(p_payload->>'cliente_empresa_id', p_payload->>'clienteEmpresaId'), '')::uuid;
  v_contrato_id uuid := NULLIF(coalesce(p_payload->>'contrato_id', p_payload->>'contratoId'), '')::uuid;
  v_cliente public.clientes;
  v_integracao public.configuracoes_integracao_bancaria;
  v_env text;
  v_cfg jsonb;
  v_meio text := initcap(lower(coalesce(
    NULLIF(p_payload->>'meio_pagamento',''),
    NULLIF(p_payload->>'meioPagamento',''),
    'Boleto'
  )));
  v_valor numeric := coalesce(NULLIF(p_payload->>'valor','')::numeric, 0);
  v_vencimento date := coalesce(
    NULLIF(p_payload->>'data_vencimento','')::date,
    NULLIF(p_payload->>'dataVencimento','')::date,
    CURRENT_DATE
  );
  v_documento text;
  v_nome text;
  v_logradouro text;
  v_numero text;
  v_bairro text;
  v_cidade text;
  v_uf text;
  v_cep text;
  v_client_id text;
  v_client_secret text;
  v_certificado text;
  v_chave_privada text;
  v_chave_pix text;
BEGIN
  IF v_empresa_id IS NULL OR v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuario ou cliente invalido.';
  END IF;
  IF v_meio NOT IN ('Boleto','Pix','Ambos') THEN
    RAISE EXCEPTION 'Meio de pagamento Inter invalido.';
  END IF;
  IF v_valor <= 0 OR v_valor > 999999999.99 THEN
    RAISE EXCEPTION 'Valor da cobranca invalido.';
  END IF;
  IF v_vencimento < CURRENT_DATE THEN
    RAISE EXCEPTION 'Vencimento nao pode estar no passado.';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes c
  WHERE c.id = v_cliente_id
    AND c.empresa_id = v_empresa_id
    AND c.status = 'Ativa';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente ativo nao encontrado para o tenant.';
  END IF;

  IF v_contrato_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_configuracoes f
    WHERE f.id = v_contrato_id AND f.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Recorrencia fora do tenant.';
  END IF;

  SELECT * INTO v_integracao
  FROM public.configuracoes_integracao_bancaria i
  WHERE i.empresa_id = v_empresa_id
    AND i.provedor = 'inter'
    AND i.ativo = true
    AND i.status = 'ativo';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Banco Inter nao esta selecionado e validado.';
  END IF;

  v_env := public.normalize_inter_environment(v_integracao.configuracao->>'activeEnvironment');
  v_cfg := coalesce(v_integracao.configuracao->'environments'->v_env, '{}'::jsonb);
  IF v_meio IN ('Boleto','Ambos')
     AND NOT public.inter_jsonb_boolean(v_integracao.modulos, 'boleto', false) THEN
    RAISE EXCEPTION 'Modulo boleto Inter desabilitado.';
  END IF;
  IF v_meio = 'Pix'
     AND NOT public.inter_jsonb_boolean(v_integracao.modulos, 'pix', false) THEN
    RAISE EXCEPTION 'Modulo Pix Inter desabilitado.';
  END IF;
  v_chave_pix := NULLIF(trim(v_cfg->>'chavePix'), '');
  IF v_meio = 'Pix' AND v_chave_pix IS NULL THEN
    RAISE EXCEPTION 'Chave Pix nao configurada no ambiente ativo.';
  END IF;

  IF v_cliente.tipo = 'PF' THEN
    v_documento := app_private.normalizar_cnpj_alfanumerico(v_cliente.cnpj);
    IF v_documento !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'CPF do pagador deve conter exatamente 11 digitos.';
    END IF;
  ELSE
    v_documento := app_private.normalizar_cnpj_alfanumerico(v_cliente.cnpj);
    IF app_private.cnpj_alfanumerico_valido(v_documento) IS NOT TRUE THEN
      RAISE EXCEPTION 'CNPJ alfanumerico do pagador invalido.';
    END IF;
  END IF;

  v_nome := coalesce(NULLIF(v_cliente.razao_social,''), NULLIF(v_cliente.nome,''));
  v_logradouro := coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'logradouro',''),
    NULLIF(v_cliente.endereco,'')
  );
  v_numero := coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'numero',''),
    NULLIF(p_payload->>'numeroEndereco',''),
    'S/N'
  );
  v_bairro := coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'bairro',''),
    NULLIF(v_cliente.bairro,'')
  );
  v_cidade := coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'cidade',''),
    NULLIF(v_cliente.cidade,'')
  );
  v_uf := upper(coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'uf',''),
    NULLIF(v_cliente.uf,'')
  ));
  v_cep := regexp_replace(coalesce(
    NULLIF(p_payload->'pagador'->'endereco'->>'cep',''),
    v_cliente.cep,
    ''
  ), '[^0-9]', '', 'g');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Nome do pagador invalido.';
  END IF;
  IF v_logradouro IS NULL OR v_numero IS NULL OR v_bairro IS NULL OR v_cidade IS NULL
     OR length(v_uf) <> 2 OR length(v_cep) <> 8 THEN
    RAISE EXCEPTION 'Endereco completo do pagador obrigatorio.';
  END IF;

  SELECT decrypted_secret INTO v_client_id
  FROM vault.decrypted_secrets
  WHERE id = NULLIF(v_cfg->>'client_id_secret_id','')::uuid;
  SELECT decrypted_secret INTO v_client_secret
  FROM vault.decrypted_secrets
  WHERE id = NULLIF(v_cfg->>'client_secret_secret_id','')::uuid;
  SELECT decrypted_secret INTO v_certificado
  FROM vault.decrypted_secrets
  WHERE id = NULLIF(v_cfg->>'certificado_pem_secret_id','')::uuid;
  SELECT decrypted_secret INTO v_chave_privada
  FROM vault.decrypted_secrets
  WHERE id = NULLIF(v_cfg->>'chave_privada_pem_secret_id','')::uuid;
  IF v_client_id IS NULL OR v_client_secret IS NULL OR v_certificado IS NULL
     OR v_chave_privada IS NULL THEN
    RAISE EXCEPTION 'Credenciais Inter incompletas no Vault.';
  END IF;
  IF NULLIF(v_cfg->>'baseUrl','') IS NULL OR NULLIF(v_cfg->>'authUrl','') IS NULL THEN
    RAISE EXCEPTION 'Ambiente Inter incompleto.';
  END IF;

  RETURN jsonb_build_object(
    'empresaId', v_empresa_id,
    'ambiente', v_env,
    'baseUrl', v_cfg->>'baseUrl',
    'authUrl', v_cfg->>'authUrl',
    'clientId', v_client_id,
    'clientSecret', v_client_secret,
    'certificadoPem', v_certificado,
    'chavePrivadaPem', v_chave_privada,
    'contaCorrente', v_cfg->>'contaCorrente',
    'chavePix', CASE WHEN v_meio = 'Pix' THEN v_chave_pix END,
    'modulos', v_integracao.modulos,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'name', v_nome,
      'cpfCnpj', v_documento,
      'email', NULLIF(v_cliente.email,''),
      'phone', NULLIF(regexp_replace(v_cliente.telefone,'[^0-9]','','g'),''),
      'endereco', v_logradouro,
      'numero', v_numero,
      'bairro', v_bairro,
      'cidade', v_cidade,
      'uf', v_uf,
      'cep', v_cep
    ),
    'cobranca', jsonb_build_object(
      'clienteEmpresaId', v_cliente_id,
      'contratoId', v_contrato_id,
      'descricao', left(coalesce(NULLIF(p_payload->>'descricao',''), 'Cobranca avulsa'), 500),
      'categoria', left(coalesce(NULLIF(p_payload->>'categoria',''), 'Faturamento'), 120),
      'valor', v_valor,
      'dataVencimento', v_vencimento,
      'meioPagamento', v_meio,
      'descontoPercentual', greatest(coalesce(NULLIF(p_payload->>'desconto_percentual','')::numeric, 0), 0),
      'jurosPercentual', greatest(coalesce(NULLIF(p_payload->>'juros_percentual','')::numeric, 0), 0),
      'multaPercentual', greatest(coalesce(NULLIF(p_payload->>'multa_percentual','')::numeric, 0), 0),
      'mensagemBoleto', left(coalesce(p_payload->>'mensagem_boleto',''), 220)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_cobranca_inter(p_user_id uuid, p_payload jsonb)
RETURNS public.financeiro_cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_cliente_id uuid := NULLIF(coalesce(
    p_payload->>'cliente_empresa_id',
    p_payload->>'clienteEmpresaId',
    p_payload->'cobranca'->>'clienteEmpresaId'
  ), '')::uuid;
  v_contrato_id uuid := NULLIF(coalesce(
    p_payload->>'contrato_id',
    p_payload->>'contratoId',
    p_payload->'cobranca'->>'contratoId'
  ), '')::uuid;
  v_cliente public.clientes;
  v_integracao public.configuracoes_integracao_bancaria;
  v_response jsonb := coalesce(
    p_payload->'provider_payload',
    p_payload->'response',
    p_payload->'payment',
    '{}'::jsonb
  );
  v_env text;
  v_external_id text;
  v_remote_status text;
  v_local_status text;
  v_meio text;
  v_documento text;
  v_valor numeric;
  v_vencimento date;
  v_cobranca public.financeiro_cobrancas;
  v_integracao_id uuid;
BEGIN
  IF v_empresa_id IS NULL OR v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuario ou cliente invalido.';
  END IF;
  SELECT * INTO v_integracao
  FROM public.configuracoes_integracao_bancaria i
  WHERE i.empresa_id = v_empresa_id AND i.provedor = 'inter';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Banco Inter nao esta configurado.';
  END IF;
  SELECT * INTO v_cliente
  FROM public.clientes c
  WHERE c.id = v_cliente_id
    AND c.empresa_id = v_empresa_id
    AND c.status = 'Ativa';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente ativo fora do tenant.';
  END IF;

  IF v_cliente.tipo = 'PF' THEN
    v_documento := app_private.normalizar_cnpj_alfanumerico(v_cliente.cnpj);
    IF v_documento !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'CPF do cliente deve conter exatamente 11 digitos.';
    END IF;
  ELSE
    v_documento := app_private.normalizar_cnpj_alfanumerico(v_cliente.cnpj);
    IF app_private.cnpj_alfanumerico_valido(v_documento) IS NOT TRUE THEN
      RAISE EXCEPTION 'CNPJ alfanumerico do cliente invalido.';
    END IF;
  END IF;

  IF v_contrato_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_configuracoes f
    WHERE f.id = v_contrato_id AND f.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Recorrencia fora do tenant.';
  END IF;
  IF lower(coalesce(p_payload->>'ambiente', '')) NOT IN ('producao', 'homologacao') THEN
    RAISE EXCEPTION 'Ambiente efetivo da cobranca Inter invalido.';
  END IF;
  v_env := public.normalize_inter_environment(p_payload->>'ambiente');
  v_external_id := coalesce(
    NULLIF(p_payload->>'external_id',''),
    NULLIF(p_payload->>'externalId',''),
    NULLIF(v_response->>'codigoSolicitacao',''),
    NULLIF(v_response->>'id',''),
    NULLIF(v_response->>'txid','')
  );
  IF v_external_id IS NULL THEN
    RAISE EXCEPTION 'Resposta Inter sem identificador externo.';
  END IF;
  SELECT fc.* INTO v_cobranca
  FROM public.financeiro_cobrancas_integracoes i
  JOIN public.financeiro_cobrancas fc
    ON fc.id = i.cobranca_id AND fc.empresa_id = i.empresa_id
  WHERE i.empresa_id = v_empresa_id
    AND i.provedor = 'inter'
    AND i.ambiente = v_env
    AND i.external_id = v_external_id;
  IF FOUND THEN
    RETURN v_cobranca;
  END IF;

  v_remote_status := coalesce(
    NULLIF(v_response->>'situacao',''),
    NULLIF(v_response->>'status',''),
    'EMITIDO'
  );
  v_local_status := public.map_inter_charge_status(v_remote_status);
  v_meio := initcap(lower(coalesce(
    NULLIF(p_payload->>'meio_pagamento',''),
    NULLIF(p_payload->>'meioPagamento',''),
    NULLIF(p_payload->'cobranca'->>'meioPagamento',''),
    'Boleto'
  )));
  v_valor := coalesce(
    NULLIF(p_payload->>'valor','')::numeric,
    NULLIF(p_payload->'cobranca'->>'valor','')::numeric,
    0
  );
  v_vencimento := coalesce(
    NULLIF(p_payload->>'data_vencimento','')::date,
    NULLIF(p_payload->'cobranca'->>'dataVencimento','')::date,
    CURRENT_DATE
  );
  IF v_meio NOT IN ('Boleto','Pix','Ambos') OR v_valor <= 0 OR v_valor > 999999999.99 THEN
    RAISE EXCEPTION 'Dados da cobranca Inter invalidos.';
  END IF;
  IF v_meio IN ('Boleto','Ambos')
     AND NOT public.inter_jsonb_boolean(v_integracao.modulos,'boleto',false) THEN
    RAISE EXCEPTION 'Modulo boleto Inter desabilitado.';
  END IF;
  IF v_meio = 'Pix'
     AND NOT public.inter_jsonb_boolean(v_integracao.modulos,'pix',false) THEN
    RAISE EXCEPTION 'Modulo Pix Inter desabilitado.';
  END IF;

  INSERT INTO public.financeiro_cobrancas (
    empresa_id, contrato_id, cliente_empresa_id, descricao, categoria, valor,
    data_vencimento, status, meio_pagamento, data_pagamento, data_cancelamento
  ) VALUES (
    v_empresa_id,
    v_contrato_id,
    v_cliente_id,
    left(coalesce(
      NULLIF(p_payload->>'descricao',''),
      NULLIF(p_payload->'cobranca'->>'descricao',''),
      'Cobranca avulsa'
    ), 500),
    left(coalesce(
      NULLIF(p_payload->>'categoria',''),
      NULLIF(p_payload->'cobranca'->>'categoria',''),
      'Faturamento'
    ), 120),
    v_valor,
    v_vencimento,
    v_local_status,
    v_meio,
    CASE WHEN v_local_status = 'Pago' THEN now() END,
    CASE WHEN v_local_status = 'Cancelado' THEN now() END
  ) RETURNING * INTO v_cobranca;

  v_integracao_id := public.registrar_integracao_cobranca_service(
    p_user_id,
    v_cobranca.id,
    'inter',
    v_env,
    v_response || jsonb_build_object(
      'externalId', v_external_id,
      'tipo', CASE
        WHEN v_meio = 'Pix' THEN 'pix'
        WHEN v_meio = 'Ambos' THEN 'bolepix'
        ELSE 'boleto'
      END,
      'boletoUrl', coalesce(
        NULLIF(p_payload->>'invoice_url',''),
        v_response->>'boletoUrl',
        v_response->>'caminhoBoleto',
        v_response->'boleto'->>'url',
        v_response->>'location'
      ),
      'pixCopiaECola', coalesce(
        NULLIF(p_payload->>'pix_copia_cola',''),
        v_response->>'pixCopiaECola',
        v_response->>'pixCopiaCola',
        v_response->'pix'->>'copiaECola'
      ),
      'pixQrCode', coalesce(
        v_response->>'pixQrCode',
        v_response->'pix'->>'qrCode'
      )
    )
  );
  RETURN v_cobranca;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_cobranca_inter(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_cobranca_inter(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_cobranca_inter(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_cobranca_inter(uuid, jsonb) TO service_role;

COMMIT;
