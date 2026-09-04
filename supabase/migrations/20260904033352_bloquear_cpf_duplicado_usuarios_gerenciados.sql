-- Serializa cadastros pelo CPF e impede que uma identidade gerenciada duplique
-- um CPF ja associado a outro usuario, independentemente do metodo de login.

CREATE OR REPLACE FUNCTION public.preparar_provisionamento_funcionario_cpf(
  p_actor_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.resolver_empresa_gestor_edge(p_actor_user_id);
  v_nome text := pg_catalog.btrim(COALESCE(p_payload->>'nome', ''));
  v_cpf text := public.normalizar_cpf(COALESCE(p_payload->>'cpf', ''));
  v_alias text;
  v_email text := pg_catalog.lower(NULLIF(pg_catalog.btrim(p_payload->>'email'), ''));
  v_telefone text := NULLIF(
    pg_catalog.regexp_replace(COALESCE(p_payload->>'telefone', ''), '[^0-9]', '', 'g'),
    ''
  );
  v_status text := COALESCE(NULLIF(pg_catalog.btrim(p_payload->>'status'), ''), 'Ativo');
  v_perfil_id uuid;
  v_perfil public.configuracoes_perfis_acesso%ROWTYPE;
  v_access_config jsonb := COALESCE(
    p_payload->'access_config',
    '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Seu acesso nao esta permitido neste dia ou horario. Entre em contato com o gestor."}'::jsonb
  );
BEGIN
  BEGIN
    v_perfil_id := (p_payload->>'perfil_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Perfil invalido.';
  END;

  IF pg_catalog.length(v_nome) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.';
  END IF;
  IF NOT public.cpf_valido(v_cpf) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CPF invalido.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-cpf:' || v_cpf, 0)
  );
  v_alias := public.resolver_alias_autenticacao_funcionario_cpf(v_cpf);

  IF v_email IS NOT NULL
     AND (
       pg_catalog.length(v_email) > 150
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email de contato invalido.';
  END IF;
  IF v_telefone IS NOT NULL AND pg_catalog.length(v_telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Telefone de contato invalido.';
  END IF;
  IF v_status NOT IN ('Ativo', 'Inativo', 'Pendente') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Status invalido.';
  END IF;
  IF NOT public.configuracao_acesso_valida(v_access_config) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Configuracao de acesso invalida.';
  END IF;

  SELECT * INTO v_perfil
  FROM public.configuracoes_perfis_acesso
  WHERE id = v_perfil_id
    AND empresa_id = v_empresa_id
    AND ativo = true
  FOR SHARE;

  IF v_perfil.id IS NULL
     OR pg_catalog.lower(COALESCE(v_perfil.codigo, '')) IN ('gestor', 'admin', 'administrador')
     OR pg_catalog.lower(v_perfil.nome) IN ('gestor', 'admin', 'administrador')
     OR v_perfil.permissoes && ARRAY[
       'usuarios:manage', 'perfis:manage', 'configuracoes:manage'
     ]::text[] THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Perfil nao permitido para funcionario CPF.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM private.identidades_funcionarios_cpf AS identidade
    WHERE identidade.cpf_normalizado = v_cpf
       OR pg_catalog.lower(identidade.auth_alias) = v_alias
  ) OR EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios AS usuario
    WHERE public.normalizar_cpf(COALESCE(usuario.cpf, '')) = v_cpf
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'CPF ja cadastrado.';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'empresa_id', v_empresa_id,
    'nome', v_nome,
    'cpf', v_cpf,
    'auth_alias', v_alias,
    'email', v_email,
    'telefone', v_telefone,
    'status', v_status,
    'perfil_id', v_perfil.id,
    'perfil_nome', v_perfil.nome,
    'access_config', v_access_config
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_provisionamento_funcionario_cpf(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_provisionamento_funcionario_cpf(uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.proteger_cpf_usuario_gerenciado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cpf text := public.normalizar_cpf(COALESCE(NEW.cpf, ''));
  v_novo_gerenciado boolean;
BEGIN
  IF v_cpf = '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-cpf:' || v_cpf, 0)
  );

  v_novo_gerenciado := (
    NEW.login_method = 'cpf'
    OR NEW.auth_credential_version IS NOT NULL
  );

  IF EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios AS usuario
    WHERE usuario.id IS DISTINCT FROM NEW.id
      AND public.normalizar_cpf(COALESCE(usuario.cpf, '')) = v_cpf
      AND (
        v_novo_gerenciado
        OR usuario.login_method = 'cpf'
        OR usuario.auth_credential_version IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505', MESSAGE = 'CPF ja cadastrado para outro usuario.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_cpf_usuario_gerenciado()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS proteger_cpf_usuario_gerenciado_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER proteger_cpf_usuario_gerenciado_trigger
BEFORE INSERT OR UPDATE OF cpf, login_method, auth_credential_version
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.proteger_cpf_usuario_gerenciado();
