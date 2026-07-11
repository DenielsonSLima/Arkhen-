CREATE OR REPLACE FUNCTION public.finalizar_cadastro_auth(p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_metadata jsonb := COALESCE(v_claims->'user_metadata', '{}'::jsonb);
  v_email text := COALESCE(NULLIF(v_claims->>'email', ''), NULLIF(p_payload->>'email', ''));
  v_nome text := COALESCE(NULLIF(BTRIM(p_payload->>'nome'), ''), NULLIF(BTRIM(v_metadata->>'nome'), ''), 'Usuário Demonstração');
  v_empresa_nome text := COALESCE(NULLIF(BTRIM(p_payload->>'empresa_nome'), ''), NULLIF(BTRIM(v_metadata->>'empresa_nome'), ''), 'Empresa Fictícia Contábil');
  v_cnpj text := COALESCE(NULLIF(BTRIM(p_payload->>'cnpj'), ''), NULLIF(BTRIM(v_metadata->>'cnpj'), ''), '12.345.678/0001-90');
  v_empresa_id uuid;
  v_perfil_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT p.empresa_id, p.id
    INTO v_empresa_id, v_perfil_id
  FROM public.perfis p
  WHERE p.user_id = v_user_id
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    INSERT INTO public.empresas (nome, razao_social, cnpj, status)
    VALUES (v_empresa_nome, v_empresa_nome, v_cnpj, 'ativo')
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.perfis (user_id, empresa_id, nome, papel, ativo)
    VALUES (v_user_id, v_empresa_id, v_nome, 'admin', true)
    RETURNING id INTO v_perfil_id;

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
      COALESCE(v_email, ''),
      '(79) 99999-0000',
      '49000-000',
      'Rua Fictícia da Contabilidade',
      '100',
      'Aracaju',
      'SE'
    )
    ON CONFLICT (empresa_id) DO NOTHING;

    INSERT INTO public.configuracoes_usuarios (
      empresa_id,
      perfil_id,
      nome,
      email,
      perfil,
      status
    )
    VALUES (
      v_empresa_id,
      v_perfil_id,
      v_nome,
      COALESCE(v_email, ''),
      'Administrador',
      'Ativo'
    )
    ON CONFLICT (empresa_id, email) DO UPDATE SET
      nome = EXCLUDED.nome,
      perfil_id = EXCLUDED.perfil_id,
      perfil = EXCLUDED.perfil,
      status = 'Ativo',
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'perfil_id', v_perfil_id,
    'nome', v_nome,
    'email', v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_cadastro_auth(jsonb) TO authenticated;
