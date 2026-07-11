-- Persiste a vinculação de modelos de checklist por cliente e define os modelos
-- atuais para todas as empresas cliente existentes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS modelos_ativos text[] NOT NULL DEFAULT '{}';

UPDATE public.clientes c
SET modelos_ativos = COALESCE(modelos.ids, '{}')
FROM (
  SELECT
    empresa_id,
    array_agg(id::text ORDER BY ordem, nome) AS ids
  FROM public.atividades_modelos
  WHERE ativo = true
  GROUP BY empresa_id
) modelos
WHERE modelos.empresa_id = c.empresa_id
  AND (
    c.modelos_ativos IS NULL
    OR cardinality(c.modelos_ativos) = 0
  );
