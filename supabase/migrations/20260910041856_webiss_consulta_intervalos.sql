-- Conservatively coordinate all queries to each fixed WebISS environment endpoint.
-- The provider requires a 2-second gap; whether it groups by IP or CNPJ is not established.
-- Infrastructure-only coordination intentionally spans tenants; no fiscal/customer data is stored.
BEGIN;
CREATE TABLE app_private.webiss_consulta_intervalos (
  ambiente text PRIMARY KEY CHECK (ambiente IN ('homologacao','producao')),
  liberar_em timestamptz NOT NULL
);
ALTER TABLE app_private.webiss_consulta_intervalos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.webiss_consulta_intervalos FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO app_private.webiss_consulta_intervalos(ambiente,liberar_em)
VALUES ('homologacao','-infinity'),('producao','-infinity');

CREATE FUNCTION public.reservar_intervalo_consulta_webiss(p_ambiente text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proximo timestamptz;
  agora timestamptz;
  reservado timestamptz;
  aguardar_ms integer;
BEGIN
  IF p_ambiente IS NULL OR p_ambiente NOT IN ('homologacao','producao') THEN
    RAISE EXCEPTION 'Ambiente de consulta WebISS invalido.';
  END IF;
  SELECT liberar_em INTO proximo FROM app_private.webiss_consulta_intervalos
    WHERE ambiente=p_ambiente FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Controle de intervalo WebISS indisponivel.'; END IF;
  -- Evaluate wall clock after acquiring the lock, not at transaction start.
  agora:=clock_timestamp();
  reservado:=greatest(agora,proximo);
  aguardar_ms:=ceil(extract(epoch FROM (reservado-agora))*1000)::integer;
  IF aguardar_ms>60000 THEN
    RAISE EXCEPTION 'Fila de consultas WebISS ocupada. Aguarde e consulte novamente.';
  END IF;
  UPDATE app_private.webiss_consulta_intervalos SET liberar_em=reservado+interval '3 seconds'
    WHERE ambiente=p_ambiente;
  RETURN jsonb_build_object('aguardarMs',aguardar_ms);
END;
$$;
REVOKE ALL ON FUNCTION public.reservar_intervalo_consulta_webiss(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_intervalo_consulta_webiss(text) TO service_role;
COMMIT;
