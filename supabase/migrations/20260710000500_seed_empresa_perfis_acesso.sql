DO $$
DECLARE
  v_empresa_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  r record;
BEGIN
  INSERT INTO public.empresas (
    id,
    nome,
    razao_social,
    cnpj,
    status
  )
  VALUES (
    v_empresa_id,
    'ARKHEN Gestão Contábil',
    'ARKHEN Gestão Contábil',
    '',
    'ativo'
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    razao_social = EXCLUDED.razao_social,
    status = EXCLUDED.status,
    updated_at = now();

  FOR r IN SELECT * FROM public.perfis_acesso_padrao()
  LOOP
    INSERT INTO public.configuracoes_perfis_acesso (
      empresa_id,
      codigo,
      nome,
      descricao,
      permissoes,
      sistema,
      ativo,
      ordem,
      created_at
    )
    VALUES (
      v_empresa_id,
      r.codigo,
      r.nome,
      r.descricao,
      r.permissoes,
      r.sistema,
      true,
      r.ordem,
      r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      permissoes = EXCLUDED.permissoes,
      sistema = true,
      ativo = true,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;
END;
$$;
