-- A migration original de vínculos foi aplicada antes da revisão que adicionou
-- este comentário. Mantemos o histórico imutável e reconciliamos a descrição
-- da coluna em uma migration complementar e idempotente.

COMMENT ON COLUMN public.clientes.tipo_parceiro_id IS
  'Classificação do relacionamento no catálogo multiempresa tipos_parceiros.';
