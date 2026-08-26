-- A configuração de expiração e senha é uma política de segurança do tenant.
-- Leitura é permitida aos membros ativos; alteração exige privilégio administrativo.
BEGIN;

ALTER TABLE public.configuracoes_compartilhamento
  ADD COLUMN IF NOT EXISTS tempo_padrao_minutos integer NOT NULL DEFAULT 180
    CHECK (tempo_padrao_minutos BETWEEN 10 AND 4320),
  ADD COLUMN IF NOT EXISTS limitar_tipos text[] NOT NULL
    DEFAULT '{dre,balanco,social}'::text[],
  ADD COLUMN IF NOT EXISTS prazos_exigem_senha text[] NOT NULL
    DEFAULT '{12 horas,24 horas,3 dias}'::text[];

ALTER TABLE public.configuracoes_compartilhamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_compartilhamento_policy
  ON public.configuracoes_compartilhamento;
DROP POLICY IF EXISTS configuracoes_compartilhamento_select_member
  ON public.configuracoes_compartilhamento;
DROP POLICY IF EXISTS configuracoes_compartilhamento_insert_manager
  ON public.configuracoes_compartilhamento;
DROP POLICY IF EXISTS configuracoes_compartilhamento_update_manager
  ON public.configuracoes_compartilhamento;
DROP POLICY IF EXISTS configuracoes_compartilhamento_delete_manager
  ON public.configuracoes_compartilhamento;

CREATE POLICY configuracoes_compartilhamento_select_member
  ON public.configuracoes_compartilhamento
  FOR SELECT
  TO authenticated
  USING (public.is_empresa_member(empresa_id));

CREATE POLICY configuracoes_compartilhamento_insert_manager
  ON public.configuracoes_compartilhamento
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'configuracoes:manage')
    OR public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

CREATE POLICY configuracoes_compartilhamento_update_manager
  ON public.configuracoes_compartilhamento
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'configuracoes:manage')
    OR public.current_user_has_permission(empresa_id, 'documentos:manage')
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'configuracoes:manage')
    OR public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

CREATE POLICY configuracoes_compartilhamento_delete_manager
  ON public.configuracoes_compartilhamento
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'configuracoes:manage')
    OR public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

COMMIT;
