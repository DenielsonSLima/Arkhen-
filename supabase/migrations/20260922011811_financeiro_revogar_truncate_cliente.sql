-- TRUNCATE não é protegido por RLS nem pelos triggers de escrita por linha.
-- Clientes continuam usando as RPCs autorizadas; service_role não é alterado.
BEGIN;
REVOKE TRUNCATE ON public.financeiro_lancamentos, public.configuracoes_contas_bancarias
  FROM PUBLIC, anon, authenticated;
COMMIT;
