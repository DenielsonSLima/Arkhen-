ALTER TABLE public.configuracoes_perfis_acesso
  ADD COLUMN IF NOT EXISTS codigo varchar(60),
  ADD COLUMN IF NOT EXISTS sistema boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracoes_perfis_acesso_empresa_codigo
  ON public.configuracoes_perfis_acesso(empresa_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.perfis_acesso_padrao()
RETURNS TABLE (
  id uuid,
  codigo varchar,
  nome varchar,
  descricao text,
  sistema boolean,
  permissoes text[],
  ordem integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  VALUES
    (
      '00000000-0000-0000-0000-000000000101'::uuid,
      'gestor'::varchar,
      'Gestor'::varchar,
      'Organiza a operação e visualiza todos os módulos, indicadores, configurações, equipe e financeiro do escritório.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','clientes:create','clientes:update','clientes:delete',
        'parametrizacao:view','parametrizacao:manage','agenda:view','agenda:manage',
        'atividades:view','atividades:manage','protocolos:view','protocolos:manage',
        'conformidade:view','simulacoes:view','faturamento:view','faturamento:manage',
        'financeiro:view','financeiro:manage','documentos:view','documentos:manage',
        'configuracoes:view','configuracoes:manage','usuarios:manage','perfis:manage'
      ]::text[],
      10,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000102'::uuid,
      'financeiro'::varchar,
      'Financeiro'::varchar,
      'Controla faturamento, cobranças, contas bancárias e relatórios financeiros, sem administrar usuários ou perfis.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','faturamento:view','faturamento:manage',
        'financeiro:view','financeiro:manage','documentos:view',
        'configuracoes:view','contas-bancarias:manage','integracao-bancaria:manage'
      ]::text[],
      20,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000103'::uuid,
      'funcionario'::varchar,
      'Funcionário'::varchar,
      'Acessa somente sua rotina de trabalho, atividades atribuídas, agenda, protocolos e documentos operacionais.'::text,
      true,
      ARRAY[
        'inicio:view','agenda:view','atividades:view','atividades:update-own',
        'protocolos:view','protocolos:create','documentos:view','documentos:create',
        'meu-perfil:manage'
      ]::text[],
      30,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000104'::uuid,
      'fiscal'::varchar,
      'Analista Fiscal'::varchar,
      'Atua em obrigações fiscais, conformidade, cadastros de clientes e integração fiscal, sem acesso ao financeiro do escritório.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','clientes:update','parametrizacao:view',
        'agenda:view','atividades:view','atividades:manage','protocolos:view',
        'protocolos:manage','conformidade:view','simulacoes:view',
        'documentos:view','documentos:manage','integracao-fiscal:manage'
      ]::text[],
      40,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000105'::uuid,
      'cliente'::varchar,
      'Cliente Externo'::varchar,
      'Visualiza apenas documentos, protocolos, obrigações e solicitações vinculadas à própria empresa cliente.'::text,
      true,
      ARRAY[
        'cliente-portal:view','documentos:view-own','documentos:create-own',
        'protocolos:view-own','atividades:view-own','faturamento:view-own',
        'meu-perfil:manage'
      ]::text[],
      50,
      '2026-01-01 00:00:00+00'::timestamptz
    )
$$;

CREATE OR REPLACE FUNCTION public.seed_perfis_acesso_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.is_empresa_member(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso nao autorizado.';
  END IF;

  FOR r IN SELECT * FROM public.perfis_acesso_padrao()
  LOOP
    INSERT INTO public.configuracoes_perfis_acesso (
      empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem, created_at
    )
    VALUES (
      p_empresa_id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      descricao = EXCLUDED.descricao,
      permissoes = EXCLUDED.permissoes,
      sistema = true,
      ativo = true,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_configuracoes_perfis_acesso()
RETURNS TABLE (
  id uuid,
  codigo varchar,
  nome varchar,
  descricao text,
  tipo text,
  sistema boolean,
  permissoes text[],
  usuarios_count bigint,
  data_criacao text,
  ordem integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.codigo,
      p.nome,
      p.descricao,
      'Sistema'::text,
      p.sistema,
      p.permissoes,
      0::bigint,
      to_char(p.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY')::text,
      p.ordem
    FROM public.perfis_acesso_padrao() p
    ORDER BY p.ordem, p.nome;
    RETURN;
  END IF;

  PERFORM public.seed_perfis_acesso_empresa(v_empresa_id);

  RETURN QUERY
  SELECT
    p.id,
    p.codigo,
    p.nome,
    p.descricao,
    CASE WHEN p.sistema THEN 'Sistema' ELSE 'Personalizado' END::text,
    p.sistema,
    p.permissoes,
    (
      SELECT count(*)::bigint
      FROM public.configuracoes_usuarios u
      WHERE u.empresa_id = p.empresa_id
        AND lower(u.perfil) = lower(p.nome)
    ) AS usuarios_count,
    to_char(p.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY')::text,
    p.ordem
  FROM public.configuracoes_perfis_acesso p
  WHERE p.empresa_id = v_empresa_id
    AND p.ativo = true
  ORDER BY p.ordem, p.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_perfil_acesso(
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_permissoes text[]
)
RETURNS public.configuracoes_perfis_acesso
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_perfis_acesso;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF trim(COALESCE(p_nome, '')) = '' OR trim(COALESCE(p_descricao, '')) = '' THEN
    RAISE EXCEPTION 'Nome e descricao sao obrigatorios.';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.configuracoes_perfis_acesso
    SET
      nome = CASE WHEN sistema THEN nome ELSE trim(p_nome) END,
      descricao = trim(p_descricao),
      permissoes = COALESCE(p_permissoes, permissoes),
      updated_at = now()
    WHERE id = p_id
      AND empresa_id = v_empresa_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Perfil nao encontrado.';
    END IF;

    RETURN v_row;
  END IF;

  INSERT INTO public.configuracoes_perfis_acesso (
    empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem
  )
  VALUES (
    v_empresa_id,
    'custom-' || replace(gen_random_uuid()::text, '-', ''),
    trim(p_nome),
    trim(p_descricao),
    COALESCE(p_permissoes, '{}'::text[]),
    false,
    true,
    100
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.desativar_configuracoes_perfil_acesso(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  UPDATE public.configuracoes_perfis_acesso
  SET ativo = false, updated_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa_id
    AND sistema = false;

  RETURN FOUND;
END;
$$;
