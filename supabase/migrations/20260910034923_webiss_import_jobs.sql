-- Internal, one-shot consultation jobs. No emission/cancellation action or caller-selected URL.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE app_private.webiss_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  ambiente text NOT NULL CHECK(ambiente IN ('homologacao','producao')),
  data_inicial date NOT NULL, data_final date NOT NULL,
  token_hash text CHECK(token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','expired')),
  request_id bigint, resultado jsonb, erro text,
  created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz,
  CHECK(data_final>=data_inicial AND data_final-data_inicial<=365)
);
ALTER TABLE app_private.webiss_import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.webiss_import_jobs FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX webiss_import_jobs_empresa_data ON app_private.webiss_import_jobs(empresa_id,created_at DESC);
CREATE UNIQUE INDEX webiss_import_jobs_active_scope ON app_private.webiss_import_jobs(
  empresa_id,fiscal_config_id,cliente_id,ambiente,data_inicial,data_final
) WHERE status IN ('pending','processing');

CREATE FUNCTION app_private.webiss_import_actor_empresa(p_user_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  -- Resolver also checks active company/account, access schedule and credential version.
  IF t IS NULL OR NOT EXISTS(SELECT 1 FROM public.perfis WHERE user_id=p_user_id AND empresa_id=t AND ativo=true AND papel='admin') THEN
    RAISE EXCEPTION 'Importacao interna exige administrador ativo da empresa.';
  END IF;
  RETURN t;
END;
$$;
CREATE FUNCTION public.enfileirar_importacao_webiss(
  p_user_id uuid,p_fiscal_config_id uuid,p_cliente_id uuid,p_ambiente text,p_data_inicial date,p_data_final date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t uuid:=app_private.webiss_import_actor_empresa(p_user_id);
  job_id uuid:=gen_random_uuid(); capability text; v_request_id bigint;
BEGIN
  IF p_ambiente IS NULL OR p_ambiente NOT IN ('homologacao','producao') OR p_data_inicial IS NULL OR p_data_final IS NULL
    OR p_data_final<p_data_inicial OR p_data_final-p_data_inicial>365 THEN RAISE EXCEPTION 'Escopo ou periodo de importacao invalido.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.configuracoes_integracao_fiscal WHERE id=p_fiscal_config_id AND empresa_id=t
    AND uf='SE' AND lower(trim(municipio))='itabaiana' AND lower(provedor)='webiss') THEN
    RAISE EXCEPTION 'Contexto fiscal nao pertence a empresa ou nao e WebISS Itabaiana.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=p_cliente_id AND empresa_id=t) THEN
    RAISE EXCEPTION 'Parceiro nao pertence a empresa da importacao.'; END IF;
  -- Retire expired capabilities; do not restart processing or failed work implicitly.
  UPDATE app_private.webiss_import_jobs SET status='expired',token_hash=NULL,finished_at=now()
    WHERE empresa_id=t AND status='pending' AND expires_at<=now();
  IF EXISTS(SELECT 1 FROM app_private.webiss_import_jobs WHERE empresa_id=t AND fiscal_config_id=p_fiscal_config_id
    AND cliente_id=p_cliente_id AND ambiente=p_ambiente AND data_inicial=p_data_inicial AND data_final=p_data_final
    AND status IN ('pending','processing')) THEN RAISE EXCEPTION 'Ja existe importacao em andamento para este escopo.'; END IF;
  capability:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO app_private.webiss_import_jobs(id,empresa_id,user_id,fiscal_config_id,cliente_id,ambiente,data_inicial,data_final,token_hash,expires_at)
    VALUES(job_id,t,p_user_id,p_fiscal_config_id,p_cliente_id,p_ambiente,p_data_inicial,p_data_final,
      encode(extensions.digest(capability,'sha256'),'hex'),now()+interval '10 minutes');
  SELECT net.http_post(
    url:='https://dgklhykjwzmeqxejlicz.supabase.co/functions/v1/webiss-import-worker',
    body:=jsonb_build_object('jobId',job_id),
    headers:=jsonb_build_object('Content-Type','application/json','x-webiss-job-token',capability),
    timeout_milliseconds:=60000
  ) INTO v_request_id;
  UPDATE app_private.webiss_import_jobs j SET request_id=v_request_id WHERE j.id=job_id;
  RETURN jsonb_build_object('jobId',job_id,'requestId',v_request_id);
END;
$$;
CREATE FUNCTION public.claim_webiss_import_job(p_job_id uuid,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j app_private.webiss_import_jobs;
BEGIN
  IF coalesce(p_token,'')!~'^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  UPDATE app_private.webiss_import_jobs SET status='processing',started_at=now(),token_hash=NULL
    WHERE id=p_job_id AND status='pending' AND expires_at>now()
      AND token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    RETURNING * INTO j;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF app_private.webiss_import_actor_empresa(j.user_id)<>j.empresa_id THEN RAISE EXCEPTION 'Contexto do administrador foi alterado.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.configuracoes_integracao_fiscal WHERE id=j.fiscal_config_id AND empresa_id=j.empresa_id
    AND uf='SE' AND lower(trim(municipio))='itabaiana' AND lower(provedor)='webiss')
    OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=j.cliente_id AND empresa_id=j.empresa_id) THEN
    RAISE EXCEPTION 'Contexto do job foi alterado.'; END IF;
  RETURN jsonb_build_object('jobId',j.id,'empresaId',j.empresa_id,'userId',j.user_id,'fiscalConfigId',j.fiscal_config_id,
    'clienteId',j.cliente_id,'ambiente',j.ambiente,'dataInicial',j.data_inicial::text,'dataFinal',j.data_final::text);
END;
$$;
-- If a worker stops after claim, inspect the job/request without reading queue headers.
-- After confirming execution ended, an administrator may finish it as failed, then enqueue explicitly.
-- Never automatically restart processing jobs or reuse the consumed capability.
CREATE FUNCTION public.finish_webiss_import_job(p_job_id uuid,p_result jsonb,p_error text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE safe_result jsonb; j app_private.webiss_import_jobs;
BEGIN
  SELECT * INTO j FROM app_private.webiss_import_jobs WHERE id=p_job_id AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job nao esta em processamento.'; END IF;
  IF nullif(trim(p_error),'') IS NULL THEN
    IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR coalesce(p_result->>'notesCount','')!~'^[0-5]$'
      OR coalesce(p_result->>'pagesRead','')!~'^[0-5]$' OR coalesce(p_result->>'coverage','') NOT IN ('complete','partial') THEN
      RAISE EXCEPTION 'Resumo de importacao invalido.'; END IF;
    safe_result:=jsonb_build_object('notesCount',(p_result->>'notesCount')::integer,'pagesRead',(p_result->>'pagesRead')::integer,
      'coverage',p_result->>'coverage','periodo',jsonb_build_object('inicio',j.data_inicial,'fim',j.data_final),
      'warning',left(p_result->>'warning',500));
  END IF;
  UPDATE app_private.webiss_import_jobs SET status=CASE WHEN nullif(trim(p_error),'') IS NULL THEN 'completed' ELSE 'failed' END,
    resultado=safe_result,erro=left(nullif(trim(p_error),''),300),token_hash=NULL,finished_at=now() WHERE id=p_job_id;
END;
$$;
REVOKE ALL ON FUNCTION app_private.webiss_import_actor_empresa(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.enfileirar_importacao_webiss(uuid,uuid,uuid,text,date,date),public.claim_webiss_import_job(uuid,text),
  public.finish_webiss_import_job(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_importacao_webiss(uuid,uuid,uuid,text,date,date),public.claim_webiss_import_job(uuid,text),
  public.finish_webiss_import_job(uuid,jsonb,text) TO service_role;
COMMIT;
