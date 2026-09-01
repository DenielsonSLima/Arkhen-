-- Acesso de funcionarios por CPF sem expor CPF no identificador do Supabase Auth.
-- O alias de autenticacao e derivado no banco com HMAC e segredo privado persistente.

CREATE OR REPLACE FUNCTION public.normalizar_cpf(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = ''
AS $$
  SELECT pg_catalog.regexp_replace(p_valor, '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.cpf_valido(p_valor text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = ''
AS $$
DECLARE
  v_cpf text := public.normalizar_cpf(p_valor);
  v_soma integer := 0;
  v_digito integer;
  v_indice integer;
BEGIN
  IF pg_catalog.length(v_cpf) <> 11
     OR v_cpf = pg_catalog.repeat(pg_catalog.substr(v_cpf, 1, 1), 11) THEN
    RETURN false;
  END IF;

  FOR v_indice IN 1..9 LOOP
    v_soma := v_soma
      + pg_catalog.substr(v_cpf, v_indice, 1)::integer * (11 - v_indice);
  END LOOP;
  v_digito := (v_soma * 10) % 11;
  IF v_digito = 10 THEN v_digito := 0; END IF;
  IF v_digito <> pg_catalog.substr(v_cpf, 10, 1)::integer THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR v_indice IN 1..10 LOOP
    v_soma := v_soma
      + pg_catalog.substr(v_cpf, v_indice, 1)::integer * (12 - v_indice);
  END LOOP;
  v_digito := (v_soma * 10) % 11;
  IF v_digito = 10 THEN v_digito := 0; END IF;

  RETURN v_digito = pg_catalog.substr(v_cpf, 11, 1)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.normalizar_cpf(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cpf_valido(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_cpf(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cpf_valido(text) TO authenticated;

ALTER TABLE public.configuracoes_usuarios
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS login_method varchar(20) NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS perfil_acesso_id uuid,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.configuracoes_usuarios
  ALTER COLUMN login_method SET DEFAULT 'email',
  ALTER COLUMN login_method SET NOT NULL,
  ALTER COLUMN must_change_password SET DEFAULT false,
  ALTER COLUMN must_change_password SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_identidade_ref_unq
  ON public.configuracoes_usuarios (id, auth_user_id, empresa_id);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.segredos_autenticacao (
  chave text PRIMARY KEY,
  valor bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT segredos_autenticacao_valor_check
    CHECK (pg_catalog.octet_length(valor) = 32)
);

INSERT INTO private.segredos_autenticacao (chave, valor)
SELECT 'funcionario_cpf_alias_v1', extensions.gen_random_bytes(32)
WHERE NOT EXISTS (
  SELECT 1 FROM private.segredos_autenticacao
  WHERE chave = 'funcionario_cpf_alias_v1'
)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE private.segredos_autenticacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.segredos_autenticacao FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.identidades_funcionarios_cpf (
  configuracao_usuario_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  cpf_normalizado varchar(11) NOT NULL,
  auth_alias varchar(254) NOT NULL,
  CONSTRAINT identidades_funcionarios_cpf_cpf_check CHECK (
    cpf_normalizado = public.normalizar_cpf(cpf_normalizado)
    AND public.cpf_valido(cpf_normalizado)
  ),
  CONSTRAINT identidades_funcionarios_cpf_alias_check CHECK (
    auth_alias = pg_catalog.lower(auth_alias)
    AND auth_alias ~ '^[0-9a-f]{64}@[a-z0-9.-]+\.[a-z]{2,63}$'
  ),
  CONSTRAINT identidades_funcionarios_cpf_auth_fkey
    FOREIGN KEY (auth_user_id)
    REFERENCES auth.users (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT identidades_funcionarios_cpf_config_fkey
    FOREIGN KEY (configuracao_usuario_id, auth_user_id, empresa_id)
    REFERENCES public.configuracoes_usuarios (id, auth_user_id, empresa_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX IF NOT EXISTS identidades_funcionarios_cpf_auth_user_unq
  ON private.identidades_funcionarios_cpf (auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS identidades_funcionarios_cpf_cpf_normalizado_unq
  ON private.identidades_funcionarios_cpf (cpf_normalizado);
CREATE UNIQUE INDEX IF NOT EXISTS identidades_funcionarios_cpf_auth_alias_unq
  ON private.identidades_funcionarios_cpf (pg_catalog.lower(auth_alias));

ALTER TABLE private.identidades_funcionarios_cpf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.identidades_funcionarios_cpf
  FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

-- Reconcilia uma eventual aplicacao parcial anterior antes de remover qualquer
-- identidade tecnica da tabela publicada no Realtime/PostgREST.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracoes_usuarios'
      AND column_name = 'auth_alias'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracoes_usuarios'
      AND column_name = 'cpf_normalizado'
  ) THEN
    EXECUTE $sql$
      INSERT INTO private.identidades_funcionarios_cpf (
        configuracao_usuario_id, auth_user_id, empresa_id, cpf_normalizado, auth_alias
      )
      SELECT id, auth_user_id, empresa_id, cpf_normalizado, pg_catalog.lower(auth_alias)
      FROM public.configuracoes_usuarios
      WHERE login_method = 'cpf'
        AND auth_user_id IS NOT NULL
        AND cpf_normalizado IS NOT NULL
        AND auth_alias IS NOT NULL
      ON CONFLICT (configuracao_usuario_id) DO UPDATE
      SET auth_user_id = EXCLUDED.auth_user_id,
          empresa_id = EXCLUDED.empresa_id,
          cpf_normalizado = EXCLUDED.cpf_normalizado,
          auth_alias = EXCLUDED.auth_alias
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios usuario
    LEFT JOIN private.identidades_funcionarios_cpf identidade
      ON identidade.configuracao_usuario_id = usuario.id
    LEFT JOIN auth.users auth_user
      ON auth_user.id = usuario.auth_user_id
    LEFT JOIN public.perfis membership
      ON membership.id = usuario.perfil_id
    LEFT JOIN public.configuracoes_perfis_acesso acesso
      ON acesso.id = usuario.perfil_acesso_id
    WHERE usuario.login_method = 'cpf'
      AND (
        usuario.auth_user_id IS NULL
        OR usuario.cpf IS NULL
        OR NOT public.cpf_valido(usuario.cpf)
        OR identidade.configuracao_usuario_id IS NULL
        OR identidade.auth_user_id IS DISTINCT FROM usuario.auth_user_id
        OR identidade.empresa_id IS DISTINCT FROM usuario.empresa_id
        OR identidade.cpf_normalizado
          IS DISTINCT FROM public.normalizar_cpf(usuario.cpf)
        OR pg_catalog.lower(auth_user.email) IS DISTINCT FROM identidade.auth_alias
        OR auth_user.raw_app_meta_data->>'login_method' IS DISTINCT FROM 'cpf'
        OR auth_user.raw_app_meta_data->>'account_type'
          IS DISTINCT FROM 'employee_cpf'
        OR membership.id IS NULL
        OR membership.user_id IS DISTINCT FROM usuario.auth_user_id
        OR membership.empresa_id IS DISTINCT FROM usuario.empresa_id
        OR membership.papel IS DISTINCT FROM 'membro'
        OR membership.ativo IS DISTINCT FROM (usuario.status = 'Ativo')
        OR acesso.id IS NULL
        OR acesso.empresa_id IS DISTINCT FROM usuario.empresa_id
        OR acesso.ativo IS DISTINCT FROM true
        OR usuario.perfil IS DISTINCT FROM acesso.nome
        OR pg_catalog.lower(COALESCE(acesso.codigo, ''))
          IN ('gestor', 'admin', 'administrador')
        OR pg_catalog.lower(acesso.nome)
          IN ('gestor', 'admin', 'administrador')
        OR acesso.permissoes && ARRAY[
          'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
        ]::text[]
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Migracao interrompida: identidade CPF legada inconsistente.';
  END IF;
END;
$$;

ALTER TABLE public.configuracoes_usuarios
  DROP CONSTRAINT IF EXISTS configuracoes_usuarios_cpf_normalizado_check,
  DROP CONSTRAINT IF EXISTS configuracoes_usuarios_identificador_auth_check;
DROP INDEX IF EXISTS public.configuracoes_usuarios_cpf_normalizado_unq;
DROP INDEX IF EXISTS public.configuracoes_usuarios_auth_alias_unq;
ALTER TABLE public.configuracoes_usuarios
  DROP COLUMN IF EXISTS auth_alias,
  DROP COLUMN IF EXISTS cpf_normalizado;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'configuracoes_usuarios_perfil_acesso_id_fkey'
      AND conrelid = 'public.configuracoes_usuarios'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_usuarios
      ADD CONSTRAINT configuracoes_usuarios_perfil_acesso_id_fkey
      FOREIGN KEY (perfil_acesso_id)
      REFERENCES public.configuracoes_perfis_acesso(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_perfis_acesso_id_empresa_unq
  ON public.configuracoes_perfis_acesso (id, empresa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'configuracoes_usuarios_perfil_acesso_empresa_fkey'
      AND conrelid = 'public.configuracoes_usuarios'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_usuarios
      ADD CONSTRAINT configuracoes_usuarios_perfil_acesso_empresa_fkey
      FOREIGN KEY (perfil_acesso_id, empresa_id)
      REFERENCES public.configuracoes_perfis_acesso(id, empresa_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'configuracoes_usuarios_login_method_check'
      AND conrelid = 'public.configuracoes_usuarios'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_usuarios
      ADD CONSTRAINT configuracoes_usuarios_login_method_check
      CHECK (login_method IN ('email', 'cpf'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'configuracoes_usuarios_identificador_auth_check'
      AND conrelid = 'public.configuracoes_usuarios'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_usuarios
      ADD CONSTRAINT configuracoes_usuarios_identificador_auth_check
      CHECK (
        (
          login_method = 'email'
          AND email IS NOT NULL
        )
        OR (
          login_method = 'cpf'
          AND auth_user_id IS NOT NULL
          AND cpf IS NOT NULL
          AND cpf = public.normalizar_cpf(cpf)
          AND public.cpf_valido(cpf)
        )
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_empresa_email_ci_unq
  ON public.configuracoes_usuarios (empresa_id, pg_catalog.lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS configuracoes_usuarios_perfil_acesso_idx
  ON public.configuracoes_usuarios (perfil_acesso_id)
  WHERE perfil_acesso_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.configuracao_acesso_valida(p_config jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_intervalo jsonb;
  v_dia jsonb;
  v_inicio text;
  v_fim text;
BEGIN
  IF p_config IS NULL
     OR pg_catalog.jsonb_typeof(p_config) <> 'object'
     OR pg_catalog.jsonb_typeof(p_config->'enabled') <> 'boolean' THEN
    RETURN false;
  END IF;

  IF p_config ? 'message'
     AND (
       pg_catalog.jsonb_typeof(p_config->'message') <> 'string'
       OR pg_catalog.length(p_config->>'message') > 300
       OR p_config->>'message' ~ '[[:cntrl:]<>]'
     ) THEN
    RETURN false;
  END IF;

  IF NOT (p_config->>'enabled')::boolean THEN
    RETURN true;
  END IF;

  IF pg_catalog.jsonb_typeof(p_config->'days') <> 'array'
     OR pg_catalog.jsonb_array_length(p_config->'days') NOT BETWEEN 1 AND 7
     OR pg_catalog.jsonb_typeof(p_config->'intervals') <> 'array'
     OR pg_catalog.jsonb_array_length(p_config->'intervals') NOT BETWEEN 1 AND 8 THEN
    RETURN false;
  END IF;

  FOR v_dia IN SELECT value FROM pg_catalog.jsonb_array_elements(p_config->'days') LOOP
    IF pg_catalog.jsonb_typeof(v_dia) <> 'number'
       OR v_dia::text !~ '^[0-6]$' THEN
      RETURN false;
    END IF;
  END LOOP;

  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.jsonb_array_elements(p_config->'days')
  ) <> (
    SELECT pg_catalog.count(DISTINCT value)
    FROM pg_catalog.jsonb_array_elements(p_config->'days')
  ) THEN
    RETURN false;
  END IF;

  FOR v_intervalo IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_config->'intervals')
  LOOP
    IF pg_catalog.jsonb_typeof(v_intervalo) <> 'object' THEN
      RETURN false;
    END IF;
    v_inicio := v_intervalo->>'start';
    v_fim := v_intervalo->>'end';
    IF v_inicio IS NULL OR v_fim IS NULL
       OR v_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR v_fim !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR v_inicio::time >= v_fim::time THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.configuracao_acesso_permite_agora(
  p_config jsonb,
  p_momento timestamptz DEFAULT pg_catalog.now()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_local timestamp := p_momento AT TIME ZONE 'America/Maceio';
  v_horario time;
BEGIN
  IF NOT public.configuracao_acesso_valida(p_config) THEN
    RETURN false;
  END IF;
  IF NOT (p_config->>'enabled')::boolean THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements_text(p_config->'days') AS dia(valor)
    WHERE dia.valor::integer = EXTRACT(DOW FROM v_local)::integer
  ) THEN
    RETURN false;
  END IF;

  v_horario := pg_catalog.date_trunc('minute', v_local)::time;
  RETURN EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_config->'intervals') AS faixa(valor)
    WHERE v_horario BETWEEN (faixa.valor->>'start')::time
                        AND (faixa.valor->>'end')::time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configuracao_acesso_valida(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.configuracao_acesso_permite_agora(jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
