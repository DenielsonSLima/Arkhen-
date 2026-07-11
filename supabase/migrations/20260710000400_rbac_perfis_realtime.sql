DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_perfis_acesso'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_perfis_acesso;
    END IF;
  END IF;
END;
$$;
