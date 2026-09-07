-- Parametros explicitamente informados e CNPJ real para verificar o certificado.
BEGIN;
CREATE OR REPLACE FUNCTION public.salvar_parametros_webiss_itabaiana(p_cliente_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_empresa_id uuid := public.current_empresa_id(); v_row public.configuracoes_integracao_fiscal;
BEGIN
  IF coalesce(p_payload->>'optanteSimplesNacional','') NOT IN ('','1','2')
    OR coalesce(p_payload->>'responsavelRetencao','') NOT IN ('','1','2') THEN
    RAISE EXCEPTION 'Parametros de Simples Nacional ou retencao invalidos.';
  END IF;
  IF v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Usuario sem permissao para configurar o WebISS.';
  END IF;
  UPDATE public.configuracoes_integracao_fiscal c
  SET configuracao = coalesce(c.configuracao, '{}'::jsonb) || jsonb_build_object(
      'inscricaoMunicipal', left(regexp_replace(coalesce(p_payload->>'inscricaoMunicipal',''), '[^0-9A-Za-z]', '', 'g'), 30),
      'optanteSimplesNacional', coalesce(p_payload->>'optanteSimplesNacional',''),
      'responsavelRetencao', coalesce(p_payload->>'responsavelRetencao',''),
      'codigoCnae', left(regexp_replace(coalesce(p_payload->>'codigoCnae',''), '[^0-9]', '', 'g'), 10)
    ), updated_at = now()
  WHERE c.empresa_id = v_empresa_id AND c.cliente_id IS NOT DISTINCT FROM p_cliente_id
    AND c.uf = 'SE' AND lower(trim(c.municipio)) = 'itabaiana' AND lower(c.provedor) = 'webiss'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuracao WebISS Itabaiana nao encontrada.'; END IF;
  RETURN public.format_configuracao_fiscal_response(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_fiscal_config(p_config jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'usuarioWebService', coalesce(p_config->>'usuarioWebService', ''),
    'senhaWebService', '',
    'senhaWebServiceConfigured', NULLIF(p_config->>'webservice_senha_secret_id', '') IS NOT NULL,
    'serieRps', coalesce(p_config->>'serieRps', 'A'),
    'ultimoNumeroRps', coalesce(p_config->>'ultimoNumeroRps', '0'),
    'proximoNumeroRps', coalesce(p_config->>'proximoNumeroRps', '1'),
    'ultimoNumeroNfse', coalesce(p_config->>'ultimoNumeroNfse', '0'),
    'inscricaoMunicipal', coalesce(p_config->>'inscricaoMunicipal', ''),
    'optanteSimplesNacional', coalesce(p_config->>'optanteSimplesNacional', ''),
    'responsavelRetencao', coalesce(p_config->>'responsavelRetencao', ''),
    'codigoCnae', coalesce(p_config->>'codigoCnae', ''),
    'codigoServico', coalesce(p_config->>'codigoServico', ''),
    'itemListaServico', coalesce(p_config->>'itemListaServico', ''),
    'aliquotaIss', coalesce(p_config->>'aliquotaIss', ''),
    'naturezaOperacao', coalesce(p_config->>'naturezaOperacao', ''),
    'regimeEspecial', coalesce(p_config->>'regimeEspecial', ''),
    'incentivadorCultural', coalesce(p_config->>'incentivadorCultural', ''),
    'issRetido', coalesce(p_config->>'issRetido', '')
  )
$$;

CREATE OR REPLACE FUNCTION public.preparar_configuracao_webiss_itabaiana(
  p_user_id uuid,
  p_cliente_id uuid,
  p_ambiente text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_row public.configuracoes_integracao_fiscal;
  v_ambiente text := public.normalize_fiscal_environment(p_ambiente);
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND empresa_id = v_empresa_id
  ) THEN RAISE EXCEPTION 'Cliente fiscal fora do tenant.'; END IF;

  SELECT * INTO v_row
  FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id
    AND c.cliente_id IS NOT DISTINCT FROM p_cliente_id
    AND c.uf = 'SE'
    AND lower(trim(c.municipio)) = 'itabaiana'
    AND lower(c.provedor) = 'webiss'
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configure e salve o WebISS de Itabaiana antes do teste.'; END IF;
  IF NOT v_row.ativo THEN RAISE EXCEPTION 'Integracao fiscal desativada.'; END IF;

  RETURN jsonb_build_object(
    'prestador', jsonb_build_object('cnpj', CASE WHEN p_cliente_id IS NULL
      THEN (SELECT cnpj FROM public.configuracoes_empresa WHERE empresa_id = v_empresa_id)
      ELSE (SELECT cnpj FROM public.clientes WHERE id = p_cliente_id AND empresa_id = v_empresa_id) END),
    'fiscalConfigId', v_row.id,
    'empresaId', v_empresa_id,
    'clienteId', v_row.cliente_id,
    'uf', v_row.uf,
    'municipio', v_row.municipio,
    'provedor', v_row.provedor,
    'ambiente', v_ambiente,
    'endpoint', CASE WHEN v_ambiente = 'producao'
      THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx'
      ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx' END,
    'wsdlUrl', CASE WHEN v_ambiente = 'producao'
      THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx?WSDL'
      ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx?WSDL' END,
    'usuarioWebService', coalesce(v_row.configuracao->>'usuarioWebService', ''),
    'senhaWebService', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_row.webservice_senha_secret_id),
    'certificadoBase64', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_row.certificado_arquivo_secret_id),
    'certificadoSenha', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_row.certificado_senha_secret_id),
    'configuracao', v_row.configuracao,
    'certificadoMetadata', v_row.certificado_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_configuracao_webiss_itabaiana(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_configuracao_webiss_itabaiana(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.salvar_parametros_webiss_itabaiana(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_parametros_webiss_itabaiana(uuid,jsonb) TO authenticated;

COMMIT;
