-- O total de descontos da rescisão é calculado na RPC, nunca no frontend/PDF.
CREATE OR REPLACE FUNCTION public.simular_rescisao(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_envelope jsonb := public.envelope_simulacao_existente('rescisao', p);
  v_resultado jsonb;
  v_total_descontos numeric;
BEGIN
  v_resultado := COALESCE(v_envelope -> 'resultado', '{}'::jsonb);
  v_total_descontos :=
    COALESCE((v_resultado ->> 'inssRescisao')::numeric, 0)
    + COALESCE((v_resultado ->> 'irrfRescisao')::numeric, 0)
    + COALESCE((v_resultado ->> 'avisoPrevioDesconto')::numeric, 0);

  RETURN jsonb_set(
    v_envelope,
    '{resultado}',
    v_resultado || jsonb_build_object('totalDescontos', round(v_total_descontos, 2)),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simular_rescisao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_rescisao(jsonb) TO authenticated;
