-- O trigger legado confirmava todo email no INSERT, inclusive createUser com
-- email_confirm:false. Isso fazia o provisionamento de convites retornar 42501.
-- O Auth grava app_metadata administrativo depois do INSERT: uma excecao por
-- account_type neste trigger nao corrige o fluxo real.
-- A confirmacao passa a respeitar o Auth (configuracao, aceite ou email_confirm).
-- Contas existentes e guardas de provisionamento permanecem intactas.
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
