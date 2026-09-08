-- Ambiente PostgreSQL isolado; nunca executar este fixture em producao.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz,
  invited_at timestamptz, last_sign_in_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb
);
CREATE TABLE public.empresas (id uuid PRIMARY KEY, status text);
CREATE TABLE public.perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
  empresa_id uuid REFERENCES public.empresas(id), nome text, papel text, ativo boolean
);
CREATE TABLE public.configuracoes_perfis_acesso (
  id uuid PRIMARY KEY, empresa_id uuid REFERENCES public.empresas(id),
  nome text, ativo boolean, permissoes text[]
);
CREATE TABLE public.configuracoes_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid REFERENCES public.empresas(id),
  perfil_id uuid, perfil_acesso_id uuid, auth_user_id uuid, nome text, email text,
  login_method text, cpf text, telefone text, perfil text, status text,
  access_config jsonb, must_change_password boolean, auth_credential_version uuid
);
CREATE TABLE public.configuracoes_eventos_logs (
  empresa_id uuid REFERENCES public.empresas(id), usuario_id uuid,
  acao text, modulo text, tipo text, detalhes jsonb
);
-- Helpers de validacao fora do escopo; resolver, preparar e provisionar reais
-- sao carregados das migrations pelo runner, sem duplicar suas guardas.
CREATE FUNCTION public.normalizar_cpf(text) RETURNS text LANGUAGE sql AS $$
  SELECT regexp_replace($1, '[^0-9]', '', 'g')
$$;
CREATE FUNCTION public.cpf_valido(text) RETURNS boolean LANGUAGE sql AS $$
  SELECT $1 = '52998224725'
$$;
CREATE FUNCTION public.configuracao_acesso_valida(jsonb) RETURNS boolean LANGUAGE sql AS $$
  SELECT jsonb_typeof($1) = 'object'
$$;
CREATE FUNCTION public.configuracao_acesso_permite_agora(jsonb) RETURNS boolean LANGUAGE sql AS $$
  SELECT COALESCE(($1->>'enabled')::boolean, false) = false
$$;
-- Definicao exata do trigger oculto observado no projeto em 2026-09-08.
CREATE FUNCTION public.auto_confirm_new_users() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_auto_confirm BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_users();

INSERT INTO public.empresas VALUES ('10000000-0000-4000-8000-000000000001', 'ativo');
INSERT INTO public.empresas VALUES ('10000000-0000-4000-8000-000000000002', 'ativo');
INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES
  ('20000000-0000-4000-8000-000000000001','gestor@example.com','{}');
INSERT INTO public.perfis (user_id,empresa_id,papel,ativo) VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','admin',true);
INSERT INTO public.configuracoes_usuarios (
  auth_user_id,empresa_id,status,must_change_password,login_method,access_config
) VALUES (
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  'Ativo',false,'email','{"enabled":false}'
);
INSERT INTO public.configuracoes_perfis_acesso VALUES
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   'Administrador',true,ARRAY['usuarios:manage']),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
   'Administrador',true,ARRAY['usuarios:manage']);
INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES
  ('20000000-0000-4000-8000-000000000002','membro@example.com','{}');
INSERT INTO public.perfis (user_id,empresa_id,papel,ativo) VALUES
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','membro',true);
INSERT INTO public.configuracoes_usuarios (
  auth_user_id,empresa_id,status,must_change_password,login_method,access_config
) VALUES (
  '20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
  'Ativo',false,'email','{"enabled":false}'
);
