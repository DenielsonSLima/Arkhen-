ALTER TABLE public.documentos_categorias
  ALTER COLUMN empresa_id DROP NOT NULL;

DROP INDEX IF EXISTS public.idx_documentos_categorias_scope_nome;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_categorias_global_nome
  ON public.documentos_categorias (nome_key)
  WHERE empresa_id IS NULL AND cliente_id IS NULL AND sistema = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_categorias_tenant_scope_nome
  ON public.documentos_categorias (empresa_id, scope_key, nome_key)
  WHERE empresa_id IS NOT NULL;

WITH ranked_defaults AS (
  SELECT
    id,
    nome,
    ordem,
    row_number() OVER (PARTITION BY nome_key ORDER BY empresa_id, id) AS rn
  FROM public.documentos_categorias
  WHERE sistema = true
    AND cliente_id IS NULL
    AND nome_key IN ('contratos', 'procuracoes', 'certidoes', 'impostos', 'trabalhista', 'outros')
)
UPDATE public.documentos_categorias dc
SET empresa_id = NULL,
    sistema = true,
    ativo = true,
    ordem = rd.ordem,
    updated_at = now()
FROM ranked_defaults rd
WHERE dc.id = rd.id
  AND rd.rn = 1;

DELETE FROM public.documentos_categorias dc
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (PARTITION BY nome_key ORDER BY empresa_id NULLS FIRST, id) AS rn
    FROM public.documentos_categorias
    WHERE sistema = true
      AND cliente_id IS NULL
      AND nome_key IN ('contratos', 'procuracoes', 'certidoes', 'impostos', 'trabalhista', 'outros')
  ) duplicates
  WHERE rn > 1
) doomed
WHERE dc.id = doomed.id;

INSERT INTO public.documentos_categorias (empresa_id, cliente_id, nome, ativo, sistema, ordem)
VALUES
  (NULL, NULL, 'Contratos', true, true, 10),
  (NULL, NULL, 'Procurações', true, true, 20),
  (NULL, NULL, 'Certidões', true, true, 30),
  (NULL, NULL, 'Impostos', true, true, 40),
  (NULL, NULL, 'Trabalhista', true, true, 50),
  (NULL, NULL, 'Outros', true, true, 60)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS documentos_categorias_tenant_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_select_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_insert_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_update_policy ON public.documentos_categorias;
DROP POLICY IF EXISTS documentos_categorias_delete_policy ON public.documentos_categorias;

CREATE POLICY documentos_categorias_select_policy ON public.documentos_categorias
  FOR SELECT
  TO authenticated
  USING (
    (empresa_id IS NULL AND cliente_id IS NULL AND sistema = true)
    OR public.is_empresa_member(empresa_id)
  );

CREATE POLICY documentos_categorias_insert_policy ON public.documentos_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id IS NOT NULL
    AND public.is_empresa_member(empresa_id)
    AND sistema = false
    AND (
      cliente_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = documentos_categorias.cliente_id
          AND c.empresa_id = documentos_categorias.empresa_id
      )
    )
  );

CREATE POLICY documentos_categorias_update_policy ON public.documentos_categorias
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND public.is_empresa_member(empresa_id)
    AND sistema = false
  )
  WITH CHECK (
    empresa_id IS NOT NULL
    AND public.is_empresa_member(empresa_id)
    AND sistema = false
    AND (
      cliente_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = documentos_categorias.cliente_id
          AND c.empresa_id = documentos_categorias.empresa_id
      )
    )
  );

CREATE POLICY documentos_categorias_delete_policy ON public.documentos_categorias
  FOR DELETE
  TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND public.is_empresa_member(empresa_id)
    AND sistema = false
  );
