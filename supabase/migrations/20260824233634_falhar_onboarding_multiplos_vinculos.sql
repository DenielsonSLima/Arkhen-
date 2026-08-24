-- Garante que cada usuario autenticado conclua o onboarding uma unica vez,
-- mesmo quando a restauracao da sessao e o listener de Auth executam juntos.
CREATE OR REPLACE FUNCTION public.finalizar_cadastro_auth(
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_metadata jsonb;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_email text;
  v_nome text;
  v_empresa_nome text;
  v_cnpj text;
  v_cpf text;
  v_telefone text;
  v_cep text;
  v_endereco text;
  v_cidade text;
  v_estado text;
  v_empresa_id uuid;
  v_perfil_id uuid;
  v_perfil_ativo boolean;
  v_empresa_status text;
  v_configuracao_usuario_id uuid;
  v_configuracao_auth_user_id uuid;
  v_vinculos_ativos integer;
  v_empresa_criada boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  v_metadata := COALESCE(v_claims->'user_metadata', '{}'::jsonb);
  v_email := LOWER(NULLIF(BTRIM(v_claims->>'email'), ''));

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Email do usuario autenticado nao encontrado.';
  END IF;

  v_nome := COALESCE(
    NULLIF(BTRIM(v_metadata->>'nome'), ''),
    NULLIF(BTRIM(v_metadata->>'name'), ''),
    NULLIF(BTRIM(v_metadata->>'full_name'), ''),
    NULLIF(BTRIM(v_payload->>'nome'), ''),
    SPLIT_PART(v_email, '@', 1)
  );
  v_empresa_nome := COALESCE(
    NULLIF(BTRIM(v_metadata->>'empresa_nome'), ''),
    NULLIF(BTRIM(v_payload->>'empresa_nome'), ''),
    'Minha Empresa'
  );
  v_cnpj := COALESCE(
    NULLIF(BTRIM(v_metadata->>'cnpj'), ''),
    NULLIF(BTRIM(v_payload->>'cnpj'), ''),
    ''
  );
  v_cpf := COALESCE(
    NULLIF(BTRIM(v_metadata->>'cpf'), ''),
    NULLIF(BTRIM(v_payload->>'cpf'), '')
  );
  v_telefone := COALESCE(
    NULLIF(BTRIM(v_metadata->>'telefone'), ''),
    NULLIF(BTRIM(v_payload->>'telefone'), '')
  );
  v_cep := COALESCE(
    NULLIF(BTRIM(v_metadata->>'cep'), ''),
    NULLIF(BTRIM(v_payload->>'cep'), ''),
    ''
  );
  v_endereco := COALESCE(
    NULLIF(BTRIM(v_metadata->>'endereco'), ''),
    NULLIF(BTRIM(v_payload->>'endereco'), ''),
    ''
  );
  v_cidade := COALESCE(
    NULLIF(BTRIM(v_metadata->>'cidade'), ''),
    NULLIF(BTRIM(v_payload->>'cidade'), ''),
    ''
  );
  v_estado := UPPER(LEFT(COALESCE(
    NULLIF(BTRIM(v_metadata->>'estado'), ''),
    NULLIF(BTRIM(v_payload->>'estado'), ''),
    ''
  ), 2));

  -- Serializa chamadas concorrentes do mesmo usuario durante login/confirmacao.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT COUNT(*)
    INTO v_vinculos_ativos
  FROM public.perfis p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.user_id = v_user_id
    AND p.ativo = true
    AND e.status = 'ativo';

  IF v_vinculos_ativos > 1 THEN
    RAISE EXCEPTION 'Usuario possui mais de um vinculo empresarial ativo.';
  END IF;

  SELECT p.empresa_id, p.id, p.ativo, e.status
    INTO v_empresa_id, v_perfil_id, v_perfil_ativo, v_empresa_status
  FROM public.perfis p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.user_id = v_user_id
  ORDER BY (p.ativo AND e.status = 'ativo') DESC, p.created_at, p.id
  LIMIT 1;

  IF v_perfil_id IS NOT NULL AND (NOT v_perfil_ativo OR v_empresa_status <> 'ativo') THEN
    RAISE EXCEPTION 'Usuario sem perfil empresarial ativo.';
  END IF;

  IF v_perfil_id IS NULL THEN
    INSERT INTO public.empresas (nome, razao_social, cnpj, status)
    VALUES (v_empresa_nome, v_empresa_nome, NULLIF(v_cnpj, ''), 'ativo')
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.perfis (user_id, empresa_id, nome, papel, ativo)
    VALUES (v_user_id, v_empresa_id, v_nome, 'admin', true)
    RETURNING id INTO v_perfil_id;

    v_empresa_criada := true;
  END IF;

  IF v_empresa_criada THEN
    INSERT INTO public.configuracoes_empresa (
      empresa_id,
      razao_social,
      nome_fantasia,
      cnpj,
      email,
      telefone,
      cep,
      endereco,
      numero,
      cidade,
      estado
    )
    VALUES (
      v_empresa_id,
      v_empresa_nome,
      v_empresa_nome,
      v_cnpj,
      v_email,
      COALESCE(v_telefone, ''),
      v_cep,
      v_endereco,
      '',
      v_cidade,
      v_estado
    )
    ON CONFLICT (empresa_id) DO UPDATE
    SET razao_social = EXCLUDED.razao_social,
        nome_fantasia = EXCLUDED.nome_fantasia,
        cnpj = EXCLUDED.cnpj,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        cep = EXCLUDED.cep,
        endereco = EXCLUDED.endereco,
        cidade = EXCLUDED.cidade,
        estado = EXCLUDED.estado,
        updated_at = now();

    INSERT INTO public.configuracoes_marca_dagua (empresa_id, habilitado)
    VALUES (v_empresa_id, false)
    ON CONFLICT (empresa_id) DO NOTHING;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.configuracoes_usuarios cu
    WHERE cu.empresa_id = v_empresa_id
      AND LOWER(BTRIM(cu.email)) = v_email
  ) > 1 THEN
    RAISE EXCEPTION 'Existem usuarios duplicados para o email autenticado.';
  END IF;

  SELECT cu.id
    INTO v_configuracao_usuario_id
  FROM public.configuracoes_usuarios cu
  WHERE cu.empresa_id = v_empresa_id
    AND cu.auth_user_id = v_user_id
  ORDER BY cu.created_at, cu.id
  LIMIT 1
  FOR UPDATE;

  IF v_configuracao_usuario_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.configuracoes_usuarios cu
      WHERE cu.empresa_id = v_empresa_id
        AND LOWER(BTRIM(cu.email)) = v_email
        AND cu.id <> v_configuracao_usuario_id
    ) THEN
      RAISE EXCEPTION 'Email autenticado ja pertence a outro usuario da empresa.';
    END IF;

    UPDATE public.configuracoes_usuarios
    SET perfil_id = v_perfil_id,
        nome = COALESCE(NULLIF(BTRIM(nome), ''), v_nome),
        email = v_email,
        cpf = COALESCE(v_cpf, cpf),
        telefone = COALESCE(v_telefone, telefone),
        updated_at = now()
    WHERE id = v_configuracao_usuario_id;
  ELSE
    SELECT cu.id, cu.auth_user_id
      INTO v_configuracao_usuario_id, v_configuracao_auth_user_id
    FROM public.configuracoes_usuarios cu
    WHERE cu.empresa_id = v_empresa_id
      AND LOWER(BTRIM(cu.email)) = v_email
    ORDER BY cu.created_at, cu.id
    LIMIT 1
    FOR UPDATE;

    IF v_configuracao_usuario_id IS NOT NULL
       AND v_configuracao_auth_user_id IS NOT NULL
       AND v_configuracao_auth_user_id <> v_user_id THEN
      RAISE EXCEPTION 'Email autenticado ja vinculado a outra conta.';
    END IF;

    IF v_configuracao_usuario_id IS NOT NULL THEN
      UPDATE public.configuracoes_usuarios
      SET perfil_id = v_perfil_id,
          auth_user_id = v_user_id,
          nome = COALESCE(NULLIF(BTRIM(nome), ''), v_nome),
          email = v_email,
          cpf = COALESCE(v_cpf, cpf),
          telefone = COALESCE(v_telefone, telefone),
          updated_at = now()
      WHERE id = v_configuracao_usuario_id
        AND (auth_user_id IS NULL OR auth_user_id = v_user_id)
      RETURNING id INTO v_configuracao_usuario_id;

      IF v_configuracao_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario operacional foi vinculado por outra sessao.';
      END IF;
    ELSE
      IF NOT v_empresa_criada THEN
        RAISE EXCEPTION 'Configuracao operacional do usuario nao encontrada.';
      END IF;

      INSERT INTO public.configuracoes_usuarios (
        empresa_id,
        perfil_id,
        auth_user_id,
        nome,
        email,
        perfil,
        status,
        cpf,
        telefone
      )
      VALUES (
        v_empresa_id,
        v_perfil_id,
        v_user_id,
        v_nome,
        v_email,
        'Administrador',
        'Ativo',
        v_cpf,
        v_telefone
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'perfil_id', v_perfil_id,
    'nome', v_nome,
    'email', v_email
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalizar_cadastro_auth(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_cadastro_auth(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalizar_cadastro_auth(jsonb) TO authenticated;

COMMENT ON FUNCTION public.finalizar_cadastro_auth(jsonb) IS
  'Conclui onboarding autenticado de forma idempotente e serializada por usuario.';
