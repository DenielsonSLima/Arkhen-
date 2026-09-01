CREATE OR REPLACE FUNCTION public.listar_obrigacoes_unificadas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'parametrizacao:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Obrigações não encontradas.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tipo.id::text,
    'codigo', tipo.codigo,
    'nome', tipo.nome,
    'categoria', tipo.categoria,
    'orgao', COALESCE(tipo.orgao, ''),
    'descricao', COALESCE(tipo.descricao, ''),
    'regimes', to_jsonb(tipo.regimes),
    'periodicidade', tipo.periodicidade_padrao,
    'origemPadrao', CASE tipo.origem_padrao
      WHEN 'cliente' THEN 'Cliente envia'
      WHEN 'escritorio' THEN 'Escritório envia'
      WHEN 'ambos' THEN 'Ambos'
      ELSE tipo.origem_padrao
    END,
    'temVencimento', tipo.tem_vencimento,
    'diaVencimento', tipo.dia_limite,
    'diaSemana', tipo.dia_semana_iso,
    'mesVencimento', tipo.mes_vencimento,
    'dataVencimento', to_char(tipo.data_vencimento, 'YYYY-MM-DD'),
    'referenciaMesAnterior', tipo.referencia_mes_anterior,
    'diaPrimeiraQuinzena', tipo.dia_vencimento_primeira_quinzena,
    'diaSegundaQuinzena', tipo.dia_vencimento_segunda_quinzena,
    'etapas', tipo.etapas,
    'ativo', tipo.ativo,
    'ordem', tipo.ordem,
    'atualizadoEm', tipo.atualizado_em::text
  ) ORDER BY tipo.ativo DESC, tipo.ordem, tipo.nome, tipo.codigo), '[]'::jsonb)
  INTO v_resultado
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = v_empresa_id;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_obrigacoes_unificadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_obrigacoes_unificadas() TO authenticated;
