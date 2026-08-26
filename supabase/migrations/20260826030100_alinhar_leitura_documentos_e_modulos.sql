-- Alinha a leitura de documentos ao RBAC real e só exibe Conformidade quando
-- o perfil também consegue ler a fonte operacional de Atividades.
BEGIN;

DROP POLICY IF EXISTS documentos_select_policy ON public.documentos;
DROP POLICY IF EXISTS documentos_select_permission ON public.documentos;

CREATE POLICY documentos_select_permission ON public.documentos
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND (
      (
        (
          public.current_user_has_permission(empresa_id, 'documentos:view')
          OR public.current_user_has_permission(empresa_id, 'documentos:manage')
        )
        AND (
          (scope = 'pessoal' AND owner_user_id = (SELECT auth.uid()))
          OR (
            scope = 'empresa'
            AND public.current_user_can_access_client_row(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:view-own')
        AND (
          (scope = 'pessoal' AND owner_user_id = (SELECT auth.uid()))
          OR (
            scope = 'empresa'
            AND cliente_id IS NOT NULL
            AND public.current_user_is_client_scoped(empresa_id)
            AND public.current_user_has_client_access(empresa_id, cliente_id)
          )
        )
      )
      OR (
        public.current_user_has_permission(empresa_id, 'documentos:create')
        AND owner_user_id = (SELECT auth.uid())
        AND (
          scope = 'pessoal'
          OR (
            scope = 'empresa'
            AND public.current_user_can_access_client_row(empresa_id, cliente_id)
          )
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.listar_configuracoes_modulos_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_modulos jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id) THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;

  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem, permissoes) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10, ARRAY['inicio:view']),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20, ARRAY['clientes:view','clientes:create','clientes:update']),
      ('atividades', 'Atividades', 'Filas, rotinas, equipe e fechamentos.', 'Operação', false, 30, ARRAY['atividades:view','atividades:view-own','atividades:manage']),
      ('conformidade', 'Conformidade', 'Controle de prazos, riscos e obrigações.', 'Operação', false, 40, ARRAY['conformidade:view']),
      ('protocolos', 'Protocolos e Documentos', 'Protocolos de entrega e evidências.', 'Operação', false, 50, ARRAY['protocolos:view','protocolos:create','protocolos:manage']),
      ('simulacoes-calculos', 'Simulações e Cálculos', 'Ferramentas e cenários contábeis.', 'Tributário', false, 60, ARRAY['simulacoes:view']),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80, ARRAY['faturamento:view','faturamento:manage']),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90, ARRAY['financeiro:view','financeiro:manage']),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100, ARRAY['documentos:view','documentos:view-own','documentos:create','documentos:create-own','documentos:manage']),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110, ARRAY['agenda:view','agenda:view-own','agenda:manage']),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120, ARRAY['parametrizacao:view','parametrizacao:manage']),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130, ARRAY['configuracoes:view','configuracoes:manage','meu-perfil:manage','usuarios:manage','perfis:manage','contas-bancarias:manage','integracao-bancaria:manage','integracao-fiscal:manage'])
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', catalogo.modulo,
    'nome', catalogo.nome,
    'descricao', catalogo.descricao,
    'categoria', catalogo.categoria,
    'obrigatorio', catalogo.obrigatorio,
    'habilitado',
      (CASE
        WHEN catalogo.obrigatorio THEN true
        ELSE COALESCE(configuracao.habilitado, true)
      END)
      AND CASE
        WHEN catalogo.modulo = 'conformidade' THEN
          public.current_user_has_permission(v_empresa_id, 'conformidade:view')
          AND (
            public.current_user_has_permission(v_empresa_id, 'atividades:manage')
            OR public.current_user_has_permission(v_empresa_id, 'atividades:view')
            OR public.current_user_has_permission(v_empresa_id, 'atividades:view-own')
          )
        ELSE EXISTS (
          SELECT 1
          FROM unnest(catalogo.permissoes) permissao
          WHERE public.current_user_has_permission(v_empresa_id, permissao)
        )
      END,
    'ordem', catalogo.ordem
  ) ORDER BY catalogo.ordem), '[]'::jsonb)
  INTO v_modulos
  FROM catalogo
  LEFT JOIN public.configuracoes_modulos_sistema configuracao
    ON configuracao.empresa_id = v_empresa_id
   AND configuracao.modulo = catalogo.modulo;

  RETURN jsonb_build_object(
    'canManage', public.configuracoes_modulos_can_manage(),
    'modulos', v_modulos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema()
  TO authenticated;

COMMIT;
