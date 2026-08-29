-- Índice na ordem da chave estrangeira para operações no catálogo por empresa.
CREATE INDEX IF NOT EXISTS clientes_tipo_parceiro_tenant_fk_idx
  ON public.clientes (tipo_parceiro_id, empresa_id, tipo_parceiro_catalogo_tipo)
  WHERE tipo_parceiro_id IS NOT NULL;
