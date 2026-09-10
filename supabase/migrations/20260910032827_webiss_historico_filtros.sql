-- Filtros do histórico fiscal aplicados no servidor. Mantém chamadas antigas por defaults.
BEGIN;
DROP FUNCTION public.listar_faturamento_nfse_webiss(text,text,text);
CREATE FUNCTION public.listar_faturamento_nfse_webiss(
  p_ambiente text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT '',
  p_fiscal_config_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_data_inicial date DEFAULT NULL,
  p_data_final date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_data_inicial IS NOT NULL AND p_data_final IS NOT NULL AND p_data_inicial>p_data_final THEN
    RAISE EXCEPTION 'Periodo fiscal invalido: data inicial posterior a final.';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(row ORDER BY coalesce(row->>'emissao',row->>'updatedAt')::timestamptz DESC),'[]'::jsonb)
    FROM app_private.webiss_historico(public.current_empresa_id()) row
    WHERE (p_ambiente IS NULL OR row->>'ambiente'=p_ambiente)
      AND (p_status IS NULL OR row->>'status'=p_status)
      AND (p_fiscal_config_id IS NULL OR row->>'fiscalConfigId'=p_fiscal_config_id::text)
      AND (p_cliente_id IS NULL OR row->>'clienteId'=p_cliente_id::text)
      -- Emissão efetiva no horário municipal. Sem data fiscal não há inclusão presumida no período.
      AND (p_data_inicial IS NULL OR (row->>'emissao')::timestamptz >= p_data_inicial::timestamp AT TIME ZONE 'America/Maceio')
      AND (p_data_final IS NULL OR (row->>'emissao')::timestamptz < (p_data_final+1)::timestamp AT TIME ZONE 'America/Maceio')
      AND (coalesce(trim(p_search),'')='' OR row->>'parceiro' ILIKE '%'||trim(p_search)||'%'
        OR row->>'numeroNfse' ILIKE '%'||trim(p_search)||'%')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.listar_faturamento_nfse_webiss(text,text,text,uuid,uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_faturamento_nfse_webiss(text,text,text,uuid,uuid,date,date) TO authenticated;
COMMIT;
