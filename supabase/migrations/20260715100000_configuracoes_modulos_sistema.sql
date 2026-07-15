-- Habilitacao de modulos por escritorio. A ausencia de override mantém o
-- modulo habilitado, preservando o comportamento dos tenants existentes.

CREATE TABLE IF NOT EXISTS public.configuracoes_modulos_sistema (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo text NOT NULL CHECK (modulo IN (
    'inicio', 'clientes', 'atividades', 'conformidade', 'protocolos',
    'simulacoes-calculos', 'reforma-tributaria', 'faturamento', 'financeiro',
    'documentos', 'agenda', 'parametrizacao', 'configuracoes'
  )),
  habilitado boolean NOT NULL DEFAULT true,
  atualizado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, modulo)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_modulos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  habilitado_anterior boolean,
  habilitado_novo boolean NOT NULL,
  alterado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_modulos_auditoria_empresa_data
  ON public.configuracoes_modulos_auditoria (empresa_id, created_at DESC);

DROP TRIGGER IF EXISTS set_configuracoes_modulos_sistema_updated_at ON public.configuracoes_modulos_sistema;
CREATE TRIGGER set_configuracoes_modulos_sistema_updated_at
  BEFORE UPDATE ON public.configuracoes_modulos_sistema
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.configuracoes_modulos_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_modulos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.configuracoes_modulos_can_manage()
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
      AND p.empresa_id = public.current_empresa_id()
      AND p.ativo = true
      AND p.papel IN ('admin', 'contador')
  )
  OR EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios u
    WHERE u.empresa_id = public.current_empresa_id()
      AND u.auth_user_id = auth.uid()
      AND u.status = 'Ativo'
      AND lower(u.perfil) IN ('gestor', 'administrador')
  );
$$;

DROP POLICY IF EXISTS configuracoes_modulos_select_tenant ON public.configuracoes_modulos_sistema;
CREATE POLICY configuracoes_modulos_select_tenant
  ON public.configuracoes_modulos_sistema FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS configuracoes_modulos_auditoria_select_tenant ON public.configuracoes_modulos_auditoria;
CREATE POLICY configuracoes_modulos_auditoria_select_tenant
  ON public.configuracoes_modulos_auditoria FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

REVOKE INSERT, UPDATE, DELETE ON public.configuracoes_modulos_sistema FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.configuracoes_modulos_auditoria FROM authenticated, anon;
GRANT SELECT ON public.configuracoes_modulos_sistema TO authenticated;
GRANT SELECT ON public.configuracoes_modulos_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.modulo_sistema_habilitado(p_modulo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_modulo IN ('inicio', 'clientes', 'configuracoes') THEN true
    WHEN p_modulo NOT IN (
      'atividades', 'conformidade', 'protocolos', 'simulacoes-calculos',
      'reforma-tributaria', 'faturamento', 'financeiro', 'documentos',
      'agenda', 'parametrizacao'
    ) THEN false
    ELSE COALESCE((
      SELECT m.habilitado
      FROM public.configuracoes_modulos_sistema m
      WHERE m.empresa_id = public.current_empresa_id()
        AND m.modulo = p_modulo
    ), true)
  END;
$$;

CREATE OR REPLACE FUNCTION public.listar_configuracoes_modulos_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_modulos jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.is_empresa_member(v_empresa_id) THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20),
      ('atividades', 'Atividades', 'Filas, rotinas, equipe e fechamentos.', 'Operação', false, 30),
      ('conformidade', 'Conformidade', 'Controle de prazos, riscos e obrigações.', 'Operação', false, 40),
      ('protocolos', 'Protocolos e Documentos', 'Protocolos de entrega e evidências.', 'Operação', false, 50),
      ('simulacoes-calculos', 'Simulações e Cálculos', 'Ferramentas e cenários contábeis.', 'Tributário', false, 60),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.modulo,
      'nome', c.nome,
      'descricao', c.descricao,
      'categoria', c.categoria,
      'obrigatorio', c.obrigatorio,
      'habilitado', CASE WHEN c.obrigatorio THEN true ELSE COALESCE(m.habilitado, true) END,
      'ordem', c.ordem
    ) ORDER BY c.ordem
  ), '[]'::jsonb)
  INTO v_modulos
  FROM catalogo c
  LEFT JOIN public.configuracoes_modulos_sistema m
    ON m.empresa_id = v_empresa_id AND m.modulo = c.modulo;

  RETURN jsonb_build_object(
    'canManage', public.configuracoes_modulos_can_manage(),
    'modulos', v_modulos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_modulos_sistema(p_modulos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_item jsonb;
  v_modulo text;
  v_habilitado boolean;
  v_anterior boolean;
  v_permitidos constant text[] := ARRAY[
    'atividades', 'conformidade', 'protocolos', 'simulacoes-calculos',
    'reforma-tributaria', 'faturamento', 'financeiro', 'documentos',
    'agenda', 'parametrizacao'
  ];
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode alterar os modulos do sistema.';
  END IF;
  IF jsonb_typeof(COALESCE(p_modulos, 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'A lista de modulos deve ser um array.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_modulos)
  LOOP
    v_modulo := NULLIF(trim(v_item->>'id'), '');
    IF v_modulo IS NULL OR NOT (v_modulo = ANY(v_permitidos)) THEN
      RAISE EXCEPTION 'Modulo invalido ou obrigatorio: %', COALESCE(v_modulo, '(vazio)');
    END IF;
    IF jsonb_typeof(v_item->'habilitado') <> 'boolean' THEN
      RAISE EXCEPTION 'Estado invalido para o modulo %.', v_modulo;
    END IF;
    v_habilitado := (v_item->>'habilitado')::boolean;

    SELECT m.habilitado INTO v_anterior
    FROM public.configuracoes_modulos_sistema m
    WHERE m.empresa_id = v_empresa_id AND m.modulo = v_modulo;
    v_anterior := COALESCE(v_anterior, true);

    INSERT INTO public.configuracoes_modulos_sistema
      (empresa_id, modulo, habilitado, atualizado_por)
    VALUES (v_empresa_id, v_modulo, v_habilitado, auth.uid())
    ON CONFLICT (empresa_id, modulo) DO UPDATE SET
      habilitado = EXCLUDED.habilitado,
      atualizado_por = auth.uid(),
      updated_at = now();

    IF v_anterior IS DISTINCT FROM v_habilitado THEN
      INSERT INTO public.configuracoes_modulos_auditoria
        (empresa_id, modulo, habilitado_anterior, habilitado_novo, alterado_por)
      VALUES (v_empresa_id, v_modulo, v_anterior, v_habilitado, auth.uid());
    END IF;
  END LOOP;

  RETURN public.listar_configuracoes_modulos_sistema();
END;
$$;

REVOKE ALL ON FUNCTION public.configuracoes_modulos_can_manage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.modulo_sistema_habilitado(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_configuracoes_modulos_sistema(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configuracoes_modulos_can_manage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.modulo_sistema_habilitado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_configuracoes_modulos_sistema(jsonb) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_modulos_sistema'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_modulos_sistema;
  END IF;
END;
$$;
