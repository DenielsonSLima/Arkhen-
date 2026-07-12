-- Repara clientes ativos sem modelos de atividades válidos e mantém novos cadastros
-- vinculados aos modelos compatíveis com o regime tributário.

CREATE OR REPLACE FUNCTION public.set_default_clientes_modelos_ativos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.modelos_ativos IS NULL OR cardinality(NEW.modelos_ativos) = 0 THEN
    SELECT COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}')
    INTO NEW.modelos_ativos
    FROM public.atividades_modelos am
    WHERE am.empresa_id = NEW.empresa_id
      AND am.ativo = true
      AND (
        am.tipos IS NULL
        OR cardinality(am.tipos) = 0
        OR NEW.tipo = ANY(am.tipos)
        OR (NEW.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
        OR (NEW.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
      );
  END IF;

  RETURN NEW;
END;
$$;

WITH clientes_reparar AS (
  SELECT c.id
  FROM public.clientes c
  WHERE c.status = 'Ativa'
    AND (
      c.modelos_ativos IS NULL
      OR cardinality(c.modelos_ativos) = 0
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(c.modelos_ativos) AS modelo_ativo(modelo_id)
        JOIN public.atividades_modelos am
          ON am.empresa_id = c.empresa_id
         AND am.ativo = true
         AND am.id::text = modelo_ativo.modelo_id
      )
    )
),
modelos_padrao AS (
  SELECT
    c.id AS cliente_id,
    COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}') AS modelos_ativos
  FROM public.clientes c
  JOIN clientes_reparar cr ON cr.id = c.id
  JOIN public.atividades_modelos am
    ON am.empresa_id = c.empresa_id
   AND am.ativo = true
   AND (
      am.tipos IS NULL
      OR cardinality(am.tipos) = 0
      OR c.tipo = ANY(am.tipos)
      OR (c.tipo = 'Isenta' AND 'Isento' = ANY(am.tipos))
      OR (c.tipo = 'Isento' AND 'Isenta' = ANY(am.tipos))
   )
  GROUP BY c.id
)
UPDATE public.clientes c
SET modelos_ativos = mp.modelos_ativos
FROM modelos_padrao mp
WHERE mp.cliente_id = c.id
  AND cardinality(mp.modelos_ativos) > 0;
