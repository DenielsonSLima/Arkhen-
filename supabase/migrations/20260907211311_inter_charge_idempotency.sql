-- Durable request ownership; once dispatched, retry can only reconcile the provider.
BEGIN;
CREATE TABLE public.inter_cobranca_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK(request_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  request_hash text NOT NULL,
  scope_hash text NOT NULL,
  ambiente text NOT NULL CHECK(ambiente IN ('producao','homologacao')),
  estado text NOT NULL CHECK(estado IN ('preparada','incerta','resultado','concluida')),
  prepared_snapshot jsonb NOT NULL,
  registration jsonb,
  cobranca_id uuid REFERENCES public.financeiro_cobrancas(id),
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_ate timestamptz NOT NULL DEFAULT now() + interval '90 seconds',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id,request_id)
);
CREATE UNIQUE INDEX inter_tentativa_pending_business_idx
  ON public.inter_cobranca_tentativas(empresa_id,ambiente,scope_hash,request_hash) WHERE estado <> 'concluida';
ALTER TABLE public.inter_cobranca_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inter_cobranca_tentativas FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.inter_cobranca_tentativas TO service_role;

CREATE OR REPLACE FUNCTION public.preparar_tentativa_cobranca_inter(p_user_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp AS $$
DECLARE
  v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_request text := trim(coalesce(p_payload->>'request_id',''));
  v_hash text := encode(extensions.digest((p_payload - 'request_id')::text,'sha256'),'hex');
  v_attempt public.inter_cobranca_tentativas; v_prepared jsonb; v_new boolean := false;
  v_cfg jsonb; v_integration public.configuracoes_integracao_bancaria; v_acao text; v_active_env text; v_scope text;
BEGIN
  IF v_empresa IS NULL OR v_request !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'Empresa ou identificador da tentativa invalido.';
  END IF;
  SELECT * INTO v_integration FROM public.configuracoes_integracao_bancaria
  WHERE empresa_id=v_empresa AND provedor='inter';
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuracao Inter ausente.'; END IF;
  v_active_env := public.normalize_inter_environment(v_integration.configuracao->>'activeEnvironment');
  v_cfg := v_integration.configuracao->'environments'->v_active_env;
  v_scope := encode(extensions.digest(coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE id=NULLIF(v_cfg->>'client_id_secret_id','')::uuid),'') || ':' ||
    coalesce(v_cfg->>'contaCorrente',''),'sha256'),'hex');
  -- Serialize distinct request IDs for the same unresolved business operation.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text || ':' || v_hash, 0));
  SELECT * INTO v_attempt FROM public.inter_cobranca_tentativas
  WHERE empresa_id=v_empresa AND request_id=v_request FOR UPDATE;
  IF FOUND AND v_attempt.request_hash <> v_hash THEN
    RAISE EXCEPTION 'Identificador ja utilizado para outra cobranca.';
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO v_attempt FROM public.inter_cobranca_tentativas
    WHERE empresa_id=v_empresa AND request_hash=v_hash AND ambiente=v_active_env
      AND scope_hash=v_scope AND estado<>'concluida' FOR UPDATE;
  END IF;
  IF v_attempt.id IS NULL THEN
    v_prepared := public.preparar_cobranca_inter(p_user_id,p_payload);
    INSERT INTO public.inter_cobranca_tentativas(empresa_id,request_id,request_hash,scope_hash,ambiente,estado,prepared_snapshot)
    VALUES(v_empresa,v_request,v_hash,v_scope,v_prepared->>'ambiente','preparada',
      jsonb_build_object('empresaId',v_empresa,'ambiente',v_prepared->>'ambiente',
        'cliente',v_prepared->'cliente','cobranca',v_prepared->'cobranca',
        '_contaCorrente',coalesce(v_prepared->>'contaCorrente',''),
        '_clientIdHash',encode(extensions.digest(v_prepared->>'clientId','sha256'),'hex')))
    RETURNING * INTO v_attempt;
    v_new := true;
  END IF;
  IF v_attempt.estado='concluida' THEN
    RETURN jsonb_build_object('tentativaId',v_attempt.id,'requestId',v_attempt.request_id,
      'acao','concluida','registration',v_attempt.registration,
      'cobranca',(SELECT to_jsonb(fc) FROM public.financeiro_cobrancas fc
        WHERE fc.id=v_attempt.cobranca_id AND fc.empresa_id=v_empresa));
  END IF;
  IF v_attempt.registration IS NOT NULL THEN
    RETURN jsonb_build_object('tentativaId',v_attempt.id,'requestId',v_attempt.request_id,
      'acao','reconciliar','registration',v_attempt.registration);
  END IF;
  IF NOT v_new AND v_attempt.lease_ate>now() THEN
    RETURN jsonb_build_object('tentativaId',v_attempt.id,'requestId',v_attempt.request_id,'acao','ocupada');
  END IF;
  v_acao := CASE WHEN v_attempt.estado='preparada' THEN 'emitir' ELSE 'reconciliar' END;
  IF NOT v_new THEN
    UPDATE public.inter_cobranca_tentativas SET lease_token=gen_random_uuid(),
      lease_ate=now()+interval '90 seconds',updated_at=now()
    WHERE id=v_attempt.id RETURNING * INTO v_attempt;
    -- Reconciliation uses the original business snapshot even after its due date.
    SELECT * INTO v_integration FROM public.configuracoes_integracao_bancaria
    WHERE empresa_id=v_empresa AND provedor='inter';
    IF NOT FOUND THEN RAISE EXCEPTION 'Configuracao Inter ausente.'; END IF;
    v_cfg := v_integration.configuracao->'environments'->v_attempt.ambiente;
    v_prepared := v_attempt.prepared_snapshot || jsonb_build_object(
      'baseUrl',v_cfg->>'baseUrl','authUrl',v_cfg->>'authUrl',
      'clientId',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=NULLIF(v_cfg->>'client_id_secret_id','')::uuid),
      'clientSecret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=NULLIF(v_cfg->>'client_secret_secret_id','')::uuid),
      'certificadoPem',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=NULLIF(v_cfg->>'certificado_pem_secret_id','')::uuid),
      'chavePrivadaPem',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=NULLIF(v_cfg->>'chave_privada_pem_secret_id','')::uuid),
      'contaCorrente',v_cfg->>'contaCorrente','chavePix',v_cfg->>'chavePix','modulos',v_integration.modulos);
    IF coalesce(v_prepared->>'contaCorrente','') IS DISTINCT FROM v_attempt.prepared_snapshot->>'_contaCorrente'
      OR encode(extensions.digest(v_prepared->>'clientId','sha256'),'hex') IS DISTINCT FROM v_attempt.prepared_snapshot->>'_clientIdHash' THEN
      RAISE EXCEPTION 'Conta ou aplicacao Inter alterada. Restaure a configuracao original para reconciliar esta tentativa.';
    END IF;
  END IF;
  RETURN jsonb_build_object('tentativaId',v_attempt.id,'requestId',v_attempt.request_id,
    'leaseToken',v_attempt.lease_token,'acao',v_acao,'prepared',v_prepared);
END $$;

CREATE OR REPLACE FUNCTION public.iniciar_envio_tentativa_cobranca_inter(
  p_user_id uuid,p_tentativa_id uuid,p_lease_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  UPDATE public.inter_cobranca_tentativas SET estado='incerta',updated_at=now()
  WHERE id=p_tentativa_id AND empresa_id=v_empresa AND estado='preparada'
    AND lease_token=p_lease_token AND lease_ate>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Emissao nao pertence a esta tentativa ou ja foi enviada.'; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.liberar_preparo_tentativa_cobranca_inter(
  p_user_id uuid,p_tentativa_id uuid,p_lease_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.inter_cobranca_tentativas SET lease_ate=now(),updated_at=now()
  WHERE id=p_tentativa_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id)
    AND lease_token=p_lease_token AND estado='preparada';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_resultado_tentativa_cobranca_inter(
  p_user_id uuid,p_tentativa_id uuid,p_payload jsonb,p_lease_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_attempt public.inter_cobranca_tentativas; v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  SELECT * INTO v_attempt FROM public.inter_cobranca_tentativas
  WHERE id=p_tentativa_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_attempt.lease_token IS DISTINCT FROM p_lease_token OR v_attempt.estado NOT IN ('incerta','resultado') THEN
    RAISE EXCEPTION 'Tentativa nao pertence a esta operacao.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_payload->>'ambiente' IS DISTINCT FROM v_attempt.ambiente
    OR NULLIF(p_payload->>'external_id','') IS NULL
    OR p_payload->>'cliente_empresa_id' IS DISTINCT FROM v_attempt.prepared_snapshot->'cobranca'->>'clienteEmpresaId'
    OR (p_payload->>'valor')::numeric IS DISTINCT FROM (v_attempt.prepared_snapshot->'cobranca'->>'valor')::numeric
    OR p_payload->>'data_vencimento' IS DISTINCT FROM v_attempt.prepared_snapshot->'cobranca'->>'dataVencimento'
    OR p_payload->>'meio_pagamento' IS DISTINCT FROM v_attempt.prepared_snapshot->'cobranca'->>'meioPagamento' THEN
    RAISE EXCEPTION 'Resultado divergente da tentativa.';
  END IF;
  IF v_attempt.registration IS NOT NULL AND v_attempt.registration<>p_payload THEN
    RAISE EXCEPTION 'Resultado da tentativa ja registrado.';
  END IF;
  UPDATE public.inter_cobranca_tentativas SET registration=p_payload,estado='resultado',
    lease_ate=now(),updated_at=now() WHERE id=v_attempt.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_tentativa_cobranca_inter(p_user_id uuid,p_tentativa_id uuid)
RETURNS public.financeiro_cobrancas LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_attempt public.inter_cobranca_tentativas; v_charge public.financeiro_cobrancas;
BEGIN
  SELECT * INTO v_attempt FROM public.inter_cobranca_tentativas
  WHERE id=p_tentativa_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa fora da empresa.'; END IF;
  IF v_attempt.estado='concluida' THEN
    SELECT * INTO STRICT v_charge FROM public.financeiro_cobrancas
    WHERE id=v_attempt.cobranca_id AND empresa_id=v_empresa;
    RETURN v_charge;
  END IF;
  IF v_attempt.estado<>'resultado' OR v_attempt.registration IS NULL THEN
    RAISE EXCEPTION 'Tentativa ainda sem resultado confirmado no banco.';
  END IF;
  v_charge := public.registrar_cobranca_inter(p_user_id,v_attempt.registration);
  UPDATE public.inter_cobranca_tentativas SET estado='concluida',cobranca_id=v_charge.id,updated_at=now()
  WHERE id=v_attempt.id;
  RETURN v_charge;
END $$;
REVOKE ALL ON FUNCTION public.preparar_tentativa_cobranca_inter(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.iniciar_envio_tentativa_cobranca_inter(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.liberar_preparo_tentativa_cobranca_inter(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.registrar_resultado_tentativa_cobranca_inter(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.confirmar_tentativa_cobranca_inter(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_tentativa_cobranca_inter(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_envio_tentativa_cobranca_inter(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_preparo_tentativa_cobranca_inter(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_tentativa_cobranca_inter(uuid,uuid,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_tentativa_cobranca_inter(uuid,uuid) TO service_role;
COMMIT;
