-- O tenant de um protocolo sempre é derivado do cliente cadastrado.
-- O frontend envia somente cliente_id; a RLS valida se o usuário pertence ao escritório derivado.
CREATE OR REPLACE FUNCTION public.set_protocolos_empresa_from_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT c.empresa_id
    INTO NEW.empresa_id
  FROM public.clientes c
  WHERE c.id = NEW.cliente_id;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Cliente inválido para persistência de protocolos.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_protocolos_empresa_from_cliente() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS derive_protocolos_entregas_empresa ON public.protocolos_entregas;
CREATE TRIGGER derive_protocolos_entregas_empresa
  BEFORE INSERT OR UPDATE OF cliente_id ON public.protocolos_entregas
  FOR EACH ROW EXECUTE FUNCTION public.set_protocolos_empresa_from_cliente();

DROP TRIGGER IF EXISTS derive_config_protocolos_empresa ON public.configuracoes_protocolos_empresas;
CREATE TRIGGER derive_config_protocolos_empresa
  BEFORE INSERT OR UPDATE OF cliente_id ON public.configuracoes_protocolos_empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_protocolos_empresa_from_cliente();
