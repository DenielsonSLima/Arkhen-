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

  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem, permissoes) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10, ARRAY['inicio:view']),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20, ARRAY['clientes:view','clientes:create','clientes:update']),
      ('atividades', 'Atividades', 'Filas, rotinas, equipe e fechamentos.', 'Operação', false, 30, ARRAY['atividades:view','atividades:manage']),
      ('conformidade', 'Conformidade', 'Controle de prazos, riscos e obrigações.', 'Operação', false, 40, ARRAY['conformidade:view']),
      ('protocolos', 'Protocolos e Documentos', 'Protocolos de entrega e evidências.', 'Operação', false, 50, ARRAY['protocolos:view','protocolos:create','protocolos:manage']),
      ('simulacoes-calculos', 'Simulações e Cálculos', 'Ferramentas e cenários contábeis.', 'Tributário', false, 60, ARRAY['simulacoes:view']),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80, ARRAY['faturamento:view','faturamento:manage']),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90, ARRAY['financeiro:view','financeiro:manage']),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100, ARRAY['documentos:view','documentos:create','documentos:manage']),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110, ARRAY['agenda:view','agenda:manage']),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120, ARRAY['parametrizacao:view','parametrizacao:manage']),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130, ARRAY['configuracoes:view','configuracoes:manage','meu-perfil:manage','usuarios:manage','perfis:manage','contas-bancarias:manage','integracao-bancaria:manage','integracao-fiscal:manage'])
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.modulo,
    'nome', c.nome,
    'descricao', c.descricao,
    'categoria', c.categoria,
    'obrigatorio', c.obrigatorio,
    'habilitado',
      (CASE WHEN c.obrigatorio THEN true ELSE COALESCE(m.habilitado, true) END)
      AND EXISTS (
        SELECT 1
        FROM unnest(c.permissoes) permissao
        WHERE public.current_user_has_permission(v_empresa_id, permissao)
      ),
    'ordem', c.ordem
  ) ORDER BY c.ordem), '[]'::jsonb)
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

REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema() TO authenticated;
