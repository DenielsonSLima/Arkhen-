-- Integracao Fiscal NFS-e segura.
-- Dados sensiveis ficam no Vault; o frontend recebe somente metadados e flags.

CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

ALTER TABLE public.configuracoes_integracao_fiscal
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS webservice_senha_secret_id uuid,
  ADD COLUMN IF NOT EXISTS certificado_arquivo_secret_id uuid,
  ADD COLUMN IF NOT EXISTS certificado_senha_secret_id uuid,
  ADD COLUMN IF NOT EXISTS certificado_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.configuracoes_integracao_fiscal
  DROP CONSTRAINT IF EXISTS configuracoes_integracao_fiscal_empresa_id_uf_municipio_provedor_key;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_integracao_fiscal_contexto_idx
  ON public.configuracoes_integracao_fiscal (
    empresa_id,
    coalesce(cliente_id, '00000000-0000-0000-0000-000000000000'::uuid),
    uf,
    municipio,
    provedor
  );

CREATE INDEX IF NOT EXISTS idx_configuracoes_integracao_fiscal_empresa_cliente
  ON public.configuracoes_integracao_fiscal (empresa_id, cliente_id, uf, municipio);

CREATE TABLE IF NOT EXISTS public.configuracoes_integracao_fiscal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fiscal_config_id uuid REFERENCES public.configuracoes_integracao_fiscal(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operacao varchar(30) NOT NULL CHECK (operacao IN ('Emissão', 'Cancelamento', 'Consulta', 'Sincronização')),
  numero_nfse text NOT NULL DEFAULT '-',
  protocolo text NOT NULL DEFAULT '-',
  status varchar(20) NOT NULL CHECK (status IN ('Sucesso', 'Erro', 'Pendente')),
  mensagem text NOT NULL DEFAULT '',
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_integracao_fiscal_logs_contexto
  ON public.configuracoes_integracao_fiscal_logs (empresa_id, fiscal_config_id, created_at DESC);

ALTER TABLE public.configuracoes_integracao_fiscal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_integracao_fiscal_logs_select_policy ON public.configuracoes_integracao_fiscal_logs;
CREATE POLICY configuracoes_integracao_fiscal_logs_select_policy ON public.configuracoes_integracao_fiscal_logs
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_integracao_fiscal_logs_insert_policy ON public.configuracoes_integracao_fiscal_logs;
CREATE POLICY configuracoes_integracao_fiscal_logs_insert_policy ON public.configuracoes_integracao_fiscal_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE OR REPLACE FUNCTION public.normalize_fiscal_environment(p_ambiente text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_ambiente, '')) IN ('producao', 'production', 'prod') THEN 'producao'
    ELSE 'homologacao'
  END
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
    'ultimoNumeroRps', coalesce(p_config->>'ultimoNumeroRps', ''),
    'proximoNumeroRps', coalesce(p_config->>'proximoNumeroRps', ''),
    'ultimoNumeroNfse', coalesce(p_config->>'ultimoNumeroNfse', ''),
    'codigoServico', coalesce(p_config->>'codigoServico', ''),
    'itemListaServico', coalesce(p_config->>'itemListaServico', ''),
    'aliquotaIss', coalesce(p_config->>'aliquotaIss', ''),
    'naturezaOperacao', coalesce(p_config->>'naturezaOperacao', ''),
    'regimeEspecial', coalesce(p_config->>'regimeEspecial', ''),
    'incentivadorCultural', coalesce(p_config->>'incentivadorCultural', ''),
    'issRetido', coalesce(p_config->>'issRetido', '')
  )
$$;

CREATE OR REPLACE FUNCTION public.format_configuracao_fiscal_response(
  p_row public.configuracoes_integracao_fiscal
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa public.configuracoes_empresa;
  v_cliente public.clientes;
  v_context_company_id text;
  v_context_company_name text;
  v_base_config jsonb;
  v_history jsonb := '[]'::jsonb;
BEGIN
  SELECT *
    INTO v_empresa
  FROM public.configuracoes_empresa ce
  WHERE ce.empresa_id = p_row.empresa_id
  LIMIT 1;

  IF p_row.cliente_id IS NOT NULL THEN
    SELECT *
      INTO v_cliente
    FROM public.clientes c
    WHERE c.id = p_row.cliente_id
      AND c.empresa_id = p_row.empresa_id
    LIMIT 1;
  END IF;

  v_context_company_id := coalesce(p_row.cliente_id::text, 'office');
  v_context_company_name := coalesce(
    NULLIF(v_cliente.nome, ''),
    NULLIF(v_cliente.razao_social, ''),
    NULLIF(v_empresa.nome_fantasia, ''),
    NULLIF(v_empresa.razao_social, ''),
    'Escritório (contabilidade)'
  );

  v_base_config := public.safe_fiscal_config(
    coalesce(p_row.configuracao, '{}'::jsonb)
    || jsonb_build_object('webservice_senha_secret_id', p_row.webservice_senha_secret_id)
  );

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'data', to_char(l.created_at AT TIME ZONE 'America/Maceio', 'YYYY-MM-DD'),
    'hora', to_char(l.created_at AT TIME ZONE 'America/Maceio', 'HH24:MI:SS'),
    'operacao', l.operacao,
    'numeroNfse', l.numero_nfse,
    'protocolo', l.protocolo,
    'status', l.status,
    'usuario', coalesce(p.nome, 'Sistema'),
    'mensagemPrefeitura', l.mensagem
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
    INTO v_history
  FROM public.configuracoes_integracao_fiscal_logs l
  LEFT JOIN public.perfis p
    ON p.user_id = l.usuario_id
   AND p.empresa_id = l.empresa_id
  WHERE l.fiscal_config_id = p_row.id;

  RETURN jsonb_build_object(
    'context', jsonb_build_object(
      'key', v_context_company_id || '__' || p_row.uf || '__' || regexp_replace(lower(p_row.municipio), '[[:space:]]+', '-', 'g'),
      'companyId', v_context_company_id,
      'companyName', v_context_company_name,
      'uf', p_row.uf,
      'municipio', p_row.municipio,
      'isActive', p_row.ativo
    ),
    'config', v_base_config || p_row.certificado_metadata || jsonb_build_object(
      'ambiente', p_row.ambiente,
      'provedor', p_row.provedor,
      'certificadoSenha', '',
      'certificadoSenhaConfigured', p_row.certificado_senha_secret_id IS NOT NULL,
      'certificadoArquivoConfigured', p_row.certificado_arquivo_secret_id IS NOT NULL
    ),
    'stats', coalesce(p_row.stats, '{}'::jsonb),
    'history', v_history
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_configuracoes_fiscais()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  SELECT coalesce(jsonb_agg(public.format_configuracao_fiscal_response(c) ORDER BY c.uf, c.municipio), '[]'::jsonb)
    INTO v_result
  FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_configuracao_fiscal(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_id', '')::uuid;
  v_uf text := upper(coalesce(NULLIF(p_payload->>'uf', ''), 'NA'));
  v_municipio text := coalesce(NULLIF(p_payload->>'municipio', ''), 'Não informado');
  v_provedor text := coalesce(NULLIF(p_payload->>'provedor', ''), 'WebISS');
  v_ambiente text := public.normalize_fiscal_environment(p_payload->>'ambiente');
  v_current public.configuracoes_integracao_fiscal;
  v_config jsonb;
  v_metadata jsonb;
  v_password text := p_payload->>'senhaWebService';
  v_cert_password text := p_payload->>'certificadoSenha';
  v_secret_prefix text;
  v_webservice_secret_id uuid;
  v_cert_senha_secret_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = v_cliente_id AND c.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Cliente nao pertence a empresa atual.';
  END IF;

  SELECT *
    INTO v_current
  FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id
    AND c.cliente_id IS NOT DISTINCT FROM v_cliente_id
    AND c.uf = v_uf
    AND c.municipio = v_municipio
    AND c.provedor = v_provedor
  LIMIT 1;

  v_secret_prefix := 'empresa_' || v_empresa_id::text || '_fiscal_' || coalesce(v_cliente_id::text, 'office') || '_' || v_uf || '_' || encode(digest(v_municipio || v_provedor, 'sha256'), 'hex');

  v_webservice_secret_id := public.upsert_vault_secret(
    v_current.webservice_senha_secret_id,
    v_password,
    v_secret_prefix || '_webservice_senha',
    'Senha WebService NFS-e ' || v_municipio || '/' || v_uf
  );

  v_cert_senha_secret_id := public.upsert_vault_secret(
    v_current.certificado_senha_secret_id,
    v_cert_password,
    v_secret_prefix || '_certificado_senha',
    'Senha certificado A1 NFS-e ' || v_municipio || '/' || v_uf
  );

  v_config := jsonb_build_object(
    'usuarioWebService', coalesce(p_payload->>'usuarioWebService', v_current.configuracao->>'usuarioWebService', ''),
    'serieRps', coalesce(p_payload->>'serieRps', v_current.configuracao->>'serieRps', 'A'),
    'ultimoNumeroRps', coalesce(p_payload->>'ultimoNumeroRps', v_current.configuracao->>'ultimoNumeroRps', ''),
    'proximoNumeroRps', coalesce(p_payload->>'proximoNumeroRps', v_current.configuracao->>'proximoNumeroRps', ''),
    'ultimoNumeroNfse', coalesce(p_payload->>'ultimoNumeroNfse', v_current.configuracao->>'ultimoNumeroNfse', ''),
    'codigoServico', coalesce(p_payload->>'codigoServico', v_current.configuracao->>'codigoServico', ''),
    'itemListaServico', coalesce(p_payload->>'itemListaServico', v_current.configuracao->>'itemListaServico', ''),
    'aliquotaIss', coalesce(p_payload->>'aliquotaIss', v_current.configuracao->>'aliquotaIss', ''),
    'naturezaOperacao', coalesce(p_payload->>'naturezaOperacao', v_current.configuracao->>'naturezaOperacao', ''),
    'regimeEspecial', coalesce(p_payload->>'regimeEspecial', v_current.configuracao->>'regimeEspecial', ''),
    'incentivadorCultural', coalesce(p_payload->>'incentivadorCultural', v_current.configuracao->>'incentivadorCultural', ''),
    'issRetido', coalesce(p_payload->>'issRetido', v_current.configuracao->>'issRetido', '')
  );

  v_metadata := coalesce(v_current.certificado_metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'certificadoNome', nullif(p_payload->>'certificadoNome', ''),
    'certificadoEmpresa', nullif(p_payload->>'certificadoEmpresa', ''),
    'certificadoCNPJ', nullif(p_payload->>'certificadoCNPJ', ''),
    'certificadoEmitidoEm', nullif(p_payload->>'certificadoEmitidoEm', ''),
    'certificadoValidade', nullif(p_payload->>'certificadoValidade', ''),
    'certificadoDiasRestantes', nullif(p_payload->>'certificadoDiasRestantes', '')::integer
  ));

  INSERT INTO public.configuracoes_integracao_fiscal (
    empresa_id, cliente_id, uf, municipio, provedor, ambiente, ativo, configuracao,
    webservice_senha_secret_id, certificado_senha_secret_id, certificado_metadata, stats
  )
  VALUES (
    v_empresa_id, v_cliente_id, v_uf, v_municipio, v_provedor, v_ambiente,
    coalesce((p_payload->>'ativo')::boolean, true), v_config,
    v_webservice_secret_id, v_cert_senha_secret_id, v_metadata, coalesce(v_current.stats, '{}'::jsonb)
  )
  ON CONFLICT (empresa_id, (coalesce(cliente_id, '00000000-0000-0000-0000-000000000000'::uuid)), uf, municipio, provedor)
  DO UPDATE SET
    ambiente = EXCLUDED.ambiente,
    ativo = EXCLUDED.ativo,
    configuracao = EXCLUDED.configuracao,
    webservice_senha_secret_id = EXCLUDED.webservice_senha_secret_id,
    certificado_senha_secret_id = EXCLUDED.certificado_senha_secret_id,
    certificado_metadata = EXCLUDED.certificado_metadata,
    updated_at = now()
  RETURNING * INTO v_current;

  INSERT INTO public.configuracoes_integracao_fiscal_logs (
    empresa_id, fiscal_config_id, cliente_id, usuario_id, operacao, protocolo, status, mensagem
  )
  VALUES (
    v_empresa_id, v_current.id, v_cliente_id, auth.uid(), 'Sincronização',
    'SAVE-' || right(extract(epoch from now())::bigint::text, 6),
    'Sucesso',
    'Configuração fiscal salva no Supabase com segredos protegidos no Vault.'
  );

  RETURN public.format_configuracao_fiscal_response(v_current);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_certificado_fiscal_edge(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_id', '')::uuid;
  v_uf text := upper(coalesce(NULLIF(p_payload->>'uf', ''), 'NA'));
  v_municipio text := coalesce(NULLIF(p_payload->>'municipio', ''), 'Não informado');
  v_provedor text := coalesce(NULLIF(p_payload->>'provedor', ''), 'WebISS');
  v_current public.configuracoes_integracao_fiscal;
  v_cert_secret_id uuid;
  v_cert_password_secret_id uuid;
  v_secret_prefix text;
  v_metadata jsonb;
BEGIN
  SELECT p.empresa_id
    INTO v_empresa_id
  FROM public.perfis p
  WHERE p.user_id = p_user_id
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = v_cliente_id AND c.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Cliente nao pertence a empresa atual.';
  END IF;

  SELECT *
    INTO v_current
  FROM public.configuracoes_integracao_fiscal c
  WHERE c.empresa_id = v_empresa_id
    AND c.cliente_id IS NOT DISTINCT FROM v_cliente_id
    AND c.uf = v_uf
    AND c.municipio = v_municipio
    AND c.provedor = v_provedor
  LIMIT 1;

  IF v_current.id IS NULL THEN
    INSERT INTO public.configuracoes_integracao_fiscal (
      empresa_id, cliente_id, uf, municipio, provedor, ambiente, ativo, configuracao
    )
    VALUES (
      v_empresa_id, v_cliente_id, v_uf, v_municipio, v_provedor,
      public.normalize_fiscal_environment(p_payload->>'ambiente'), true, '{}'::jsonb
    )
    RETURNING * INTO v_current;
  END IF;

  v_secret_prefix := 'empresa_' || v_empresa_id::text || '_fiscal_' || coalesce(v_cliente_id::text, 'office') || '_' || v_uf || '_' || encode(digest(v_municipio || v_provedor, 'sha256'), 'hex');

  v_cert_secret_id := public.upsert_vault_secret(
    v_current.certificado_arquivo_secret_id,
    p_payload->>'certificadoBase64',
    v_secret_prefix || '_certificado_arquivo',
    'Arquivo certificado A1 NFS-e ' || v_municipio || '/' || v_uf
  );

  v_cert_password_secret_id := public.upsert_vault_secret(
    v_current.certificado_senha_secret_id,
    p_payload->>'certificadoSenha',
    v_secret_prefix || '_certificado_senha',
    'Senha certificado A1 NFS-e ' || v_municipio || '/' || v_uf
  );

  v_metadata := coalesce(v_current.certificado_metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'certificadoNome', nullif(p_payload->>'certificadoNome', ''),
    'certificadoEmpresa', nullif(p_payload->>'certificadoEmpresa', ''),
    'certificadoCNPJ', nullif(p_payload->>'certificadoCNPJ', ''),
    'certificadoEmitidoEm', nullif(p_payload->>'certificadoEmitidoEm', ''),
    'certificadoValidade', nullif(p_payload->>'certificadoValidade', ''),
    'certificadoDiasRestantes', nullif(p_payload->>'certificadoDiasRestantes', '')::integer
  ));

  UPDATE public.configuracoes_integracao_fiscal
  SET certificado_arquivo_secret_id = v_cert_secret_id,
      certificado_senha_secret_id = v_cert_password_secret_id,
      certificado_metadata = v_metadata,
      updated_at = now()
  WHERE id = v_current.id
  RETURNING * INTO v_current;

  INSERT INTO public.configuracoes_integracao_fiscal_logs (
    empresa_id, fiscal_config_id, cliente_id, usuario_id, operacao, protocolo, status, mensagem
  )
  VALUES (
    v_empresa_id, v_current.id, v_cliente_id, p_user_id, 'Sincronização',
    'CERT-' || right(extract(epoch from now())::bigint::text, 6),
    'Sucesso',
    'Certificado digital A1 enviado pela Edge Function e armazenado como segredo.'
  );

  RETURN public.format_configuracao_fiscal_response(v_current);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_operacao_fiscal_edge(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_cliente_id uuid := NULLIF(p_payload->>'cliente_id', '')::uuid;
  v_config_id uuid := NULLIF(p_payload->>'fiscal_config_id', '')::uuid;
  v_uf text := upper(coalesce(NULLIF(p_payload->>'uf', ''), 'NA'));
  v_municipio text := coalesce(NULLIF(p_payload->>'municipio', ''), 'Não informado');
  v_provedor text := coalesce(NULLIF(p_payload->>'provedor', ''), 'WebISS');
  v_row public.configuracoes_integracao_fiscal_logs;
BEGIN
  SELECT p.empresa_id
    INTO v_empresa_id
  FROM public.perfis p
  WHERE p.user_id = p_user_id
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_config_id IS NULL THEN
    SELECT c.id, c.cliente_id
      INTO v_config_id, v_cliente_id
    FROM public.configuracoes_integracao_fiscal c
    WHERE c.empresa_id = v_empresa_id
      AND c.cliente_id IS NOT DISTINCT FROM v_cliente_id
      AND c.uf = v_uf
      AND c.municipio = v_municipio
      AND c.provedor = v_provedor
    LIMIT 1;
  END IF;

  IF v_config_id IS NULL THEN
    INSERT INTO public.configuracoes_integracao_fiscal (
      empresa_id, cliente_id, uf, municipio, provedor, ambiente, ativo, configuracao
    )
    VALUES (
      v_empresa_id,
      v_cliente_id,
      v_uf,
      v_municipio,
      v_provedor,
      public.normalize_fiscal_environment(p_payload->>'ambiente'),
      true,
      '{}'::jsonb
    )
    RETURNING id INTO v_config_id;
  END IF;

  INSERT INTO public.configuracoes_integracao_fiscal_logs (
    empresa_id, fiscal_config_id, cliente_id, usuario_id, operacao,
    numero_nfse, protocolo, status, mensagem, detalhes
  )
  VALUES (
    v_empresa_id,
    v_config_id,
    v_cliente_id,
    p_user_id,
    coalesce(NULLIF(p_payload->>'operacao', ''), 'Consulta'),
    coalesce(NULLIF(p_payload->>'numeroNfse', ''), '-'),
    coalesce(NULLIF(p_payload->>'protocolo', ''), '-'),
    coalesce(NULLIF(p_payload->>'status', ''), 'Pendente'),
    coalesce(p_payload->>'mensagem', ''),
    coalesce(p_payload->'detalhes', '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_configuracoes_fiscais() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_configuracao_fiscal(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_certificado_fiscal_edge(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_operacao_fiscal_edge(uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listar_configuracoes_fiscais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configuracao_fiscal(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_certificado_fiscal_edge(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_operacao_fiscal_edge(uuid, jsonb) TO service_role;
