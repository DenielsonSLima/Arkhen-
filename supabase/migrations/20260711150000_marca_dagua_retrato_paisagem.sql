-- Migration: Add portrait and landscape watermark columns, size column and update onboarding / upsert RPCs.

-- 1. Add columns to configuracoes_marca_dagua
ALTER TABLE public.configuracoes_marca_dagua
  ADD COLUMN IF NOT EXISTS file_url_paisagem text,
  ADD COLUMN IF NOT EXISTS file_url_retrato text,
  ADD COLUMN IF NOT EXISTS tamanho integer DEFAULT 35;

-- 2. Update upsert_configuracoes_marca_dagua function
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
    empresa_id, habilitado, posicao, opacidade, file_url, file_url_paisagem, file_url_retrato, tamanho
  )
  VALUES (
    v_empresa_id,
    COALESCE((p_payload->>'habilitado')::boolean, false),
    COALESCE(p_payload->>'posicao', 'centro'),
    COALESCE((p_payload->>'opacidade')::integer, 15),
    NULLIF(p_payload->>'file_url', ''),
    NULLIF(p_payload->>'file_url_paisagem', ''),
    NULLIF(p_payload->>'file_url_retrato', ''),
    COALESCE((p_payload->>'tamanho')::integer, 35)
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    habilitado = EXCLUDED.habilitado,
    posicao = EXCLUDED.posicao,
    opacidade = EXCLUDED.opacidade,
    file_url = EXCLUDED.file_url,
    file_url_paisagem = EXCLUDED.file_url_paisagem,
    file_url_retrato = EXCLUDED.file_url_retrato,
    tamanho = EXCLUDED.tamanho,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 3. Update finalizar_cadastro_auth function to support saving logo and watermarks, as well as user cpf/phone, company address, and watermark size details
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
  v_logo_url text := NULLIF(p_payload->>'logo_url', '');
  v_file_url_paisagem text := NULLIF(p_payload->>'file_url_paisagem', '');
  v_file_url_retrato text := NULLIF(p_payload->>'file_url_retrato', '');
  v_cpf text := NULLIF(p_payload->>'cpf', '');
  v_telefone text := NULLIF(p_payload->>'telefone', '');
  
  -- Address fields
  v_cep text := COALESCE(NULLIF(p_payload->>'cep', ''), '49000-000');
  v_endereco text := COALESCE(NULLIF(p_payload->>'endereco', ''), 'Rua Fictícia da Contabilidade');
  v_cidade text := COALESCE(NULLIF(p_payload->>'cidade', ''), 'Aracaju');
  v_estado text := COALESCE(NULLIF(p_payload->>'estado', ''), 'SE');
  
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

    -- Insert configurations with logo_url and address
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
      estado,
      logo_url
    )
    VALUES (
      v_empresa_id,
      v_empresa_nome,
      v_empresa_nome,
      v_cnpj,
      COALESCE(v_email, ''),
      COALESCE(v_telefone, '(79) 99999-0000'),
      v_cep,
      v_endereco,
      '100',
      v_cidade,
      v_estado,
      v_logo_url
    )
    ON CONFLICT (empresa_id) DO UPDATE SET
      logo_url = COALESCE(v_logo_url, configuracoes_empresa.logo_url),
      cep = COALESCE(EXCLUDED.cep, configuracoes_empresa.cep),
      endereco = COALESCE(EXCLUDED.endereco, configuracoes_empresa.endereco),
      cidade = COALESCE(EXCLUDED.cidade, configuracoes_empresa.cidade),
      estado = COALESCE(EXCLUDED.estado, configuracoes_empresa.estado);

    -- Insert configurations with watermarks
    INSERT INTO public.configuracoes_marca_dagua (
      empresa_id,
      habilitado,
      posicao,
      opacidade,
      file_url_paisagem,
      file_url_retrato,
      tamanho
    )
    VALUES (
      v_empresa_id,
      true,
      'centro',
      15,
      v_file_url_paisagem,
      v_file_url_retrato,
      35
    )
    ON CONFLICT (empresa_id) DO UPDATE SET
      file_url_paisagem = COALESCE(v_file_url_paisagem, configuracoes_marca_dagua.file_url_paisagem),
      file_url_retrato = COALESCE(v_file_url_retrato, configuracoes_marca_dagua.file_url_retrato);

    INSERT INTO public.configuracoes_usuarios (
      empresa_id,
      perfil_id,
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
      v_nome,
      COALESCE(v_email, ''),
      'Administrador',
      'Ativo',
      v_cpf,
      v_telefone
    )
    ON CONFLICT (empresa_id, email) DO UPDATE SET
      nome = EXCLUDED.nome,
      perfil_id = EXCLUDED.perfil_id,
      perfil = EXCLUDED.perfil,
      status = 'Ativo',
      cpf = COALESCE(EXCLUDED.cpf, configuracoes_usuarios.cpf),
      telefone = COALESCE(EXCLUDED.telefone, configuracoes_usuarios.telefone),
      updated_at = now();
  ELSE
    -- If company already exists, update logo, address and watermarks if passed
    UPDATE public.configuracoes_empresa
    SET 
      logo_url = COALESCE(v_logo_url, logo_url),
      cep = CASE WHEN v_cep <> '49000-000' THEN v_cep ELSE cep END,
      endereco = CASE WHEN v_endereco <> 'Rua Fictícia da Contabilidade' THEN v_endereco ELSE endereco END,
      cidade = CASE WHEN v_cidade <> 'Aracaju' THEN v_cidade ELSE cidade END,
      estado = CASE WHEN v_estado <> 'SE' THEN v_estado ELSE estado END
    WHERE empresa_id = v_empresa_id;

    IF v_file_url_paisagem IS NOT NULL OR v_file_url_retrato IS NOT NULL THEN
      INSERT INTO public.configuracoes_marca_dagua (
        empresa_id, habilitado, posicao, opacidade, file_url_paisagem, file_url_retrato, tamanho
      )
      VALUES (v_empresa_id, true, 'centro', 15, v_file_url_paisagem, v_file_url_retrato, 35)
      ON CONFLICT (empresa_id) DO UPDATE SET
        file_url_paisagem = COALESCE(EXCLUDED.file_url_paisagem, configuracoes_marca_dagua.file_url_paisagem),
        file_url_retrato = COALESCE(EXCLUDED.file_url_retrato, configuracoes_marca_dagua.file_url_retrato);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'perfil_id', v_perfil_id,
    'nome', v_nome,
    'email', v_email
  );
END;
$$;

-- 4. Update storage insert policy to allow unauthenticated (public) inserts for onboarding uploads
DROP POLICY IF EXISTS app_assets_insert_policy ON storage.objects;
CREATE POLICY app_assets_insert_policy ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'app-assets');
