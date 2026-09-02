-- Preserva o fluxo WebISS e entrega CPF/CNPJ sem remover letras do CNPJ.
BEGIN;

CREATE OR REPLACE FUNCTION public.preparar_emissao_nfse_webiss(
  p_user_id uuid,
  p_cobranca_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_charge public.financeiro_cobrancas;
  v_config public.configuracoes_integracao_fiscal;
  v_company public.configuracoes_empresa;
  v_customer public.clientes;
  v_rps bigint;
  v_cfg jsonb;
  v_ambiente text;
  v_prestador_documento text;
  v_tomador_documento text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  SELECT * INTO v_charge
  FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobranca fiscal fora do tenant.';
  END IF;
  IF v_charge.status = 'Cancelado' THEN
    RAISE EXCEPTION 'Nao e possivel emitir NFS-e de cobranca cancelada.';
  END IF;
  IF v_charge.nfse_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'jaEmitida', true,
      'nfseId', v_charge.nfse_id,
      'cobrancaId', v_charge.id
    );
  END IF;

  SELECT * INTO v_config
  FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id
    AND c.cliente_id IS NULL
    AND c.ativo
    AND c.uf = 'SE'
    AND lower(trim(c.municipio)) = 'itabaiana'
    AND lower(c.provedor) = 'webiss'
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ative a integracao WebISS Itabaiana para o escritorio.';
  END IF;

  SELECT * INTO v_company
  FROM public.configuracoes_empresa
  WHERE empresa_id = v_empresa_id;
  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = v_charge.cliente_empresa_id
    AND empresa_id = v_empresa_id;
  IF v_company.id IS NULL OR v_customer.id IS NULL THEN
    RAISE EXCEPTION 'Prestador ou tomador nao configurado.';
  END IF;

  v_cfg := coalesce(v_config.configuracao, '{}'::jsonb);
  v_prestador_documento := app_private.normalizar_cnpj_alfanumerico(v_company.cnpj);
  IF app_private.cnpj_alfanumerico_valido(v_prestador_documento) IS NOT TRUE THEN
    RAISE EXCEPTION 'CNPJ alfanumerico do prestador invalido.';
  END IF;

  IF v_customer.tipo = 'PF' THEN
    v_tomador_documento := app_private.normalizar_cnpj_alfanumerico(
      v_customer.cnpj
    );
    IF v_tomador_documento !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'CPF do tomador deve conter exatamente 11 digitos.';
    END IF;
  ELSE
    v_tomador_documento := app_private.normalizar_cnpj_alfanumerico(v_customer.cnpj);
    IF app_private.cnpj_alfanumerico_valido(v_tomador_documento) IS NOT TRUE THEN
      RAISE EXCEPTION 'CNPJ alfanumerico do tomador invalido.';
    END IF;
  END IF;

  IF NULLIF(v_cfg->>'inscricaoMunicipal','') IS NULL THEN
    RAISE EXCEPTION 'Inscricao Municipal do prestador obrigatoria.';
  END IF;
  IF NULLIF(v_cfg->>'codigoCnae','') IS NULL THEN
    RAISE EXCEPTION 'CNAE do servico obrigatorio.';
  END IF;
  IF NULLIF(v_cfg->>'codigoServico','') IS NULL
     OR NULLIF(v_cfg->>'itemListaServico','') IS NULL THEN
    RAISE EXCEPTION 'Codigo e item da lista de servico obrigatorios.';
  END IF;

  IF v_charge.nfse_rps_numero IS NULL THEN
    v_rps := greatest(
      coalesce(NULLIF(regexp_replace(
        v_cfg->>'proximoNumeroRps',
        '[^0-9]',
        '',
        'g'
      ), '')::bigint, 1),
      1
    );
    UPDATE public.financeiro_cobrancas
    SET nfse_rps_numero = v_rps,
        nfse_status = 'processando',
        updated_at = now()
    WHERE id = v_charge.id;
    v_cfg := jsonb_set(
      jsonb_set(v_cfg, '{ultimoNumeroRps}', to_jsonb(v_rps::text), true),
      '{proximoNumeroRps}',
      to_jsonb((v_rps + 1)::text),
      true
    );
    UPDATE public.configuracoes_integracao_fiscal
    SET configuracao = v_cfg,
        updated_at = now()
    WHERE id = v_config.id;
  ELSE
    v_rps := v_charge.nfse_rps_numero;
  END IF;

  v_ambiente := public.normalize_fiscal_environment(v_config.ambiente);
  RETURN jsonb_build_object(
    'jaEmitida', false,
    'fiscalConfigId', v_config.id,
    'cobrancaId', v_charge.id,
    'ambiente', v_ambiente,
    'endpoint', CASE
      WHEN v_ambiente = 'producao' THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx'
      ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx'
    END,
    'certificadoBase64', (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE id = v_config.certificado_arquivo_secret_id
    ),
    'certificadoSenha', (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE id = v_config.certificado_senha_secret_id
    ),
    'rps', jsonb_build_object(
      'numero', v_rps,
      'serie', coalesce(NULLIF(v_cfg->>'serieRps',''),'A'),
      'data', CURRENT_DATE
    ),
    'prestador', jsonb_build_object(
      'cnpj', v_prestador_documento,
      'inscricaoMunicipal', v_cfg->>'inscricaoMunicipal'
    ),
    'tomador', jsonb_build_object(
      'documento', v_tomador_documento,
      'razaoSocial', coalesce(
        NULLIF(v_customer.razao_social,''),
        NULLIF(v_customer.nome,'')
      ),
      'endereco', v_customer.endereco,
      'numero', 'S/N',
      'bairro', v_customer.bairro,
      'cidade', v_customer.cidade,
      'uf', upper(v_customer.uf),
      'cep', regexp_replace(v_customer.cep,'[^0-9]','','g'),
      'email', v_customer.email,
      'telefone', regexp_replace(v_customer.telefone,'[^0-9]','','g')
    ),
    'servico', jsonb_build_object(
      'valor', v_charge.valor,
      'descricao', v_charge.descricao,
      'itemListaServico', split_part(v_cfg->>'itemListaServico',' ',1),
      'codigoTributacaoMunicipio', v_cfg->>'codigoServico',
      'codigoCnae', v_cfg->>'codigoCnae',
      'aliquotaIss', v_cfg->>'aliquotaIss',
      'issRetido', left(v_cfg->>'issRetido',1),
      'exigibilidadeIss', left(v_cfg->>'naturezaOperacao',1),
      'regimeEspecial', left(v_cfg->>'regimeEspecial',1),
      'incentivoFiscal', left(v_cfg->>'incentivadorCultural',1),
      'codigoMunicipio', '2802908'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_emissao_nfse_webiss(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_emissao_nfse_webiss(uuid, uuid)
  TO service_role;

COMMIT;
