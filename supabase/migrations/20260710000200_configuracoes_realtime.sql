DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_empresa'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_empresa;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_marca_dagua'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_marca_dagua;
    END IF;
  END IF;
END;
$$;
