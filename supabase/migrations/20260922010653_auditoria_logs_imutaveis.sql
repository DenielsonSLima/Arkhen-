-- A auditoria é append-only. Escritores atuais são RPCs SECURITY DEFINER;
-- clientes só consultam, respeitando as policies de tenant já existentes.
BEGIN;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.configuracoes_eventos_logs FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.proteger_integridade_eventos_logs()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') OR TG_OP IN ('UPDATE', 'DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'O histórico de auditoria não pode ser alterado.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_integridade_eventos_logs() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER proteger_integridade_eventos_logs
BEFORE INSERT OR UPDATE OR DELETE ON public.configuracoes_eventos_logs
FOR EACH ROW EXECUTE FUNCTION public.proteger_integridade_eventos_logs();
CREATE TRIGGER proteger_truncate_eventos_logs
BEFORE TRUNCATE ON public.configuracoes_eventos_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.proteger_integridade_eventos_logs();

CREATE OR REPLACE FUNCTION public.consultar_eventos_logs(
  p_busca text DEFAULT '', p_modulo text DEFAULT '', p_tipo text DEFAULT '',
  p_antes_em timestamptz DEFAULT NULL, p_antes_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH filtrados AS (
    SELECT log.* FROM public.configuracoes_eventos_logs log
    WHERE (COALESCE(p_busca, '') = '' OR position(lower(p_busca) IN lower(log.acao)) > 0
      OR position(lower(p_busca) IN lower(COALESCE(log.detalhes->>'usuario', ''))) > 0)
      AND (COALESCE(p_modulo, '') = '' OR log.modulo = p_modulo)
      AND (COALESCE(p_tipo, '') = '' OR log.tipo = p_tipo
        OR (p_tipo = 'Alerta' AND log.tipo = 'Erro'))
  ), pagina AS (
    SELECT * FROM filtrados
    WHERE p_antes_em IS NULL OR (created_at, id) < (p_antes_em, p_antes_id)
    ORDER BY created_at DESC, id DESC LIMIT 100
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(pagina) ORDER BY created_at DESC, id DESC) FROM pagina), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'modulos', COALESCE((SELECT jsonb_agg(modulo ORDER BY modulo) FROM
      (SELECT DISTINCT modulo FROM public.configuracoes_eventos_logs) m), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.consultar_eventos_logs(text,text,text,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_eventos_logs(text,text,text,timestamptz,uuid) TO authenticated;
COMMIT;
