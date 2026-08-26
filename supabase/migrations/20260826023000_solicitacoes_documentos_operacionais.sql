-- Solicitações documentais por cliente e competência.
-- A chave composta impede que um cliente de outro tenant seja associado à solicitação.

CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_id_id_uidx
  ON public.clientes (empresa_id, id);

CREATE TABLE IF NOT EXISTS public.documentos_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id()
    REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL,
  competencia date NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data_limite date,
  status text NOT NULL DEFAULT 'Pendente',
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  atualizado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_solicitacoes_empresa_cliente_fkey
    FOREIGN KEY (empresa_id, cliente_id)
    REFERENCES public.clientes (empresa_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT documentos_solicitacoes_competencia_mes_check
    CHECK (competencia = date_trunc('month', competencia)::date),
  CONSTRAINT documentos_solicitacoes_titulo_check
    CHECK (char_length(btrim(titulo)) BETWEEN 2 AND 160),
  CONSTRAINT documentos_solicitacoes_descricao_check
    CHECK (descricao IS NULL OR char_length(descricao) <= 2000),
  CONSTRAINT documentos_solicitacoes_status_check
    CHECK (status IN ('Pendente', 'Recebido', 'Em conferência', 'Concluído'))
);

CREATE INDEX IF NOT EXISTS documentos_solicitacoes_empresa_competencia_idx
  ON public.documentos_solicitacoes (empresa_id, competencia DESC);

CREATE INDEX IF NOT EXISTS documentos_solicitacoes_empresa_cliente_status_idx
  ON public.documentos_solicitacoes (empresa_id, cliente_id, status);

CREATE OR REPLACE FUNCTION public.proteger_auditoria_documento_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.empresa_id := (SELECT public.current_empresa_id());
    NEW.status := 'Pendente';
    NEW.criado_por := (SELECT auth.uid());
    NEW.atualizado_por := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
     OR NEW.criado_por IS DISTINCT FROM OLD.criado_por
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Empresa, cliente e dados de criação da solicitação não podem ser alterados'
      USING ERRCODE = '42501';
  END IF;

  NEW.atualizado_por := (SELECT auth.uid());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_auditoria_documento_solicitacao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proteger_auditoria_documento_solicitacao() FROM anon, authenticated;

DROP TRIGGER IF EXISTS proteger_auditoria_documento_solicitacao
  ON public.documentos_solicitacoes;
CREATE TRIGGER proteger_auditoria_documento_solicitacao
  BEFORE INSERT OR UPDATE ON public.documentos_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_auditoria_documento_solicitacao();

CREATE OR REPLACE FUNCTION public.listar_clientes_solicitacoes_documentos()
RETURNS TABLE (
  cliente_id uuid,
  cliente_nome text,
  cliente_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cliente.id, cliente.nome, cliente.status
  FROM public.clientes cliente
  WHERE cliente.empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
    AND (
      public.current_user_has_permission(cliente.empresa_id, 'documentos:view')
      OR public.current_user_has_permission(cliente.empresa_id, 'documentos:create')
      OR public.current_user_has_permission(cliente.empresa_id, 'documentos:manage')
    )
  ORDER BY cliente.nome;
$$;

REVOKE ALL ON FUNCTION public.listar_clientes_solicitacoes_documentos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_clientes_solicitacoes_documentos() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_clientes_solicitacoes_documentos() TO authenticated;

ALTER TABLE public.documentos_solicitacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.documentos_solicitacoes FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.documentos_solicitacoes TO authenticated;
GRANT UPDATE (status) ON TABLE public.documentos_solicitacoes TO authenticated;

DROP POLICY IF EXISTS documentos_solicitacoes_select ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_select
  ON public.documentos_solicitacoes
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:view')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
    )
  );

DROP POLICY IF EXISTS documentos_solicitacoes_insert ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_insert
  ON public.documentos_solicitacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND criado_por = (SELECT auth.uid())
    AND atualizado_por = (SELECT auth.uid())
    AND status = 'Pendente'
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:create')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
    )
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
  );

DROP POLICY IF EXISTS documentos_solicitacoes_update ON public.documentos_solicitacoes;
CREATE POLICY documentos_solicitacoes_update
  ON public.documentos_solicitacoes
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR public.current_user_has_permission(empresa_id, 'documentos:create')
    )
  )
  WITH CHECK (
    empresa_id = (SELECT public.current_empresa_id())
    AND public.current_user_can_access_client_row(empresa_id, cliente_id)
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:manage')
      OR public.current_user_has_permission(empresa_id, 'documentos:create')
    )
  );

COMMENT ON TABLE public.documentos_solicitacoes IS
  'Solicitações de documentos do escritório para clientes, isoladas por empresa e competência.';

COMMENT ON COLUMN public.documentos_solicitacoes.status IS
  'Começa obrigatoriamente em Pendente. Usuários autorizados podem corrigir o status retroativamente; somente esta coluna é atualizável pela Data API.';
