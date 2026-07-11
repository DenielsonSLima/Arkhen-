ALTER TABLE public.configuracoes_usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cpf varchar(20),
  ADD COLUMN IF NOT EXISTS telefone varchar(30),
  ADD COLUMN IF NOT EXISTS access_config jsonb NOT NULL DEFAULT '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor."}'::jsonb,
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_configuracoes_usuarios_empresa_email
  ON public.configuracoes_usuarios(empresa_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_configuracoes_usuarios_auth_user
  ON public.configuracoes_usuarios(auth_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'configuracoes_usuarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_usuarios;
  END IF;
END $$;
