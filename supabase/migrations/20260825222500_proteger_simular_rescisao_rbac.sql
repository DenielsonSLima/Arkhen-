-- Mantem a assinatura publica usada pelo frontend e isola a implementacao longa.
-- A renomeacao ocorre uma unica vez; repeticoes apenas recompõem wrapper e ACL.
DO $$
BEGIN
  IF to_regprocedure('public.simular_rescisao_interna(jsonb)') IS NULL THEN
    IF to_regprocedure('public.simular_rescisao(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'Função public.simular_rescisao(jsonb) não encontrada.';
    END IF;

    ALTER FUNCTION public.simular_rescisao(jsonb)
      RENAME TO simular_rescisao_interna;
  END IF;
END;
$$;

ALTER FUNCTION public.simular_rescisao_interna(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.simular_rescisao_interna(jsonb)
  SET search_path TO public, pg_temp;
REVOKE ALL ON FUNCTION public.simular_rescisao_interna(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.simular_rescisao(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_chave text;
  v_valor numeric;
  v_tipo text;
  v_aviso text;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR NOT coalesce(public.current_user_has_permission(v_empresa_id, 'simulacoes:view'), false) THEN
    RAISE EXCEPTION 'Sem permissão para simular rescisão'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p) IS DISTINCT FROM 'object'
     OR octet_length(coalesce(p, 'null'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Parâmetros da rescisão inválidos ou muito grandes'
      USING ERRCODE = '22023';
  END IF;

  v_tipo := coalesce(NULLIF(p ->> 'tipo', ''), 'sem_justa_causa');
  v_aviso := coalesce(NULLIF(p ->> 'avisoPrevioModo', ''), 'cumprido');
  IF v_tipo NOT IN ('sem_justa_causa', 'com_justa_causa', 'pedido_demissao')
     OR v_aviso NOT IN ('cumprido', 'descontado', 'indenizado')
     OR (v_tipo = 'sem_justa_causa' AND v_aviso NOT IN ('cumprido', 'indenizado'))
     OR (v_tipo = 'com_justa_causa' AND v_aviso <> 'cumprido')
     OR (v_tipo = 'pedido_demissao' AND v_aviso NOT IN ('cumprido', 'descontado')) THEN
    RAISE EXCEPTION 'Combinação de tipo de rescisão e aviso prévio inválida'
      USING ERRCODE = '22023';
  END IF;

  IF coalesce(NULLIF(p ->> 'adicionalTempoServicoTipo', ''), 'trienio')
       NOT IN ('trienio', 'quinquenio', 'manual') THEN
    RAISE EXCEPTION 'Tipo de adicional por tempo de serviço inválido'
      USING ERRCODE = '22023';
  END IF;

  IF (p ? 'adicionalTempoServicoAtivo'
      AND jsonb_typeof(p -> 'adicionalTempoServicoAtivo') IS DISTINCT FROM 'boolean')
     OR (p ? 'feriasVencidasEmDobro'
      AND jsonb_typeof(p -> 'feriasVencidasEmDobro') IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION 'Indicador booleano da rescisão inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p ? 'feriasVencidasPeriodos' THEN
    IF jsonb_typeof(p -> 'feriasVencidasPeriodos') NOT IN ('number', 'string')
       OR octet_length(p ->> 'feriasVencidasPeriodos') > 4
       OR (jsonb_typeof(p -> 'feriasVencidasPeriodos') = 'string'
         AND (p ->> 'feriasVencidasPeriodos') !~ '^[0-9]+$') THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_valor := (p ->> 'feriasVencidasPeriodos')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END;
    IF v_valor < 0 OR v_valor > 100 OR trunc(v_valor) <> v_valor THEN
      RAISE EXCEPTION 'Quantidade de férias vencidas inválida'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  FOREACH v_chave IN ARRAY ARRAY[
    'salario', 'saldoFGTS', 'adicionalTempoServicoValor',
    'adicionalTempoServicoPercentual'
  ]::text[] LOOP
    CONTINUE WHEN NOT (p ? v_chave);
    IF jsonb_typeof(p -> v_chave) NOT IN ('number', 'string')
       OR octet_length(p ->> v_chave) > 40
       OR (jsonb_typeof(p -> v_chave) = 'string'
         AND (p ->> v_chave) !~ '^[0-9]+([.][0-9]+)?$') THEN
      RAISE EXCEPTION 'Valor numérico da rescisão inválido: %', v_chave
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_valor := (p ->> v_chave)::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Valor numérico da rescisão inválido: %', v_chave
        USING ERRCODE = '22023';
    END;
    IF v_valor < 0
       OR v_valor > (
         CASE
           WHEN v_chave = 'adicionalTempoServicoPercentual' THEN 100
           ELSE 999999999.99
         END
       ) THEN
      RAISE EXCEPTION 'Valor numérico da rescisão fora da faixa: %', v_chave
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN public.simular_rescisao_interna(p);
END;
$$;

REVOKE ALL ON FUNCTION public.simular_rescisao(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.simular_rescisao(jsonb)
  TO authenticated, service_role;
