-- Obrigações sem vencimento continuam gerando Rotinas, mas nunca aparecem nem
-- podem ser materializadas como protocolos legais de entrega.

CREATE OR REPLACE FUNCTION app_private.filtrar_protocolos_com_vencimento(
  p_empresa_id uuid,
  p_protocolos jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(protocolo.item ORDER BY protocolo.ordem), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_protocolos) = 'array' THEN p_protocolos ELSE '[]'::jsonb END
  ) WITH ORDINALITY protocolo(item, ordem)
  JOIN public.parametrizacao_protocolos_tipos tipo
    ON tipo.empresa_id = p_empresa_id
   AND tipo.codigo = protocolo.item ->> 'entregaId'
   AND tipo.ativo = true
   AND tipo.tem_vencimento = true;
$$;

REVOKE ALL ON FUNCTION app_private.filtrar_protocolos_com_vencimento(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.validar_obrigacao_com_vencimento_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = cliente.empresa_id
     AND tipo.codigo = NEW.entrega_id
     AND tipo.ativo = true
     AND tipo.tem_vencimento = true
     AND cliente.tipo = ANY(tipo.regimes)
    WHERE cliente.empresa_id = NEW.empresa_id
      AND cliente.id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'A obrigação não possui vencimento legal para este cliente.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_obrigacao_com_vencimento_protocolo
  ON public.protocolos_entregas;
CREATE TRIGGER validar_obrigacao_com_vencimento_protocolo
  BEFORE INSERT OR UPDATE ON public.protocolos_entregas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.validar_obrigacao_com_vencimento_protocolo();

REVOKE ALL ON FUNCTION app_private.validar_obrigacao_com_vencimento_protocolo()
  FROM PUBLIC, anon, authenticated;

-- A aplicação usa somente o envelope seguro. O legado continua interno porque
-- ele também é a fonte deste wrapper, mas deixa de ser chamável pelo cliente.
CREATE OR REPLACE FUNCTION public.get_protocolos_operacionais_seguros()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
  v_manage boolean;
  v_create boolean;
  v_view boolean;
  v_view_own boolean;
BEGIN
  v_manage := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:manage'
  ), false);
  v_create := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:create'
  ), false);
  v_view := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view'
  ), false);
  v_view_own := COALESCE(public.current_user_has_permission(
    v_empresa_id, 'protocolos:view-own'
  ), false);

  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR NOT (v_manage OR v_create OR v_view OR v_view_own) THEN
    RAISE EXCEPTION 'Protocolos não encontrados.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(projetado.item || jsonb_build_object(
    'evidencia', COALESCE(salvo.evidencia, ''),
    'concluidoEm', COALESCE(salvo.concluido_em::text, ''),
    'auditoriaPendente', COALESCE(salvo.auditoria_pendente, false),
    'podeAlterarStatus', v_manage,
    'podeAnotar', v_manage OR (v_create AND salvo.id IS NULL)
  ) ORDER BY projetado.ordem), '[]'::jsonb)
  INTO v_result
  FROM jsonb_array_elements(app_private.filtrar_protocolos_com_vencimento(
    v_empresa_id, public.get_protocolos_operacionais()
  )) WITH ORDINALITY projetado(item, ordem)
  JOIN public.clientes cliente_visivel
    ON cliente_visivel.id::text = projetado.item ->> 'empresaId'
   AND cliente_visivel.empresa_id = v_empresa_id
   AND public.current_user_can_access_client_row(
     cliente_visivel.empresa_id, cliente_visivel.id
   )
  LEFT JOIN public.protocolos_entregas salvo
    ON salvo.id = projetado.item ->> 'id'
   AND salvo.empresa_id = v_empresa_id
   AND salvo.cliente_id = cliente_visivel.id
  WHERE v_manage OR v_create OR v_view OR (
    v_view_own
    AND public.current_user_has_client_access(
      cliente_visivel.empresa_id, cliente_visivel.id
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_protocolos_operacionais() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualizar_protocolo_entrega(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.parametrizacao_protocolos_tipos
  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.parametrizacao_prazos_entrega
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_protocolos_operacionais_seguros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_protocolos_operacionais_seguros() TO authenticated;
