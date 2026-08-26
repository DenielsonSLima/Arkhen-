-- LOCKDOWN: mantém a projeção legada explicitamente fail-closed, mesmo se um
-- grant for adicionado por engano no futuro.
BEGIN;

DROP POLICY IF EXISTS atividades_instancias_legacy_denied
  ON public.atividades_instancias;
CREATE POLICY atividades_instancias_legacy_denied
  ON public.atividades_instancias
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
