-- Capacidade descartável do agendador. Não contém credenciais de usuário nem chave service_role.
BEGIN;
CREATE TABLE app_private.financeiro_recorrencia_worker_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id), -- NULL identifica apenas a capacidade global do scheduler.
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.financeiro_recorrencia_worker_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.financeiro_recorrencia_worker_tickets FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.consumir_capacidade_recorrencia(p_token text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE touched uuid;
BEGIN
  IF p_token IS NULL OR length(p_token)<>64 OR p_token!~'^[a-f0-9]{64}$' THEN RETURN false; END IF;
  UPDATE app_private.financeiro_recorrencia_worker_tickets SET consumed_at=now()
    WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND expires_at>now() AND consumed_at IS NULL RETURNING id INTO touched;
  RETURN touched IS NOT NULL;
END;
$$;
CREATE FUNCTION app_private.agendar_worker_recorrencias() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text; request bigint;
BEGIN
  DELETE FROM app_private.financeiro_recorrencia_worker_tickets WHERE created_at<now()-interval '1 day';
  IF NOT EXISTS(SELECT 1 FROM public.financeiro_configuracoes WHERE ativo AND recorrencia_ativa)
    AND NOT EXISTS(SELECT 1 FROM app_private.financeiro_recorrencia_execucoes WHERE manual AND status IN ('pendente','erro','processando','aguardando_pagamento')) THEN RETURN 0; END IF;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO app_private.financeiro_recorrencia_worker_tickets(token_hash,expires_at)
    VALUES(encode(extensions.digest(token,'sha256'),'hex'),now()+interval '5 minutes');
  SELECT net.http_post(url:='https://dgklhykjwzmeqxejlicz.supabase.co/functions/v1/recurrence-worker',
    headers:=jsonb_build_object('Content-Type','application/json','X-Arkhen-Recurrence-Key',token),
    body:='{}'::jsonb,timeout_milliseconds:=90000) INTO request;
  RETURN request;
END;
$$;
REVOKE ALL ON FUNCTION public.consumir_capacidade_recorrencia(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_capacidade_recorrencia(text) TO service_role;
REVOKE ALL ON FUNCTION app_private.agendar_worker_recorrencias() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('financeiro-recorrencias-worker','* * * * *','SELECT app_private.agendar_worker_recorrencias();');
COMMIT;
