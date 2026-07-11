-- Preferencias de ordem da sidebar por usuario e empresa.

CREATE TABLE IF NOT EXISTS public.preferencias_sidebar_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_order text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_sidebar_menu_unique UNIQUE (empresa_id, user_id)
);

ALTER TABLE public.preferencias_sidebar_menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preferencias_sidebar_menu_policy ON public.preferencias_sidebar_menu;
CREATE POLICY preferencias_sidebar_menu_policy ON public.preferencias_sidebar_menu
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id) AND user_id = auth.uid())
  WITH CHECK (public.is_empresa_member(empresa_id) AND user_id = auth.uid());

DROP TRIGGER IF EXISTS set_preferencias_sidebar_menu_updated_at ON public.preferencias_sidebar_menu;
CREATE TRIGGER set_preferencias_sidebar_menu_updated_at
  BEFORE UPDATE ON public.preferencias_sidebar_menu
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_preferencias_sidebar_menu_empresa_user
  ON public.preferencias_sidebar_menu (empresa_id, user_id);
