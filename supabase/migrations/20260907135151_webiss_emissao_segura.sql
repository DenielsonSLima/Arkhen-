-- Snapshot sem segredos, exclusao mutua e reconciliacao por RPS. Nao transmite notas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE app_private.webiss_emissoes (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cobranca_id uuid NOT NULL REFERENCES public.financeiro_cobrancas(id),
  ambiente text NOT NULL CHECK (ambiente IN ('homologacao','producao')),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  snapshot jsonb NOT NULL,
  tentativa_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('processando','rejeitada','incerta','falha_pre_envio','confirmada')),
  lease_ate timestamptz,
  numero_nfse text,
  resultado jsonb,
  mensagem text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cobranca_id, ambiente)
);
ALTER TABLE app_private.webiss_emissoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.webiss_emissoes FROM PUBLIC, anon, authenticated;

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
  v_attempt app_private.webiss_emissoes;
  v_snapshot jsonb;
  v_token uuid := gen_random_uuid();
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
      'nfseId', v_charge.nfse_id, 'ambiente', 'producao',
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

  v_ambiente := public.normalize_fiscal_environment(v_config.ambiente);
  SELECT * INTO v_attempt FROM app_private.webiss_emissoes
  WHERE cobranca_id = v_charge.id AND ambiente = v_ambiente FOR UPDATE;
  IF FOUND AND v_attempt.status = 'confirmada' THEN
    RETURN jsonb_build_object('jaEmitida', true, 'nfseId', v_attempt.numero_nfse,
      'ambiente', v_ambiente, 'cobrancaId', v_charge.id);
  END IF;
  IF v_attempt.status = 'processando' AND v_attempt.lease_ate > now() THEN
    RAISE EXCEPTION 'Ja existe uma tentativa WebISS em andamento. Aguarde para consultar o RPS.';
  END IF;
  IF v_attempt.cobranca_id IS NOT NULL AND v_attempt.status <> 'falha_pre_envio' THEN
    UPDATE app_private.webiss_emissoes SET tentativa_id = v_token,
      status = 'processando', lease_ate = now() + interval '90 seconds', updated_at = now()
    WHERE cobranca_id = v_charge.id AND ambiente = v_ambiente;
    SELECT * INTO v_config FROM public.configuracoes_integracao_fiscal
    WHERE id = v_attempt.fiscal_config_id AND empresa_id = v_empresa_id;
    RETURN v_attempt.snapshot || jsonb_build_object('tentativaId', v_token,
      'reconciliarPrimeiro', true,
      'certificadoBase64', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_arquivo_secret_id),
      'certificadoSenha', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_senha_secret_id));
  END IF;
  IF EXISTS (SELECT 1 FROM app_private.webiss_emissoes
    WHERE cobranca_id = v_charge.id AND ambiente <> v_ambiente AND status NOT IN ('confirmada', 'falha_pre_envio')) THEN
    RAISE EXCEPTION 'Consulte e resolva a tentativa anterior antes de mudar o ambiente fiscal.';
  END IF;
  IF v_charge.nfse_rps_numero IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app_private.webiss_emissoes WHERE cobranca_id = v_charge.id
  ) THEN
    RAISE EXCEPTION 'RPS legado sem contexto preservado. Reconcilie no portal WebISS antes de emitir.';
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

  IF coalesce(v_cfg->>'optanteSimplesNacional', '') NOT IN ('1', '2') THEN
    RAISE EXCEPTION 'Informe explicitamente se o prestador e optante pelo Simples Nacional.';
  END IF;
  IF left(v_cfg->>'issRetido',1) = '1' AND coalesce(v_cfg->>'responsavelRetencao','') NOT IN ('1','2') THEN
    RAISE EXCEPTION 'Informe o responsavel pela retencao do ISS.';
  END IF;
  IF v_charge.valor IS NULL OR v_charge.valor <= 0 THEN
    RAISE EXCEPTION 'Valor do servico deve ser maior que zero.';
  END IF;
  IF v_config.certificado_arquivo_secret_id IS NULL OR v_config.certificado_senha_secret_id IS NULL THEN
    RAISE EXCEPTION 'Configure o certificado A1 antes de reservar o RPS.';
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
        nfse_status = CASE WHEN v_ambiente = 'producao' THEN 'processando' ELSE nfse_status END,
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
  v_snapshot := jsonb_build_object(
    'jaEmitida', false,
    'fiscalConfigId', v_config.id,
    'cobrancaId', v_charge.id,
    'ambiente', v_ambiente,
    'endpoint', CASE
      WHEN v_ambiente = 'producao' THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx'
      ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx'
    END,
    'rps', jsonb_build_object(
      'numero', v_rps,
      'serie', coalesce(NULLIF(v_cfg->>'serieRps',''),'A'),
      'tipo', '1',
      'data', coalesce(v_attempt.snapshot #>> '{rps,data}', (now() AT TIME ZONE 'America/Maceio')::date::text)
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
      'optanteSimplesNacional', v_cfg->>'optanteSimplesNacional',
      'responsavelRetencao', v_cfg->>'responsavelRetencao',
      'issRetido', left(v_cfg->>'issRetido',1),
      'exigibilidadeIss', left(v_cfg->>'naturezaOperacao',1),
      'regimeEspecial', left(v_cfg->>'regimeEspecial',1),
      'incentivoFiscal', left(v_cfg->>'incentivadorCultural',1),
      'codigoMunicipio', '2802908'
    )
  );
  INSERT INTO app_private.webiss_emissoes
    (empresa_id, cobranca_id, ambiente, fiscal_config_id, snapshot, tentativa_id, status, lease_ate)
  VALUES (v_empresa_id, v_charge.id, v_ambiente, v_config.id, v_snapshot, v_token, 'processando', now() + interval '90 seconds')
  ON CONFLICT (cobranca_id, ambiente) DO UPDATE SET snapshot = excluded.snapshot,
    fiscal_config_id = excluded.fiscal_config_id, resultado = NULL, mensagem = NULL,
    tentativa_id = excluded.tentativa_id, status = excluded.status, lease_ate = excluded.lease_ate, updated_at = now();
  RETURN v_snapshot || jsonb_build_object('tentativaId', v_token, 'reconciliarPrimeiro', false,
    'certificadoBase64', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_arquivo_secret_id),
    'certificadoSenha', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_senha_secret_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_consulta_nfse_webiss(p_user_id uuid, p_cobranca_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp AS $$
DECLARE
  v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_attempt app_private.webiss_emissoes;
  v_config public.configuracoes_integracao_fiscal;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT a.* INTO v_attempt FROM app_private.webiss_emissoes a
  WHERE a.cobranca_id = p_cobranca_id AND a.empresa_id = v_empresa
  ORDER BY (a.status <> 'confirmada') DESC, a.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nao existe RPS com contexto preservado para consulta.'; END IF;
  SELECT * INTO v_config FROM public.configuracoes_integracao_fiscal
  WHERE id = v_attempt.fiscal_config_id AND empresa_id = v_empresa;
  RETURN v_attempt.snapshot || jsonb_build_object('tentativaId', v_attempt.tentativa_id,
    'reconciliarPrimeiro', true, 'jaEmitida', v_attempt.status = 'confirmada', 'nfseId', v_attempt.numero_nfse,
    'certificadoBase64', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_arquivo_secret_id),
    'certificadoSenha', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.certificado_senha_secret_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_tentativa_nfse_webiss(
  p_user_id uuid, p_cobranca_id uuid, p_tentativa_id uuid, p_status text, p_mensagem text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_attempt app_private.webiss_emissoes;
BEGIN
  IF v_empresa IS NULL OR p_status IS NULL OR p_status NOT IN ('rejeitada','incerta','falha_pre_envio') THEN
    RAISE EXCEPTION 'Finalizacao fiscal invalida.';
  END IF;
  -- Mesmo ordenamento de locks usado no preparo e na confirmacao.
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id = p_cobranca_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fiscal fora do tenant.'; END IF;
  UPDATE app_private.webiss_emissoes SET status = p_status, lease_ate = NULL,
    mensagem = left(p_mensagem, 1000), updated_at = now()
  WHERE cobranca_id = p_cobranca_id AND empresa_id = v_empresa AND tentativa_id = p_tentativa_id
    AND status = 'processando' RETURNING * INTO v_attempt;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_attempt.ambiente = 'producao' THEN
    UPDATE public.financeiro_cobrancas SET nfse_status = p_status, updated_at = now()
    WHERE id = p_cobranca_id AND empresa_id = v_empresa AND nfse_id IS NULL;
  END IF;
  INSERT INTO public.configuracoes_integracao_fiscal_logs
    (empresa_id, fiscal_config_id, usuario_id, operacao, status, mensagem, detalhes)
  VALUES (v_empresa, v_attempt.fiscal_config_id, p_user_id, 'Emissão',
    CASE WHEN p_status = 'incerta' THEN 'Pendente' ELSE 'Erro' END, left(p_mensagem,1000),
    jsonb_build_object('ambiente',v_attempt.ambiente,'tentativaId',p_tentativa_id,'cobrancaId',p_cobranca_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_emissao_nfse_webiss(
  p_user_id uuid, p_cobranca_id uuid, p_nfse_id text, p_protocolo text, p_payload jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_attempt app_private.webiss_emissoes;
  v_charge public.financeiro_cobrancas;
  v_numero text := trim(p_nfse_id);
BEGIN
  IF v_empresa IS NULL OR coalesce(v_numero,'') !~ '^[0-9]{1,15}$' THEN
    RAISE EXCEPTION 'Confirmacao fiscal invalida.';
  END IF;
  SELECT * INTO v_charge FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fiscal fora do tenant.'; END IF;
  SELECT * INTO v_attempt FROM app_private.webiss_emissoes
  WHERE cobranca_id = p_cobranca_id AND empresa_id = v_empresa
    AND tentativa_id = (p_payload->>'tentativaId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa fiscal ausente ou substituida; consulte o RPS.'; END IF;
  IF v_attempt.status = 'confirmada' THEN
    IF v_attempt.numero_nfse <> v_numero THEN RAISE EXCEPTION 'Numero fiscal divergente da confirmacao anterior.'; END IF;
    RETURN v_attempt.numero_nfse;
  END IF;
  IF v_attempt.ambiente = 'producao' THEN
    IF v_charge.nfse_id IS NOT NULL AND v_charge.nfse_id <> v_numero THEN
      RAISE EXCEPTION 'Cobranca ja possui outra NFS-e.';
    END IF;
    UPDATE public.financeiro_cobrancas SET nfse_id = v_numero, nfse_status = 'emitida',
      nfse_payload = p_payload, nfse_emitida_em = now(), updated_at = now()
    WHERE id = p_cobranca_id AND empresa_id = v_empresa;
    UPDATE public.configuracoes_integracao_fiscal
    SET configuracao = jsonb_set(coalesce(configuracao,'{}'::jsonb),'{ultimoNumeroNfse}',to_jsonb(v_numero),true),
      stats = coalesce(stats,'{}'::jsonb) || jsonb_build_object(
        'emitidas',coalesce((stats->>'emitidas')::integer,0)+1,'ultimaEmissao',now(),
        'ultimoProtocolo',coalesce(NULLIF(p_protocolo,''),'-')), updated_at = now()
    WHERE id = v_attempt.fiscal_config_id AND empresa_id = v_empresa;
  END IF;
  UPDATE app_private.webiss_emissoes SET status = 'confirmada', lease_ate = NULL,
    numero_nfse = v_numero, resultado = p_payload, updated_at = now()
  WHERE cobranca_id = p_cobranca_id AND ambiente = v_attempt.ambiente;
  INSERT INTO public.configuracoes_integracao_fiscal_logs
    (empresa_id,fiscal_config_id,usuario_id,operacao,numero_nfse,protocolo,status,mensagem,detalhes)
  VALUES (v_empresa,v_attempt.fiscal_config_id,p_user_id,'Emissão',v_numero,
    coalesce(NULLIF(p_protocolo,''),'-'),'Sucesso',
    CASE WHEN v_attempt.ambiente = 'homologacao' THEN 'NFS-e de homologacao confirmada. Sem valor fiscal.'
      ELSE 'NFS-e confirmada pelo WebISS Itabaiana/SE.' END,
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('ambiente',v_attempt.ambiente));
  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_emissao_nfse_webiss(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_consulta_nfse_webiss(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalizar_tentativa_nfse_webiss(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_emissao_nfse_webiss(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_consulta_nfse_webiss(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_tentativa_nfse_webiss(uuid,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid,uuid,text,text,jsonb) TO service_role;
COMMIT;
