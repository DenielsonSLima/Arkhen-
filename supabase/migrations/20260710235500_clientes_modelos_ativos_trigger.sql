-- Novos clientes entram com todos os modelos ativos vinculados por padrão.

CREATE OR REPLACE FUNCTION public.set_default_clientes_modelos_ativos()
RETURNS trigger AS $$
BEGIN
  IF NEW.modelos_ativos IS NULL OR cardinality(NEW.modelos_ativos) = 0 THEN
    SELECT COALESCE(array_agg(am.id::text ORDER BY am.ordem, am.nome), '{}')
    INTO NEW.modelos_ativos
    FROM public.atividades_modelos am
    WHERE am.empresa_id = NEW.empresa_id
      AND am.ativo = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clientes_modelos_ativos_before_insert ON public.clientes;
CREATE TRIGGER set_clientes_modelos_ativos_before_insert
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_clientes_modelos_ativos();
