-- Reviewed production definitions captured before removal, for regression fixtures only.
CREATE OR REPLACE FUNCTION public.listar_configuracoes_modulos_sistema()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_modulos jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id) THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;
  WITH catalogo(modulo, nome, descricao, categoria, obrigatorio, ordem, permissoes) AS (
    VALUES
      ('inicio', 'Início', 'Painel principal e atalhos do escritório.', 'Essencial', true, 10, ARRAY['inicio:view']),
      ('clientes', 'Clientes', 'Cadastro e gestão da carteira de empresas.', 'Essencial', true, 20, ARRAY['clientes:view','clientes:create','clientes:update']),
      ('atividades', 'Atividades', 'Filas, equipe, rotinas, prazos e riscos.', 'Operação', false, 30, ARRAY['atividades:view','atividades:view-own','atividades:manage']),
      ('protocolos', 'Acompanhamento', 'Histórico mensal, evidências e entregas por empresa.', 'Operação', false, 50, ARRAY['protocolos:view','protocolos:create','protocolos:manage']),
      ('simulacoes-calculos', 'Simulações', 'Calculadora de Rescisão.', 'Trabalhista', false, 60, ARRAY['simulacoes:view']),
      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
      ('faturamento', 'Faturamento', 'Contratos, cobranças e recebimentos.', 'Financeiro', false, 80, ARRAY['faturamento:view','faturamento:manage']),
      ('financeiro', 'Financeiro', 'Caixa, contas a pagar e movimentações.', 'Financeiro', false, 90, ARRAY['financeiro:view','financeiro:manage']),
      ('documentos', 'Documentos', 'Biblioteca e arquivos dos clientes.', 'Documentos', false, 100, ARRAY['documentos:view','documentos:view-own','documentos:create','documentos:create-own','documentos:manage']),
      ('agenda', 'Agenda', 'Prazos, compromissos e datas do escritório.', 'Operação', false, 110, ARRAY['agenda:view','agenda:view-own','agenda:manage']),
      ('parametrizacao', 'Parametrização', 'Catálogos, impostos e regras operacionais.', 'Administração', false, 120, ARRAY['parametrizacao:view','parametrizacao:manage']),
      ('configuracoes', 'Configurações', 'Empresa, usuários, permissões e integrações.', 'Essencial', true, 130, ARRAY['configuracoes:view','configuracoes:manage','meu-perfil:manage','usuarios:manage','perfis:manage','contas-bancarias:manage','integracao-bancaria:manage','integracao-fiscal:manage'])
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', catalogo.modulo, 'nome', catalogo.nome,
    'descricao', catalogo.descricao, 'categoria', catalogo.categoria,
    'obrigatorio', catalogo.obrigatorio,
    'habilitado', (CASE WHEN catalogo.obrigatorio THEN true
      ELSE coalesce(configuracao.habilitado, true) END)
      AND EXISTS (SELECT 1 FROM pg_catalog.unnest(catalogo.permissoes) permissao
        WHERE public.current_user_has_permission(v_empresa_id, permissao)),
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
$function$
;
CREATE OR REPLACE FUNCTION public.modulo_sistema_habilitado(p_modulo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR public.current_empresa_id() IS NULL
      OR NOT public.current_user_access_allowed(public.current_empresa_id()) THEN false
    WHEN p_modulo IN ('inicio', 'clientes', 'configuracoes') THEN true
    WHEN p_modulo NOT IN (
      'atividades', 'protocolos', 'simulacoes-calculos', 'reforma-tributaria',
      'faturamento', 'financeiro', 'documentos', 'agenda', 'parametrizacao'
    ) THEN false
    ELSE coalesce((SELECT modulo.habilitado
      FROM public.configuracoes_modulos_sistema modulo
      WHERE modulo.empresa_id = public.current_empresa_id()
        AND modulo.modulo = p_modulo), true)
  END;
$function$
;
CREATE OR REPLACE FUNCTION public.salvar_configuracoes_modulos_sistema(p_modulos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_item jsonb; v_modulo text; v_habilitado boolean; v_anterior boolean;
  v_permitidos constant text[] := ARRAY[
    'atividades', 'protocolos', 'simulacoes-calculos', 'reforma-tributaria',
    'faturamento', 'financeiro', 'documentos', 'agenda', 'parametrizacao'
  ];
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id)
     OR NOT public.configuracoes_modulos_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode alterar os modulos.'
      USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(coalesce(p_modulos, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_modulos) > 9 THEN
    RAISE EXCEPTION 'A lista de modulos é inválida.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_modulos)
  LOOP
    v_modulo := nullif(trim(v_item ->> 'id'), '');
    IF v_modulo IS NULL OR NOT (v_modulo = ANY(v_permitidos))
       OR jsonb_typeof(v_item -> 'habilitado') <> 'boolean' THEN
      RAISE EXCEPTION 'Modulo inválido ou obrigatório: %', coalesce(v_modulo, '(vazio)')
        USING ERRCODE = '22023';
    END IF;
    v_habilitado := (v_item ->> 'habilitado')::boolean;
    SELECT modulo.habilitado INTO v_anterior
      FROM public.configuracoes_modulos_sistema modulo
      WHERE modulo.empresa_id = v_empresa_id AND modulo.modulo = v_modulo;
    v_anterior := coalesce(v_anterior, true);
    INSERT INTO public.configuracoes_modulos_sistema
      (empresa_id, modulo, habilitado, atualizado_por)
    VALUES (v_empresa_id, v_modulo, v_habilitado, auth.uid())
    ON CONFLICT (empresa_id, modulo) DO UPDATE SET
      habilitado = excluded.habilitado,
      atualizado_por = auth.uid(), updated_at = now();
    IF v_anterior IS DISTINCT FROM v_habilitado THEN
      INSERT INTO public.configuracoes_modulos_auditoria
        (empresa_id, modulo, habilitado_anterior, habilitado_novo, alterado_por)
      VALUES (v_empresa_id, v_modulo, v_anterior, v_habilitado, auth.uid());
    END IF;
  END LOOP;
  RETURN public.listar_configuracoes_modulos_sistema();
END;
$function$
;