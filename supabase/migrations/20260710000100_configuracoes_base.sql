-- Base multi-tenant e modulo de configuracoes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome varchar(150) NOT NULL,
  razao_social varchar(180),
  cnpj varchar(20),
  status varchar(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome varchar(150),
  papel varchar(40) NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'contador', 'assistente', 'membro')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.empresa_id
  FROM public.perfis p
  WHERE p.user_id = auth.uid()
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_empresa_member(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.user_id = auth.uid()
      AND p.empresa_id = p_empresa_id
      AND p.ativo = true
  )
$$;

CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  razao_social varchar(180) NOT NULL DEFAULT '',
  nome_fantasia varchar(150) NOT NULL DEFAULT '',
  cnpj varchar(20) NOT NULL DEFAULT '',
  inscricao_estadual varchar(40) NOT NULL DEFAULT '',
  email varchar(150) NOT NULL DEFAULT '',
  telefone varchar(30) NOT NULL DEFAULT '',
  cep varchar(12) NOT NULL DEFAULT '',
  endereco varchar(180) NOT NULL DEFAULT '',
  numero varchar(20) NOT NULL DEFAULT '',
  cidade varchar(120) NOT NULL DEFAULT '',
  estado char(2) NOT NULL DEFAULT '',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_marca_dagua (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  habilitado boolean NOT NULL DEFAULT false,
  posicao varchar(30) NOT NULL DEFAULT 'centro' CHECK (posicao IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')),
  opacidade integer NOT NULL DEFAULT 15 CHECK (opacidade BETWEEN 5 AND 80),
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_contadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome varchar(150) NOT NULL,
  crc varchar(40) NOT NULL,
  cpf_cnpj varchar(20) NOT NULL,
  email varchar(150) NOT NULL,
  is_responsavel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  nome varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  perfil varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Ativo', 'Inativo', 'Pendente')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, email)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_perfis_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome varchar(80) NOT NULL,
  descricao text NOT NULL DEFAULT '',
  permissoes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  banco varchar(100) NOT NULL,
  agencia varchar(20) NOT NULL,
  numero_conta varchar(30) NOT NULL,
  tipo_conta varchar(20) NOT NULL CHECK (tipo_conta IN ('corrente', 'poupanca')),
  saldo_inicial numeric(15,2) NOT NULL DEFAULT 0,
  saldo_atual numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, banco, agencia, numero_conta)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_integracao_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provedor varchar(60) NOT NULL,
  ambiente varchar(20) NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  ativo boolean NOT NULL DEFAULT false,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, provedor)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_integracao_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  uf char(2) NOT NULL,
  municipio varchar(120) NOT NULL,
  provedor varchar(80) NOT NULL,
  ambiente varchar(20) NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  ativo boolean NOT NULL DEFAULT false,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, uf, municipio, provedor)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_armazenamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  limite_mb integer NOT NULL DEFAULT 10240 CHECK (limite_mb >= 0),
  politica_retencao_dias integer NOT NULL DEFAULT 365 CHECK (politica_retencao_dias >= 0),
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_compartilhamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  exigir_senha boolean NOT NULL DEFAULT true,
  expirar_links_dias integer NOT NULL DEFAULT 7 CHECK (expirar_links_dias BETWEEN 1 AND 365),
  permitir_download boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_calculadora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes_api_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  servico varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'desconhecido' CHECK (status IN ('operacional', 'degradado', 'indisponivel', 'desconhecido')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  verificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, servico)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_eventos_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao varchar(120) NOT NULL,
  modulo varchar(80) NOT NULL DEFAULT 'Configuracoes',
  tipo varchar(20) NOT NULL DEFAULT 'Sucesso' CHECK (tipo IN ('Sucesso', 'Erro', 'Alerta')),
  ip_address inet,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_empresa(p_payload jsonb)
RETURNS public.configuracoes_empresa
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_empresa;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  INSERT INTO public.configuracoes_empresa (
    empresa_id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
    email, telefone, cep, endereco, numero, cidade, estado, logo_url
  )
  VALUES (
    v_empresa_id,
    COALESCE(p_payload->>'razao_social', ''),
    COALESCE(p_payload->>'nome_fantasia', ''),
    COALESCE(p_payload->>'cnpj', ''),
    COALESCE(p_payload->>'inscricao_estadual', ''),
    COALESCE(p_payload->>'email', ''),
    COALESCE(p_payload->>'telefone', ''),
    COALESCE(p_payload->>'cep', ''),
    COALESCE(p_payload->>'endereco', ''),
    COALESCE(p_payload->>'numero', ''),
    COALESCE(p_payload->>'cidade', ''),
    COALESCE(p_payload->>'estado', ''),
    NULLIF(p_payload->>'logo_url', '')
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    razao_social = EXCLUDED.razao_social,
    nome_fantasia = EXCLUDED.nome_fantasia,
    cnpj = EXCLUDED.cnpj,
    inscricao_estadual = EXCLUDED.inscricao_estadual,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    cep = EXCLUDED.cep,
    endereco = EXCLUDED.endereco,
    numero = EXCLUDED.numero,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    logo_url = EXCLUDED.logo_url,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_marca_dagua(p_payload jsonb)
RETURNS public.configuracoes_marca_dagua
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_marca_dagua;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  INSERT INTO public.configuracoes_marca_dagua (
    empresa_id, habilitado, posicao, opacidade, file_url
  )
  VALUES (
    v_empresa_id,
    COALESCE((p_payload->>'habilitado')::boolean, false),
    COALESCE(p_payload->>'posicao', 'centro'),
    COALESCE((p_payload->>'opacidade')::integer, 15),
    NULLIF(p_payload->>'file_url', '')
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    habilitado = EXCLUDED.habilitado,
    posicao = EXCLUDED.posicao,
    opacidade = EXCLUDED.opacidade,
    file_url = EXCLUDED.file_url,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name IN (
        'empresas',
        'perfis',
        'configuracoes_empresa',
        'configuracoes_marca_dagua',
        'configuracoes_contadores',
        'configuracoes_usuarios',
        'configuracoes_perfis_acesso',
        'configuracoes_contas_bancarias',
        'configuracoes_integracao_bancaria',
        'configuracoes_integracao_fiscal',
        'configuracoes_armazenamento',
        'configuracoes_compartilhamento',
        'configuracoes_calculadora',
        'configuracoes_api_status'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', r.table_name, r.table_name);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      r.table_name,
      r.table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_marca_dagua ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_contadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_perfis_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_integracao_bancaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_integracao_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_armazenamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_compartilhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_calculadora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_api_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_eventos_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_tenant_policy ON public.empresas;
CREATE POLICY empresas_tenant_policy ON public.empresas
  FOR ALL TO authenticated
  USING (public.is_empresa_member(id) OR public.is_empresa_member(parent_empresa_id))
  WITH CHECK (public.is_empresa_member(id) OR parent_empresa_id IS NULL);

DROP POLICY IF EXISTS perfis_self_select_policy ON public.perfis;
CREATE POLICY perfis_self_select_policy ON public.perfis
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS perfis_admin_write_policy ON public.perfis;
CREATE POLICY perfis_admin_write_policy ON public.perfis
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_empresa_policy ON public.configuracoes_empresa;
CREATE POLICY configuracoes_empresa_policy ON public.configuracoes_empresa
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_marca_dagua_policy ON public.configuracoes_marca_dagua;
CREATE POLICY configuracoes_marca_dagua_policy ON public.configuracoes_marca_dagua
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_contadores_policy ON public.configuracoes_contadores;
CREATE POLICY configuracoes_contadores_policy ON public.configuracoes_contadores
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_usuarios_policy ON public.configuracoes_usuarios;
CREATE POLICY configuracoes_usuarios_policy ON public.configuracoes_usuarios
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_perfis_acesso_policy ON public.configuracoes_perfis_acesso;
CREATE POLICY configuracoes_perfis_acesso_policy ON public.configuracoes_perfis_acesso
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_contas_bancarias_policy ON public.configuracoes_contas_bancarias;
CREATE POLICY configuracoes_contas_bancarias_policy ON public.configuracoes_contas_bancarias
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_integracao_bancaria_policy ON public.configuracoes_integracao_bancaria;
CREATE POLICY configuracoes_integracao_bancaria_policy ON public.configuracoes_integracao_bancaria
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_integracao_fiscal_policy ON public.configuracoes_integracao_fiscal;
CREATE POLICY configuracoes_integracao_fiscal_policy ON public.configuracoes_integracao_fiscal
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_armazenamento_policy ON public.configuracoes_armazenamento;
CREATE POLICY configuracoes_armazenamento_policy ON public.configuracoes_armazenamento
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_compartilhamento_policy ON public.configuracoes_compartilhamento;
CREATE POLICY configuracoes_compartilhamento_policy ON public.configuracoes_compartilhamento
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_calculadora_policy ON public.configuracoes_calculadora;
CREATE POLICY configuracoes_calculadora_policy ON public.configuracoes_calculadora
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_api_status_policy ON public.configuracoes_api_status;
CREATE POLICY configuracoes_api_status_policy ON public.configuracoes_api_status
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_eventos_logs_policy ON public.configuracoes_eventos_logs;
CREATE POLICY configuracoes_eventos_logs_policy ON public.configuracoes_eventos_logs
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE INDEX IF NOT EXISTS idx_perfis_user_empresa ON public.perfis(user_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_contadores_empresa ON public.configuracoes_contadores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_usuarios_empresa ON public.configuracoes_usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_contas_bancarias_empresa ON public.configuracoes_contas_bancarias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_eventos_logs_empresa_created ON public.configuracoes_eventos_logs(empresa_id, created_at DESC);
