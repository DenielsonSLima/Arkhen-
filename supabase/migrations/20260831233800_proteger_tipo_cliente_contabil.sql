-- Cliente Contábil é um tipo estrutural consumido por Agenda, Rotinas,
-- Acompanhamento e carteira. Impede exclusão, inativação ou descaracterização.

CREATE OR REPLACE FUNCTION app_private.proteger_tipo_cliente_contabil_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.tipo = 'tipos_parceiros' AND OLD.codigo = 'cliente_contabil' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cliente Contábil é um tipo obrigatório do sistema.'
        USING ERRCODE = '23503';
    END IF;

    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.ativo IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Cliente Contábil é um tipo obrigatório do sistema.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_tipo_cliente_contabil
  ON public.parametrizacao_catalogos;
CREATE TRIGGER proteger_tipo_cliente_contabil
  BEFORE UPDATE OR DELETE ON public.parametrizacao_catalogos
  FOR EACH ROW
  EXECUTE FUNCTION app_private.proteger_tipo_cliente_contabil_trigger();

REVOKE ALL ON FUNCTION app_private.proteger_tipo_cliente_contabil_trigger()
  FROM PUBLIC, anon, authenticated;
