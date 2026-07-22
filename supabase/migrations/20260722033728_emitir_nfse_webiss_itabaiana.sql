ALTER TABLE public.financeiro_cobrancas
  ADD COLUMN IF NOT EXISTS nfse_rps_numero bigint,
  ADD COLUMN IF NOT EXISTS nfse_emitida_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_nfse_rps_empresa_idx
  ON public.financeiro_cobrancas (empresa_id, nfse_rps_numero)
  WHERE nfse_rps_numero IS NOT NULL;

CREATE OR REPLACE FUNCTION public.preparar_emissao_nfse_webiss(
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
  v_config public.configuracoes_integracao_fiscal;
  v_company public.configuracoes_empresa;
  v_customer public.clientes;
  v_rps bigint;
  v_cfg jsonb;
  v_ambiente text;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO v_charge FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fiscal fora do tenant.'; END IF;
  IF v_charge.status = 'Cancelado' THEN RAISE EXCEPTION 'Nao e possivel emitir NFS-e de cobranca cancelada.'; END IF;
  IF v_charge.nfse_id IS NOT NULL THEN
    RETURN jsonb_build_object('jaEmitida', true, 'nfseId', v_charge.nfse_id, 'cobrancaId', v_charge.id);
  END IF;

  SELECT * INTO v_config FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id AND c.cliente_id IS NULL AND c.ativo
    AND c.uf = 'SE' AND lower(trim(c.municipio)) = 'itabaiana' AND lower(c.provedor) = 'webiss'
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ative a integracao WebISS Itabaiana para o escritorio.'; END IF;
  SELECT * INTO v_company FROM public.configuracoes_empresa WHERE empresa_id = v_empresa_id;
  SELECT * INTO v_customer FROM public.clientes
  WHERE id = v_charge.cliente_empresa_id AND empresa_id = v_empresa_id;
  IF v_company.id IS NULL OR v_customer.id IS NULL THEN RAISE EXCEPTION 'Prestador ou tomador nao configurado.'; END IF;

  v_cfg := coalesce(v_config.configuracao, '{}'::jsonb);
  IF length(regexp_replace(v_company.cnpj, '[^0-9]', '', 'g')) <> 14 THEN RAISE EXCEPTION 'CNPJ do prestador invalido.'; END IF;
  IF length(regexp_replace(v_customer.cnpj, '[^0-9]', '', 'g')) NOT IN (11, 14) THEN RAISE EXCEPTION 'CPF/CNPJ do tomador invalido.'; END IF;
  IF NULLIF(v_cfg->>'inscricaoMunicipal','') IS NULL THEN RAISE EXCEPTION 'Inscricao Municipal do prestador obrigatoria.'; END IF;
  IF NULLIF(v_cfg->>'codigoCnae','') IS NULL THEN RAISE EXCEPTION 'CNAE do servico obrigatorio.'; END IF;
  IF NULLIF(v_cfg->>'codigoServico','') IS NULL OR NULLIF(v_cfg->>'itemListaServico','') IS NULL THEN
    RAISE EXCEPTION 'Codigo e item da lista de servico obrigatorios.';
  END IF;

  IF v_charge.nfse_rps_numero IS NULL THEN
    v_rps := greatest(coalesce(NULLIF(regexp_replace(v_cfg->>'proximoNumeroRps','[^0-9]','','g'),'')::bigint, 1), 1);
    UPDATE public.financeiro_cobrancas SET nfse_rps_numero = v_rps, nfse_status = 'processando', updated_at = now()
    WHERE id = v_charge.id;
    v_cfg := jsonb_set(jsonb_set(v_cfg, '{ultimoNumeroRps}', to_jsonb(v_rps::text), true),
      '{proximoNumeroRps}', to_jsonb((v_rps + 1)::text), true);
    UPDATE public.configuracoes_integracao_fiscal SET configuracao = v_cfg, updated_at = now() WHERE id = v_config.id;
  ELSE
    v_rps := v_charge.nfse_rps_numero;
  END IF;
  v_ambiente := public.normalize_fiscal_environment(v_config.ambiente);

  RETURN jsonb_build_object(
    'jaEmitida', false, 'fiscalConfigId', v_config.id, 'cobrancaId', v_charge.id,
    'ambiente', v_ambiente,
    'endpoint', CASE WHEN v_ambiente = 'producao' THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx'
      ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx' END,
    'certificadoBase64', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_arquivo_secret_id),
    'certificadoSenha', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_senha_secret_id),
    'rps', jsonb_build_object('numero', v_rps, 'serie', coalesce(NULLIF(v_cfg->>'serieRps',''),'A'), 'data', CURRENT_DATE),
    'prestador', jsonb_build_object('cnpj', regexp_replace(v_company.cnpj,'[^0-9]','','g'),
      'inscricaoMunicipal', v_cfg->>'inscricaoMunicipal'),
    'tomador', jsonb_build_object('documento', regexp_replace(v_customer.cnpj,'[^0-9]','','g'),
      'razaoSocial', coalesce(NULLIF(v_customer.razao_social,''), NULLIF(v_customer.nome,'')),
      'endereco', v_customer.endereco, 'numero', 'S/N', 'bairro', v_customer.bairro,
      'cidade', v_customer.cidade, 'uf', upper(v_customer.uf), 'cep', regexp_replace(v_customer.cep,'[^0-9]','','g'),
      'email', v_customer.email, 'telefone', regexp_replace(v_customer.telefone,'[^0-9]','','g')),
    'servico', jsonb_build_object('valor', v_charge.valor, 'descricao', v_charge.descricao,
      'itemListaServico', split_part(v_cfg->>'itemListaServico',' ',1),
      'codigoTributacaoMunicipio', v_cfg->>'codigoServico', 'codigoCnae', v_cfg->>'codigoCnae',
      'aliquotaIss', v_cfg->>'aliquotaIss', 'issRetido', left(v_cfg->>'issRetido',1),
      'exigibilidadeIss', left(v_cfg->>'naturezaOperacao',1), 'regimeEspecial', left(v_cfg->>'regimeEspecial',1),
      'incentivoFiscal', left(v_cfg->>'incentivadorCultural',1), 'codigoMunicipio', '2802908')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_emissao_nfse_webiss(
  p_user_id uuid, p_cobranca_id uuid, p_nfse_id text, p_protocolo text, p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_charge public.financeiro_cobrancas;
  v_config public.configuracoes_integracao_fiscal;
BEGIN
  IF v_empresa_id IS NULL OR NULLIF(trim(p_nfse_id),'') IS NULL THEN RAISE EXCEPTION 'Confirmacao fiscal invalida.'; END IF;
  UPDATE public.financeiro_cobrancas SET nfse_id = left(trim(p_nfse_id),100), nfse_status = 'emitida',
    nfse_payload = coalesce(p_payload,'{}'::jsonb), nfse_emitida_em = now(), updated_at = now()
  WHERE id = p_cobranca_id AND empresa_id = v_empresa_id AND nfse_rps_numero IS NOT NULL
  RETURNING * INTO v_charge;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fiscal nao encontrada.'; END IF;
  SELECT * INTO v_config FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id AND c.cliente_id IS NULL AND c.ativo
    AND c.uf='SE' AND lower(trim(c.municipio))='itabaiana' AND lower(c.provedor)='webiss' LIMIT 1;
  UPDATE public.configuracoes_integracao_fiscal
  SET configuracao = jsonb_set(configuracao,'{ultimoNumeroNfse}',to_jsonb(trim(p_nfse_id)),true),
      stats = coalesce(stats,'{}'::jsonb) || jsonb_build_object(
        'emitidas', coalesce((stats->>'emitidas')::integer,0)+1, 'ultimaEmissao', now(),
        'ultimoProtocolo', coalesce(NULLIF(p_protocolo,''),'-'), 'proximoNumeroNfse', trim(p_nfse_id)),
      updated_at = now()
  WHERE id = v_config.id;
  INSERT INTO public.configuracoes_integracao_fiscal_logs
    (empresa_id,fiscal_config_id,usuario_id,operacao,numero_nfse,protocolo,status,mensagem,detalhes)
  VALUES (v_empresa_id,v_config.id,p_user_id,'Emissão',trim(p_nfse_id),coalesce(NULLIF(p_protocolo,''),'-'),
    'Sucesso','NFS-e emitida pelo WebISS Itabaiana/SE.',coalesce(p_payload,'{}'::jsonb));
  RETURN trim(p_nfse_id);
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_emissao_nfse_webiss(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_emissao_nfse_webiss(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid, uuid, text, text, jsonb) TO service_role;
