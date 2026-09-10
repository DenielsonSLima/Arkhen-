-- Complemento isolado de webiss_schema.sql. Não executar no banco do aplicativo.
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA cron; CREATE SCHEMA net;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS $$ SELECT sha256(convert_to($1,'UTF8')) $$;
CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT sha256(convert_to(gen_random_uuid()::text,'UTF8')) $$;
CREATE TABLE cron.test_jobs(name text,schedule text,command text);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO cron.test_jobs VALUES($1,$2,$3); RETURN 1; END $$;
CREATE TABLE net.test_requests(url text,headers jsonb,body jsonb);
CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO net.test_requests VALUES(url,headers,body); RETURN 1; END $$;
CREATE TABLE public.perfis(user_id uuid,empresa_id uuid,ativo boolean,papel text);
CREATE TABLE public.configuracoes_perfis_acesso(id uuid,empresa_id uuid,ativo boolean,nome text,permissoes text[]);
CREATE TABLE public.configuracoes_usuarios(auth_user_id uuid,empresa_id uuid,status text,perfil_acesso_id uuid,perfil text);
CREATE FUNCTION public.current_user_has_permission(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.can_manage',true),'true')='true' AND auth.uid()=$1 $$;
CREATE TABLE public.financeiro_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresas(id), cliente_empresa_id uuid REFERENCES clientes(id),
  descricao_servico text,valor_mensal numeric(15,2),dia_vencimento integer,emissao_automatica_nfse boolean DEFAULT false,ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.financeiro_cobrancas ADD COLUMN contrato_id uuid REFERENCES financeiro_configuracoes(id), ADD COLUMN data_vencimento date;
CREATE TABLE public.inter_cobranca_tentativas(empresa_id uuid,request_id text,cobranca_id uuid);
CREATE FUNCTION public.salvar_contrato_financeiro(jsonb) RETURNS public.financeiro_configuracoes LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture legado'; END $$;
