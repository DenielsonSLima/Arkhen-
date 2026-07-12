DELETE FROM public.documentos_categorias
WHERE sistema = true
  AND empresa_id IS NOT NULL
  AND cliente_id IS NULL
  AND nome IN ('Contratos', 'Procurações', 'Certidões', 'Impostos', 'Trabalhista', 'Outros');

ALTER TABLE public.documentos_categorias
  DROP CONSTRAINT IF EXISTS documentos_categorias_sistema_scope_check;

ALTER TABLE public.documentos_categorias
  ADD CONSTRAINT documentos_categorias_sistema_scope_check CHECK (
    (sistema = true AND empresa_id IS NULL AND cliente_id IS NULL)
    OR (sistema = false AND empresa_id IS NOT NULL)
  );
