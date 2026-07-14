-- Preferencias de usuario por módulo (configurações de UI e comportamento).

CREATE TABLE IF NOT EXISTS public.preferencias_usuario_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  chave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_usuario_modulos_unique UNIQUE (empresa_id, user_id, modulo, chave)
);

ALTER TABLE public.preferencias_usuario_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preferencias_usuario_modulos_policy ON public.preferencias_usuario_modulos;
CREATE POLICY preferencias_usuario_modulos_policy ON public.preferencias_usuario_modulos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id) AND user_id = auth.uid())
  WITH CHECK (public.is_empresa_member(empresa_id) AND user_id = auth.uid());

DROP TRIGGER IF EXISTS set_preferencias_usuario_modulos_updated_at ON public.preferencias_usuario_modulos;
CREATE TRIGGER set_preferencias_usuario_modulos_updated_at
  BEFORE UPDATE ON public.preferencias_usuario_modulos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_preferencias_usuario_modulos_empresa_user_modulo
  ON public.preferencias_usuario_modulos (empresa_id, user_id, modulo, chave);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'preferencias_usuario_modulos'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.preferencias_usuario_modulos;
    END IF;
  END IF;
END;
$$;
