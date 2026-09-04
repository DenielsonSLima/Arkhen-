-- Fecha o acesso ao estado paralelo e mantém o painel sincronizado entre usuários.
BEGIN;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.conformidade_obrigacoes FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.get_conformidade_operacional(uuid)
  FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.get_conformidade_operacional_tarefas(uuid, varchar)
  FROM authenticated, anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conformidade_obrigacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      DROP TABLE public.conformidade_obrigacoes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'atividades_tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.atividades_tarefas;
  END IF;
END;
$$;

COMMIT;
