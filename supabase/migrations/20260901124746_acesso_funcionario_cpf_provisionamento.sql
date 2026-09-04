CREATE OR REPLACE FUNCTION public.resolver_alias_autenticacao_funcionario_cpf(
  p_cpf text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cpf text := public.normalizar_cpf(COALESCE(p_cpf, ''));
  v_segredo bytea;
BEGIN
  IF NOT public.cpf_valido(v_cpf) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CPF invalido.';
  END IF;

  SELECT segredo.valor
  INTO v_segredo
  FROM private.segredos_autenticacao segredo
  WHERE segredo.chave = 'funcionario_cpf_alias_v1';

  IF v_segredo IS NULL OR pg_catalog.octet_length(v_segredo) <> 32 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002', MESSAGE = 'Segredo de autenticacao indisponivel.';
  END IF;

  RETURN pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to('arkhen:funcionario-cpf:v1:' || v_cpf, 'UTF8'),
      v_segredo,
      'sha256'
    ),
    'hex'
  ) || '@usuarios.arkhenprime.com.br';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_empresa_gestor_edge(p_actor_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresas uuid[];
BEGIN
  SELECT pg_catalog.array_agg(membership.empresa_id ORDER BY membership.empresa_id)
  INTO v_empresas
  FROM public.perfis membership
  JOIN public.empresas empresa ON empresa.id = membership.empresa_id
  JOIN public.configuracoes_usuarios usuario
    ON usuario.empresa_id = membership.empresa_id
   AND usuario.auth_user_id = membership.user_id
  WHERE membership.user_id = p_actor_user_id
    AND membership.ativo = true
    AND empresa.status = 'ativo'
    AND usuario.status = 'Ativo'
    AND public.configuracao_acesso_permite_agora(usuario.access_config)
    AND (
      membership.papel = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.configuracoes_perfis_acesso acesso
        WHERE acesso.empresa_id = usuario.empresa_id
          AND acesso.ativo = true
          AND (
            acesso.id = usuario.perfil_acesso_id
            OR (
              usuario.perfil_acesso_id IS NULL
              AND pg_catalog.lower(acesso.nome) = pg_catalog.lower(usuario.perfil)
            )
          )
          AND 'usuarios:manage' = ANY(acesso.permissoes)
      )
    );

  IF COALESCE(pg_catalog.array_length(v_empresas, 1), 0) <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Gestor sem empresa unica e ativa.';
  END IF;
  RETURN v_empresas[1];
END;
$$;

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
  v_status text := COALESCE(
    NULLIF(pg_catalog.btrim(p_payload->>'status'), ''),
    'Ativo'
  );
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
  v_alias := public.resolver_alias_autenticacao_funcionario_cpf(v_cpf);
  IF v_email IS NOT NULL
     AND (
       pg_catalog.length(v_email) > 150
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email de contato invalido.';
  END IF;
  IF v_telefone IS NOT NULL
     AND pg_catalog.length(v_telefone) NOT IN (10, 11) THEN
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
    SELECT 1 FROM private.identidades_funcionarios_cpf identidade
    WHERE identidade.cpf_normalizado = v_cpf
       OR pg_catalog.lower(identidade.auth_alias) = v_alias
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

CREATE OR REPLACE FUNCTION public.provisionar_usuario_funcionario_cpf(
  p_actor_user_id uuid,
  p_auth_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_preparado jsonb;
  v_empresa_id uuid;
  v_cpf text;
  v_alias text;
  v_nome text;
  v_email text;
  v_telefone text;
  v_status text;
  v_perfil_acesso_id uuid;
  v_perfil_nome text;
  v_membership_id uuid;
  v_usuario_id uuid := pg_catalog.gen_random_uuid();
  v_usuario public.configuracoes_usuarios%ROWTYPE;
  v_auth_email text;
  v_auth_login_method text;
  v_auth_account_type text;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Conta Auth invalida.';
  END IF;

  v_preparado := public.preparar_provisionamento_funcionario_cpf(
    p_actor_user_id,
    p_payload
  );
  v_empresa_id := (v_preparado->>'empresa_id')::uuid;
  v_cpf := v_preparado->>'cpf';
  v_alias := v_preparado->>'auth_alias';
  v_nome := v_preparado->>'nome';
  v_email := v_preparado->>'email';
  v_telefone := v_preparado->>'telefone';
  v_status := v_preparado->>'status';
  v_perfil_acesso_id := (v_preparado->>'perfil_id')::uuid;
  v_perfil_nome := v_preparado->>'perfil_nome';

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-cpf:' || v_cpf, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('funcionario-auth:' || p_auth_user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1 FROM private.identidades_funcionarios_cpf identidade
    WHERE identidade.cpf_normalizado = v_cpf
       OR pg_catalog.lower(identidade.auth_alias) = v_alias
       OR identidade.auth_user_id = p_auth_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.configuracoes_usuarios usuario
    WHERE usuario.auth_user_id = p_auth_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.perfis WHERE user_id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Funcionario ja cadastrado.';
  END IF;

  SELECT
    pg_catalog.lower(email),
    raw_app_meta_data->>'login_method',
    raw_app_meta_data->>'account_type'
  INTO v_auth_email, v_auth_login_method, v_auth_account_type
  FROM auth.users
  WHERE id = p_auth_user_id;

  IF v_auth_email IS DISTINCT FROM v_alias
     OR v_auth_login_method IS DISTINCT FROM 'cpf'
     OR v_auth_account_type IS DISTINCT FROM 'employee_cpf' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Conta Auth nao corresponde ao provisionamento CPF.';
  END IF;

  INSERT INTO public.perfis (
    user_id, empresa_id, nome, papel, ativo
  ) VALUES (
    p_auth_user_id, v_empresa_id, v_nome, 'membro', true
  )
  RETURNING id INTO v_membership_id;

  INSERT INTO private.identidades_funcionarios_cpf (
    configuracao_usuario_id,
    auth_user_id,
    empresa_id,
    cpf_normalizado,
    auth_alias
  ) VALUES (
    v_usuario_id,
    p_auth_user_id,
    v_empresa_id,
    v_cpf,
    v_alias
  );

  INSERT INTO public.configuracoes_usuarios (
    id,
    empresa_id,
    perfil_id,
    perfil_acesso_id,
    auth_user_id,
    nome,
    email,
    login_method,
    cpf,
    telefone,
    perfil,
    status,
    access_config,
    must_change_password
  ) VALUES (
    v_usuario_id,
    v_empresa_id,
    v_membership_id,
    v_perfil_acesso_id,
    p_auth_user_id,
    v_nome,
    v_email,
    'cpf',
    v_cpf,
    v_telefone,
    v_perfil_nome,
    v_status,
    v_preparado->'access_config',
    false
  )
  RETURNING * INTO v_usuario;

  INSERT INTO public.configuracoes_eventos_logs (
    empresa_id, usuario_id, acao, modulo, tipo, detalhes
  ) VALUES (
    v_empresa_id,
    p_actor_user_id,
    'Provisionou funcionario com acesso por CPF',
    'Configuracoes',
    'Sucesso',
    pg_catalog.jsonb_build_object(
      'configuracao_usuario_id', v_usuario.id,
      'auth_user_id', p_auth_user_id,
      'perfil_acesso_id', v_perfil_acesso_id
    )
  );

  RETURN pg_catalog.to_jsonb(v_usuario)
    || pg_catalog.jsonb_build_object(
      'membership_id', v_membership_id,
      'membership_papel', 'membro'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_alias_autenticacao_funcionario_cpf(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_empresa_gestor_edge(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_provisionamento_funcionario_cpf(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provisionar_usuario_funcionario_cpf(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_alias_autenticacao_funcionario_cpf(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_empresa_gestor_edge(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_provisionamento_funcionario_cpf(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.provisionar_usuario_funcionario_cpf(uuid, uuid, jsonb)
  TO service_role;
