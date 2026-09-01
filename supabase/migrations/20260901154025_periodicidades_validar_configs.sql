CREATE OR REPLACE FUNCTION public.validar_configs_protocolos_operacionais(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_regime text;
BEGIN
  SELECT cliente.tipo INTO v_regime
  FROM public.clientes cliente
  WHERE cliente.empresa_id = p_empresa_id
    AND cliente.id = p_cliente_id
    AND cliente.status = 'Ativa';

  IF NOT FOUND OR jsonb_typeof(p_configs) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_configs) > 200
     OR octet_length(p_configs::text) > 65536 THEN
    RAISE EXCEPTION 'Configuração de protocolos inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_configs) item(valor)
    WHERE jsonb_typeof(item.valor) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item.valor -> 'entregaId') IS DISTINCT FROM 'string'
      OR char_length(btrim(item.valor ->> 'entregaId')) NOT BETWEEN 1 AND 180
      OR jsonb_typeof(item.valor -> 'ativo') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(item.valor -> 'periodicidade') IS DISTINCT FROM 'string'
      OR item.valor ->> 'periodicidade' NOT IN (
        'diaria', 'unica', 'semanal', 'quinzenal', 'mensal',
        'trimestral', 'semestral', 'anual', 'personalizada'
      )
      OR (item.valor ? 'dataInicial'
        AND app_private.jsonb_data_iso(item.valor -> 'dataInicial') IS NULL)
      OR (item.valor ? 'dataVencimento'
        AND app_private.jsonb_data_iso(item.valor -> 'dataVencimento') IS NULL)
      OR (item.valor ? 'proximaExecucao'
        AND app_private.jsonb_data_iso(item.valor -> 'proximaExecucao') IS NULL)
      OR (item.valor ? 'diaMes'
        AND app_private.jsonb_inteiro_entre(item.valor -> 'diaMes', 1, 31) IS NULL)
      OR (item.valor ? 'diaSemana'
        AND app_private.jsonb_inteiro_entre(item.valor -> 'diaSemana', 1, 7) IS NULL)
      OR (item.valor ? 'mesVencimento'
        AND app_private.jsonb_inteiro_entre(
          item.valor -> 'mesVencimento', 1, 12
        ) IS NULL)
      OR (item.valor ? 'intervaloDias'
        AND app_private.jsonb_inteiro_entre(
          item.valor -> 'intervaloDias', 1, 366
        ) IS NULL)
      OR (item.valor ? 'incluirFinaisDeSemana'
        AND jsonb_typeof(item.valor -> 'incluirFinaisDeSemana') <> 'boolean')
      OR (item.valor ->> 'ativo' = 'true' AND NOT (item.valor ? 'dataInicial'))
      OR (item.valor ->> 'ativo' = 'true'
        AND item.valor ->> 'periodicidade' IN (
          'mensal', 'trimestral', 'semestral', 'anual'
        ) AND NOT (item.valor ? 'diaMes'))
      OR (item.valor ->> 'ativo' = 'true'
        AND item.valor ->> 'periodicidade' = 'semanal'
        AND NOT (item.valor ? 'diaSemana'))
      OR (item.valor ->> 'ativo' = 'true'
        AND item.valor ->> 'periodicidade' = 'anual'
        AND NOT (item.valor ? 'mesVencimento'))
      OR (item.valor ->> 'ativo' = 'true'
        AND item.valor ->> 'periodicidade' = 'unica'
        AND NOT (item.valor ? 'dataVencimento'))
      OR (item.valor ->> 'ativo' = 'true'
        AND item.valor ->> 'periodicidade' = 'personalizada'
        AND NOT (item.valor ? 'intervaloDias'))
      OR (item.valor ? 'intervaloDias'
        AND item.valor ->> 'periodicidade' <> 'personalizada')
      OR (item.valor ? 'diaSemana'
        AND item.valor ->> 'periodicidade' <> 'semanal')
      OR (item.valor ? 'mesVencimento'
        AND item.valor ->> 'periodicidade' <> 'anual')
      OR (item.valor ? 'dataVencimento'
        AND item.valor ->> 'periodicidade' <> 'unica')
      OR (item.valor ? 'diaMes'
        AND item.valor ->> 'periodicidade' NOT IN (
          'mensal', 'trimestral', 'semestral', 'anual'
        ))
      OR (item.valor ->> 'periodicidade' = 'unica'
        AND app_private.jsonb_data_iso(item.valor -> 'dataInicial')
          IS DISTINCT FROM app_private.jsonb_data_iso(
            item.valor -> 'dataVencimento'
          ))
      OR (item.valor ->> 'periodicidade' = 'anual'
        AND (
          extract(month FROM app_private.jsonb_data_iso(
            item.valor -> 'dataInicial'
          ))::integer IS DISTINCT FROM app_private.jsonb_inteiro_entre(
            item.valor -> 'mesVencimento', 1, 12
          )
          OR extract(day FROM app_private.jsonb_data_iso(
            item.valor -> 'dataInicial'
          ))::integer IS DISTINCT FROM LEAST(
            app_private.jsonb_inteiro_entre(item.valor -> 'diaMes', 1, 31),
            extract(day FROM (
              date_trunc('month', app_private.jsonb_data_iso(
                item.valor -> 'dataInicial'
              )::timestamp) + interval '1 month - 1 day'
            ))::integer
          )
        ))
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(item.valor) chave
        WHERE chave NOT IN (
          'entregaId', 'ativo', 'periodicidade', 'dataInicial',
          'dataVencimento', 'diaMes', 'diaSemana', 'mesVencimento',
          'intervaloDias', 'incluirFinaisDeSemana', 'proximaExecucao'
        )
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.parametrizacao_protocolos_tipos tipo
        WHERE tipo.empresa_id = p_empresa_id
          AND tipo.codigo = btrim(item.valor ->> 'entregaId')
          AND (item.valor ->> 'ativo' = 'false'
            OR (tipo.ativo = true AND v_regime = ANY(tipo.regimes)))
      )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_configs) item(valor)
    GROUP BY btrim(item.valor ->> 'entregaId') HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A configuração contém agenda, obrigação ou regime inválido.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_configs_protocolos_operacionais(
  uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
