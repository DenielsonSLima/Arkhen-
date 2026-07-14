-- A tabela de histórico é acessada somente pelas RPCs com validação de tenant.
-- Revoga inclusive TRUNCATE, que não é protegido por RLS.
REVOKE ALL ON TABLE public.planejamento_tributario_historico FROM anon, authenticated;
