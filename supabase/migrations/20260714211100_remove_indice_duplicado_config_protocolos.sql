-- Mantém somente a restrição UNIQUE usada pelo upsert (empresa_id, cliente_id).
-- Em bancos criados do zero o índice abaixo pode nem existir; por isso o DROP é idempotente.
DROP INDEX IF EXISTS public.uq_configuracoes_protocolos_tenant_cliente;
