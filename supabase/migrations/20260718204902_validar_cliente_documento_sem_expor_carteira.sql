CREATE OR REPLACE FUNCTION public.documento_cliente_belongs_to_empresa(
  p_cliente_id text,
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_empresa_member(p_empresa_id)
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id::text = p_cliente_id
        AND c.empresa_id = p_empresa_id
    );
$$;

REVOKE ALL ON FUNCTION public.documento_cliente_belongs_to_empresa(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.documento_cliente_belongs_to_empresa(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.documento_cliente_belongs_to_empresa(text, uuid) TO authenticated;

DROP POLICY IF EXISTS documentos_insert_permission ON public.documentos;
CREATE POLICY documentos_insert_permission ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      public.current_user_has_permission(empresa_id, 'documentos:create')
      OR public.current_user_has_permission(empresa_id, 'documentos:manage')
    )
    AND (
      (scope = 'pessoal' AND cliente_id IS NULL)
      OR (
        scope = 'empresa'
        AND cliente_id IS NOT NULL
        AND public.documento_cliente_belongs_to_empresa(cliente_id, empresa_id)
      )
    )
  );
