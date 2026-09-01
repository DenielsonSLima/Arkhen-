-- Mantém os indicadores do catálogo no PostgreSQL, sob o mesmo escopo e as
-- mesmas permissões da listagem canônica de obrigações.
CREATE OR REPLACE FUNCTION public.obter_resumo_obrigacoes_unificadas()
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
    RAISE EXCEPTION 'Resumo de obrigações não encontrado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'ativos', count(*) FILTER (WHERE tipo.ativo)::integer,
    'comPrazo', count(*) FILTER (
      WHERE tipo.ativo AND tipo.tem_vencimento
    )::integer,
    'etapas', COALESCE(sum(
      CASE
        WHEN tipo.ativo AND jsonb_typeof(tipo.etapas) = 'array'
          THEN jsonb_array_length(tipo.etapas)
        ELSE 0
      END
    ), 0)::integer
  )
  INTO v_resultado
  FROM public.parametrizacao_protocolos_tipos tipo
  WHERE tipo.empresa_id = v_empresa_id;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_resumo_obrigacoes_unificadas()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_resumo_obrigacoes_unificadas()
  TO authenticated;

COMMENT ON FUNCTION public.obter_resumo_obrigacoes_unificadas() IS
  'Calcula os indicadores globais do catálogo de obrigações no tenant atual.';
