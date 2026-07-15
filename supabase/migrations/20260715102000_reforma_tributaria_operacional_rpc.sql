-- Operacao da carteira, adequacao e checklist do modulo RTC.
CREATE OR REPLACE FUNCTION public.reforma_tributaria_tem_permissao(p_permissao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH contexto AS (SELECT public.current_empresa_id() AS empresa_id, auth.uid() AS usuario_id,
    lower(COALESCE(auth.jwt()->>'email', '')) AS email)
  SELECT EXISTS (
    SELECT 1
    FROM contexto x
    JOIN public.perfis p ON p.user_id = x.usuario_id AND p.empresa_id = x.empresa_id
    WHERE p.ativo = true AND p.papel = 'admin'
  ) OR EXISTS (
    SELECT 1
    FROM contexto x
    JOIN public.configuracoes_usuarios u
      ON u.empresa_id = x.empresa_id
      AND u.status = 'Ativo'
      AND (u.auth_user_id = x.usuario_id OR lower(u.email) = x.email)
    JOIN public.configuracoes_perfis_acesso pa
      ON pa.empresa_id = x.empresa_id AND pa.ativo = true AND lower(pa.nome) = lower(u.perfil)
    WHERE p_permissao = ANY(pa.permissoes)
      OR (p_permissao = 'reforma-tributaria:view' AND 'reforma-tributaria:manage' = ANY(pa.permissoes))
  );
$$;
CREATE OR REPLACE FUNCTION public.reforma_tributaria_cliente_autorizado(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.empresa_id = public.current_empresa_id()
      AND public.is_empresa_member(c.empresa_id)
      AND public.modulo_sistema_habilitado('reforma-tributaria')
  );
$$;
CREATE OR REPLACE FUNCTION public.reforma_tributaria_status_checklist(p_checklist jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE((p_checklist->>'emissor_atualizado')::boolean, false)
      AND COALESCE((p_checklist->>'cadastros_revisados')::boolean, false)
      AND COALESCE((p_checklist->>'cst_configurado')::boolean, false)
      AND COALESCE((p_checklist->>'classificacao_configurada')::boolean, false)
      AND COALESCE((p_checklist->>'aliquotas_configuradas')::boolean, false)
      AND COALESCE((p_checklist->>'totalizadores_configurados')::boolean, false)
      AND COALESCE((p_checklist->>'xml_emitido')::boolean, false)
      AND COALESCE((p_checklist->>'xml_validado')::boolean, false)
      THEN 'adequado'
    WHEN EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(p_checklist, '{}'::jsonb)) e WHERE e.value = 'true')
      THEN 'em_configuracao'
    ELSE 'nao_iniciado'
  END;
$$;
CREATE OR REPLACE FUNCTION public.listar_reforma_tributaria_painel()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.is_empresa_member(v_empresa_id)
    OR NOT public.modulo_sistema_habilitado('reforma-tributaria')
    OR NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:view') THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;
  WITH base AS (
    SELECT
      c.id,
      COALESCE(NULLIF(c.razao_social, ''), c.nome) AS nome,
      c.cnpj,
      c.tipo AS regime,
      COALESCE(c.cnae, '') AS cnae,
      COALESCE(c.cnae_descricao, '') AS cnae_descricao,
      COALESCE(a.status, CASE WHEN c.tipo IN ('PF', 'MEI', 'Isenta') THEN 'nao_aplicavel' ELSE 'nao_iniciado' END) AS status,
      COALESCE(a.emissor, '') AS emissor,
      COALESCE(a.ambiente, 'homologacao') AS ambiente,
      COALESCE(a.tipos_documentos, '{}') AS tipos_documentos,
      COALESCE(a.responsavel, '') AS responsavel,
      COALESCE(a.prazo, CASE WHEN c.tipo = 'Simples Nacional' THEN '2026-09-30'::date ELSE '2026-08-03'::date END) AS prazo,
      COALESCE(a.checklist, '{}'::jsonb) AS checklist,
      COALESCE(a.observacoes, '') AS observacoes,
      a.updated_at,
      vx.resultado AS ultima_validacao_resultado,
      vx.created_at AS ultima_validacao_em,
      sx.created_at AS ultima_simulacao_em,
      dx.decisao AS ultima_decisao
    FROM public.clientes c
    LEFT JOIN public.reforma_tributaria_adequacoes a
      ON a.empresa_id = v_empresa_id AND a.cliente_id = c.id
    LEFT JOIN LATERAL (
      SELECT v.resultado, v.created_at
      FROM public.reforma_tributaria_validacoes_xml v
      WHERE v.empresa_id = v_empresa_id AND v.cliente_id = c.id
      ORDER BY v.created_at DESC LIMIT 1
    ) vx ON true
    LEFT JOIN LATERAL (
      SELECT s.created_at
      FROM public.reforma_tributaria_simulacoes s
      WHERE s.empresa_id = v_empresa_id AND s.cliente_id = c.id AND s.tipo = 'ibs_cbs'
      ORDER BY s.created_at DESC LIMIT 1
    ) sx ON true
    LEFT JOIN LATERAL (
      SELECT d.decisao
      FROM public.reforma_tributaria_decisoes d
      WHERE d.empresa_id = v_empresa_id AND d.cliente_id = c.id
      ORDER BY d.created_at DESC LIMIT 1
    ) dx ON true
    WHERE c.empresa_id = v_empresa_id AND c.status = 'Ativa'
  )
  SELECT jsonb_build_object(
    'podeGerenciar', public.reforma_tributaria_tem_permissao('reforma-tributaria:manage'),
    'metricas', jsonb_build_object(
      'total', count(*),
      'adequados', count(*) FILTER (WHERE status = 'adequado'),
      'emRisco', count(*) FILTER (WHERE status IN ('nao_iniciado', 'xml_inconsistente')),
      'aguardandoXml', count(*) FILTER (WHERE status = 'aguardando_xml'),
      'simulacoesPendentes', count(*) FILTER (
        WHERE regime = 'Simples Nacional' AND ultima_simulacao_em IS NULL
      ),
      'diasAteObrigatoriedade', GREATEST('2026-08-03'::date - CURRENT_DATE, 0),
      'diasAteOpcaoSimples', GREATEST('2026-09-30'::date - CURRENT_DATE, 0)
    ),
    'clientes', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'nome', nome,
      'cnpj', cnpj,
      'regime', regime,
      'cnae', cnae,
      'cnaeDescricao', cnae_descricao,
      'status', status,
      'emissor', emissor,
      'ambiente', ambiente,
      'tiposDocumentos', tipos_documentos,
      'responsavel', responsavel,
      'prazo', prazo,
      'checklist', checklist,
      'observacoes', observacoes,
      'atualizadoEm', updated_at,
      'ultimaValidacaoResultado', ultima_validacao_resultado,
      'ultimaValidacaoEm', ultima_validacao_em,
      'ultimaSimulacaoEm', ultima_simulacao_em,
      'ultimaDecisao', ultima_decisao
    ) ORDER BY
      CASE status WHEN 'xml_inconsistente' THEN 1 WHEN 'nao_iniciado' THEN 2 WHEN 'aguardando_xml' THEN 3 ELSE 4 END,
      nome), '[]'::jsonb)
  ) INTO v_result
  FROM base;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.salvar_reforma_tributaria_adequacao(
  p_cliente_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_status text;
  v_status_atual text;
  v_regime text;
  v_checklist jsonb;
  v_ambiente text := COALESCE(NULLIF(p_payload->>'ambiente', ''), 'homologacao');
  v_tipos text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'tiposDocumentos', '[]'::jsonb)));
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN
    RAISE EXCEPTION 'Permissao de gerenciamento da Reforma Tributaria necessaria.';
  END IF;
  IF v_ambiente NOT IN ('homologacao', 'producao') THEN
    RAISE EXCEPTION 'Ambiente fiscal invalido.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_tipos) t
    WHERE t NOT IN ('nfe', 'nfce', 'nfse', 'cte', 'mdfe')
  ) THEN
    RAISE EXCEPTION 'Tipo de documento fiscal invalido.';
  END IF;
  IF length(COALESCE(p_payload->>'emissor', '')) > 160
    OR length(COALESCE(p_payload->>'responsavel', '')) > 160
    OR length(COALESCE(p_payload->>'observacoes', '')) > 4000 THEN
    RAISE EXCEPTION 'Um dos campos excede o limite permitido.';
  END IF;
  SELECT c.tipo, a.status, COALESCE(a.checklist, '{}'::jsonb)
  INTO v_regime, v_status_atual, v_checklist
  FROM public.clientes c
  LEFT JOIN public.reforma_tributaria_adequacoes a
    ON a.empresa_id = v_empresa_id AND a.cliente_id = c.id
  WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa_id;
  v_status := CASE
    WHEN v_regime IN ('PF', 'MEI', 'Isenta') THEN 'nao_aplicavel'
    WHEN v_status_atual = 'xml_inconsistente'
      AND NOT COALESCE((v_checklist->>'xml_validado')::boolean, false) THEN 'xml_inconsistente'
    ELSE public.reforma_tributaria_status_checklist(v_checklist)
  END;
  INSERT INTO public.reforma_tributaria_adequacoes (
    empresa_id, cliente_id, status, emissor, ambiente, tipos_documentos,
    responsavel, prazo, observacoes, atualizado_por
  ) VALUES (
    v_empresa_id,
    p_cliente_id,
    v_status,
    COALESCE(p_payload->>'emissor', ''),
    v_ambiente,
    v_tipos,
    COALESCE(p_payload->>'responsavel', ''),
    COALESCE(NULLIF(p_payload->>'prazo', '')::date, '2026-08-03'::date),
    COALESCE(p_payload->>'observacoes', ''),
    auth.uid()
  )
  ON CONFLICT (empresa_id, cliente_id) DO UPDATE SET
    status = EXCLUDED.status,
    emissor = EXCLUDED.emissor,
    ambiente = EXCLUDED.ambiente,
    tipos_documentos = EXCLUDED.tipos_documentos,
    responsavel = EXCLUDED.responsavel,
    prazo = EXCLUDED.prazo,
    observacoes = EXCLUDED.observacoes,
    atualizado_por = auth.uid(),
    updated_at = now();
END;
$$;
CREATE OR REPLACE FUNCTION public.atualizar_reforma_tributaria_checklist(
  p_cliente_id uuid,
  p_item text,
  p_concluido boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_checklist jsonb;
  v_status text;
  v_itens constant text[] := ARRAY[
    'emissor_atualizado', 'cadastros_revisados', 'cst_configurado',
    'classificacao_configurada', 'aliquotas_configuradas',
    'totalizadores_configurados', 'xml_emitido', 'xml_validado'
  ];
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN
    RAISE EXCEPTION 'Permissao de gerenciamento da Reforma Tributaria necessaria.';
  END IF;
  IF NOT (p_item = ANY(v_itens)) THEN
    RAISE EXCEPTION 'Item de checklist invalido.';
  END IF;
  IF p_item IN ('xml_emitido', 'xml_validado') THEN
    RAISE EXCEPTION 'Evidencias de XML somente podem ser atualizadas pelo validador.';
  END IF;
  INSERT INTO public.reforma_tributaria_adequacoes (empresa_id, cliente_id, atualizado_por)
  VALUES (v_empresa_id, p_cliente_id, auth.uid())
  ON CONFLICT (empresa_id, cliente_id) DO NOTHING;
  SELECT jsonb_set(a.checklist, ARRAY[p_item], to_jsonb(COALESCE(p_concluido, false)), true)
  INTO v_checklist
  FROM public.reforma_tributaria_adequacoes a
  WHERE a.empresa_id = v_empresa_id AND a.cliente_id = p_cliente_id;
  v_status := public.reforma_tributaria_status_checklist(v_checklist);
  UPDATE public.reforma_tributaria_adequacoes
  SET checklist = v_checklist,
      status = v_status,
      atualizado_por = auth.uid(),
      updated_at = now()
  WHERE empresa_id = v_empresa_id AND cliente_id = p_cliente_id;
  RETURN v_status;
END;
$$;
