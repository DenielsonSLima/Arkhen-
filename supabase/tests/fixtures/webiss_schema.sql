-- Ambiente isolado de testes. NUNCA executar este fixture no banco da aplicacao.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA app_private;
CREATE SCHEMA vault;
CREATE TABLE public.empresas (id uuid PRIMARY KEY);
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY, empresa_id uuid, cnpj text, tipo text, razao_social text,
  nome text, endereco text, bairro text, cidade text, uf text, cep text, email text, telefone text
);
CREATE TABLE public.configuracoes_empresa (id uuid PRIMARY KEY, empresa_id uuid, cnpj text);
CREATE TABLE public.financeiro_cobrancas (
  id uuid PRIMARY KEY, empresa_id uuid REFERENCES empresas(id), cliente_empresa_id uuid,
  status text, nfse_id text, nfse_status text, nfse_rps_numero bigint,
  nfse_payload jsonb, nfse_emitida_em timestamptz, updated_at timestamptz,
  valor numeric, descricao text
);
CREATE UNIQUE INDEX financeiro_nfse_rps_empresa_idx ON financeiro_cobrancas(empresa_id,nfse_rps_numero);
CREATE TABLE public.configuracoes_integracao_fiscal (
  id uuid PRIMARY KEY, empresa_id uuid, cliente_id uuid, ativo boolean,
  uf text, municipio text, provedor text, ambiente text, configuracao jsonb,
  certificado_arquivo_secret_id uuid, certificado_senha_secret_id uuid,
  webservice_senha_secret_id uuid, certificado_metadata jsonb, stats jsonb, updated_at timestamptz
);
CREATE TABLE public.configuracoes_integracao_fiscal_logs (
  empresa_id uuid, fiscal_config_id uuid, usuario_id uuid, operacao text,
  numero_nfse text, protocolo text, status text, mensagem text, detalhes jsonb
);
CREATE TABLE vault.decrypted_secrets(id uuid, decrypted_secret text);
-- Fixtures de identidade: o usuario e a empresa possuem o mesmo UUID somente nestes testes.
CREATE FUNCTION public.resolve_empresa_id_for_user(p_user_id uuid) RETURNS uuid
LANGUAGE sql AS $$ SELECT id FROM public.empresas WHERE id = p_user_id $$;
CREATE FUNCTION public.current_empresa_id() RETURNS uuid
LANGUAGE sql AS $$ SELECT nullif(current_setting('test.empresa',true),'')::uuid $$;
CREATE FUNCTION public.configuracoes_modulos_can_manage() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.normalize_fiscal_environment(text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN $1 = 'producao' THEN 'producao' ELSE 'homologacao' END $$;
CREATE FUNCTION public.format_configuracao_fiscal_response(public.configuracoes_integracao_fiscal)
RETURNS jsonb LANGUAGE sql AS $$ SELECT to_jsonb($1) $$;
CREATE FUNCTION app_private.normalizar_cnpj_alfanumerico(text) RETURNS text LANGUAGE sql AS $$
  SELECT upper(regexp_replace($1,'[^0-9A-Za-z]','','g')) $$;
CREATE FUNCTION app_private.cnpj_alfanumerico_valido(text) RETURNS boolean LANGUAGE sql AS $$
  SELECT $1 ~ '^[0-9A-Z]{12}[0-9]{2}$' $$;
