-- Retorno fiscal completo: estado operacional separado da situação municipal.
BEGIN;
ALTER TABLE app_private.webiss_emissoes ADD COLUMN xml_envio text;
ALTER TABLE app_private.webiss_rascunhos ADD COLUMN xml_envio text;

CREATE FUNCTION public.registrar_envio_nfse_webiss(p_user_id uuid,p_cobranca_id uuid,p_tentativa_id uuid,p_xml text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  IF t IS NULL OR nullif(p_xml,'') IS NULL OR octet_length(p_xml)>4194304 THEN RAISE EXCEPTION 'XML de envio invalido.'; END IF;
  UPDATE app_private.webiss_emissoes SET xml_envio=p_xml
    WHERE empresa_id=t AND cobranca_id=p_cobranca_id AND tentativa_id=p_tentativa_id
      AND status='processando' AND lease_ate>now() AND (xml_envio IS NULL OR xml_envio=p_xml);
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa ausente, vencida ou XML de envio divergente.'; END IF;
END;
$$;
CREATE FUNCTION public.registrar_envio_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid,p_tentativa_id uuid,p_xml text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id);
BEGIN
  IF t IS NULL OR nullif(p_xml,'') IS NULL OR octet_length(p_xml)>4194304 THEN RAISE EXCEPTION 'XML de envio invalido.'; END IF;
  UPDATE app_private.webiss_rascunhos SET xml_envio=p_xml
    WHERE empresa_id=t AND id=p_rascunho_id AND tentativa_id=p_tentativa_id
      AND status='processando' AND lease_ate>now() AND (xml_envio IS NULL OR xml_envio=p_xml);
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa ausente, vencida ou XML de envio divergente.'; END IF;
END;
$$;
-- Explicit consultations always retain the same immutable RPS and credentials.
CREATE OR REPLACE FUNCTION public.preparar_consulta_nfse_webiss(p_user_id uuid,p_cobranca_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); a app_private.webiss_emissoes; f public.configuracoes_integracao_fiscal;
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'Usuario sem empresa vinculada.'; END IF;
  SELECT * INTO a FROM app_private.webiss_emissoes WHERE empresa_id=t AND cobranca_id=p_cobranca_id
    ORDER BY (status<>'confirmada') DESC,updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nao existe RPS com contexto preservado para consulta.'; END IF;
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=a.fiscal_config_id AND empresa_id=t;
  RETURN a.snapshot||jsonb_build_object('tentativaId',a.tentativa_id,'jaEmitida',false,'reconciliarPrimeiro',true,
    'nfseId',a.numero_nfse,'certificadoBase64',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_arquivo_secret_id),
    'certificadoSenha',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_senha_secret_id));
END;
$$;
CREATE OR REPLACE FUNCTION public.preparar_consulta_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d app_private.webiss_rascunhos;
BEGIN
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id);
  IF NOT FOUND OR d.snapshot IS NULL THEN RAISE EXCEPTION 'Rascunho ainda nao possui RPS para consulta.'; END IF;
  RETURN app_private.webiss_segredos_rascunho(d)||jsonb_build_object('jaEmitida',false,'reconciliarPrimeiro',true,'nfseId',d.numero_nfse);
END;
$$;
-- Existing confirm functions retain locks, tenant and attempt validation. The wrappers
-- add municipal status/XML refresh atomically, including a previously confirmed note.
ALTER FUNCTION public.confirmar_emissao_nfse_webiss(uuid,uuid,text,text,jsonb) RENAME TO confirmar_emissao_nfse_webiss_base;
ALTER FUNCTION public.confirmar_emissao_rascunho_webiss(uuid,uuid,text,text,jsonb) RENAME TO confirmar_emissao_rascunho_webiss_base;
CREATE FUNCTION app_private.validar_retorno_webiss(p_payload jsonb,p_anterior jsonb,p_protocolo text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE s text:=coalesce(p_payload->>'situacao','confirmada'); previous text:=p_anterior->>'situacao';
BEGIN
  IF s NOT IN ('confirmada','cancelada','substituida') OR nullif(p_payload->>'xml','') IS NULL
    OR nullif(p_protocolo,'') IS NULL OR octet_length(p_payload->>'xml')>4194304 THEN RAISE EXCEPTION 'Retorno fiscal incompleto.'; END IF;
  IF nullif(p_anterior->>'codigoVerificacao','') IS NOT NULL AND p_anterior->>'codigoVerificacao'<>p_protocolo THEN
    RAISE EXCEPTION 'Codigo de verificacao divergente da nota confirmada.';
  END IF;
  IF (previous IN ('cancelada','substituida') AND s='confirmada') OR (previous='substituida' AND s='cancelada') THEN
    RAISE EXCEPTION 'Retorno regrediu situacao municipal; mantenha a evidencia anterior e reconcilie.';
  END IF;
  RETURN s;
END;
$$;
CREATE FUNCTION public.confirmar_emissao_nfse_webiss(p_user_id uuid,p_cobranca_id uuid,p_nfse_id text,p_protocolo text,p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); a app_private.webiss_emissoes; s text; result text; body jsonb;
BEGIN
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id=p_cobranca_id AND empresa_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fora da empresa.'; END IF;
  SELECT * INTO a FROM app_private.webiss_emissoes WHERE cobranca_id=p_cobranca_id AND empresa_id=t
    AND tentativa_id=(p_payload->>'tentativaId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa substituida; consulte o RPS.'; END IF;
  s:=app_private.validar_retorno_webiss(p_payload,a.resultado,p_protocolo);
  PERFORM app_private.validar_retorno_webiss(p_payload,jsonb_build_object('situacao',n.situacao,'codigoVerificacao',n.codigo_verificacao),p_protocolo)
    FROM app_private.webiss_notas_consultadas n WHERE n.empresa_id=t AND n.fiscal_config_id=a.fiscal_config_id
      AND n.ambiente=a.ambiente AND n.numero_nfse=p_nfse_id;
  body:=p_payload||jsonb_build_object('situacao',s);
  result:=public.confirmar_emissao_nfse_webiss_base(p_user_id,p_cobranca_id,p_nfse_id,p_protocolo,body);
  UPDATE app_private.webiss_emissoes SET resultado=body,updated_at=now() WHERE cobranca_id=a.cobranca_id AND ambiente=a.ambiente;
  IF a.ambiente='producao' THEN
    UPDATE public.financeiro_cobrancas SET nfse_payload=body,nfse_status=CASE WHEN s='confirmada' THEN 'emitida' ELSE s END,
      nfse_emitida_em=coalesce(nullif(body->>'dataEmissao','')::timestamptz,nfse_emitida_em),updated_at=now()
      WHERE id=a.cobranca_id AND empresa_id=t;
  END IF;
  UPDATE app_private.webiss_notas_consultadas SET xml=body->>'xml',situacao=s,codigo_verificacao=p_protocolo,
    hash_sha256=encode(extensions.digest(body->>'xml','sha256'),'hex'),sincronizado_em=now()
    WHERE empresa_id=t AND fiscal_config_id=a.fiscal_config_id AND ambiente=a.ambiente AND numero_nfse=p_nfse_id;
  IF a.status='confirmada' AND a.resultado IS DISTINCT FROM body THEN
    INSERT INTO public.configuracoes_integracao_fiscal_logs(empresa_id,fiscal_config_id,usuario_id,operacao,numero_nfse,protocolo,status,mensagem,detalhes)
      VALUES(t,a.fiscal_config_id,p_user_id,'Consulta',p_nfse_id,p_protocolo,'Sucesso','Situacao fiscal e XML reconciliados pelo RPS.',
        body||jsonb_build_object('ambiente',a.ambiente,'cobrancaId',a.cobranca_id));
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION public.confirmar_emissao_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid,p_nfse_id text,p_protocolo text,p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); d app_private.webiss_rascunhos; s text; result text; body jsonb;
BEGIN
  SELECT * INTO d FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=t
    AND tentativa_id=(p_payload->>'tentativaId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa substituida; consulte o RPS.'; END IF;
  s:=app_private.validar_retorno_webiss(p_payload,d.resultado,p_protocolo);
  PERFORM app_private.validar_retorno_webiss(p_payload,jsonb_build_object('situacao',n.situacao,'codigoVerificacao',n.codigo_verificacao),p_protocolo)
    FROM app_private.webiss_notas_consultadas n WHERE n.empresa_id=t AND n.fiscal_config_id=d.fiscal_config_id
      AND n.ambiente=d.ambiente AND n.numero_nfse=p_nfse_id;
  body:=p_payload||jsonb_build_object('situacao',s);
  result:=public.confirmar_emissao_rascunho_webiss_base(p_user_id,p_rascunho_id,p_nfse_id,p_protocolo,body);
  UPDATE app_private.webiss_rascunhos SET resultado=body,emitida_em=coalesce(nullif(body->>'dataEmissao','')::timestamptz,emitida_em),updated_at=now() WHERE id=d.id;
  IF d.cobranca_id IS NOT NULL AND d.ambiente='producao' THEN
    UPDATE public.financeiro_cobrancas SET nfse_payload=body,nfse_status=CASE WHEN s='confirmada' THEN 'emitida' ELSE s END,
      nfse_emitida_em=coalesce(nullif(body->>'dataEmissao','')::timestamptz,nfse_emitida_em),updated_at=now()
      WHERE id=d.cobranca_id AND empresa_id=t;
  END IF;
  UPDATE app_private.webiss_notas_consultadas SET xml=body->>'xml',situacao=s,codigo_verificacao=p_protocolo,
    hash_sha256=encode(extensions.digest(body->>'xml','sha256'),'hex'),sincronizado_em=now()
    WHERE empresa_id=t AND fiscal_config_id=d.fiscal_config_id AND ambiente=d.ambiente AND numero_nfse=p_nfse_id;
  IF d.status='confirmada' AND d.resultado IS DISTINCT FROM body THEN
    INSERT INTO public.configuracoes_integracao_fiscal_logs(empresa_id,fiscal_config_id,usuario_id,operacao,numero_nfse,protocolo,status,mensagem,detalhes)
      VALUES(t,d.fiscal_config_id,p_user_id,'Consulta',p_nfse_id,p_protocolo,'Sucesso','Situacao fiscal e XML reconciliados pelo RPS.',
        body||jsonb_build_object('ambiente',d.ambiente,'rascunhoId',d.id,'cobrancaId',d.cobranca_id));
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_emissao_nfse_webiss_base(uuid,uuid,text,text,jsonb),public.confirmar_emissao_rascunho_webiss_base(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION app_private.validar_retorno_webiss(jsonb,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid,uuid,text,text,jsonb),public.confirmar_emissao_rascunho_webiss(uuid,uuid,text,text,jsonb),
  public.registrar_envio_nfse_webiss(uuid,uuid,uuid,text),public.registrar_envio_rascunho_webiss(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_emissao_nfse_webiss(uuid,uuid,text,text,jsonb),public.confirmar_emissao_rascunho_webiss(uuid,uuid,text,text,jsonb),
  public.registrar_envio_nfse_webiss(uuid,uuid,uuid,text),public.registrar_envio_rascunho_webiss(uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION app_private.webiss_rascunho_dto(p app_private.webiss_rascunhos) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id',p.id,'empresaId',p.empresa_id,'fiscalConfigId',p.fiscal_config_id,
    'clienteId',p.cliente_id,'cobrancaId',p.cobranca_id,'ambiente',p.ambiente,'dados',p.dados,'origemFonte',p.origem,
    'status',coalesce(p.resultado->>'situacao',p.status),'numeroNfse',p.numero_nfse,'codigoVerificacao',p.codigo_verificacao,
    'rpsNumero',p.rps_numero,'rpsSerie',p.rps_serie,'mensagem',p.mensagem,
    'createdAt',p.created_at,'updatedAt',p.updated_at);
$$;

CREATE OR REPLACE FUNCTION app_private.webiss_historico(p_empresa uuid) RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT app_private.webiss_rascunho_dto(d)||jsonb_build_object('origem','rascunho','parceiro',coalesce(nullif(c.razao_social,''),c.nome),
    'valor',d.dados->>'valor','emissao',d.emitida_em,'xmlDisponivel',nullif(d.resultado->>'xml','') IS NOT NULL)
  FROM app_private.webiss_rascunhos d JOIN public.clientes c ON c.id=d.cliente_id AND c.empresa_id=d.empresa_id
  WHERE d.empresa_id=p_empresa AND NOT EXISTS(SELECT 1 FROM app_private.webiss_notas_consultadas n
    WHERE n.empresa_id=d.empresa_id AND n.fiscal_config_id=d.fiscal_config_id AND n.ambiente=d.ambiente AND n.numero_nfse=d.numero_nfse)
  UNION ALL
  SELECT jsonb_build_object('id',n.id,'empresaId',n.empresa_id,'fiscalConfigId',n.fiscal_config_id,'clienteId',n.cliente_id,
    'cobrancaId',NULL,'ambiente',n.ambiente,'dados',n.dados,'status',n.situacao,'numeroNfse',n.numero_nfse,
    'codigoVerificacao',n.codigo_verificacao,'rpsNumero',NULL,'rpsSerie',NULL,'mensagem',NULL,'origem','consultada',
    'parceiro',coalesce(nullif(c.razao_social,''),c.nome),'valor',n.dados->>'valor','emissao',n.data_emissao,
    'createdAt',n.sincronizado_em,'updatedAt',n.sincronizado_em,'xmlDisponivel',true,'qualidade',n.qualidade)
  FROM app_private.webiss_notas_consultadas n JOIN public.clientes c ON c.id=n.cliente_id AND c.empresa_id=n.empresa_id
  WHERE n.empresa_id=p_empresa
  UNION ALL
  SELECT jsonb_build_object('id',a.cobranca_id,'empresaId',a.empresa_id,'fiscalConfigId',a.fiscal_config_id,
    'clienteId',c.id,'cobrancaId',a.cobranca_id,'ambiente',a.ambiente,'dados',a.snapshot->'servico','status',coalesce(a.resultado->>'situacao',a.status),
    'numeroNfse',a.numero_nfse,'codigoVerificacao',a.resultado->>'codigoVerificacao','rpsNumero',a.snapshot#>>'{rps,numero}',
    'rpsSerie',a.snapshot#>>'{rps,serie}','mensagem',a.mensagem,'origem','cobranca','parceiro',coalesce(nullif(c.razao_social,''),c.nome),
    'valor',a.snapshot#>>'{servico,valor}','emissao',a.resultado->>'dataEmissao','createdAt',a.updated_at,'updatedAt',a.updated_at,
    'xmlDisponivel',nullif(a.resultado->>'xml','') IS NOT NULL)
  FROM app_private.webiss_emissoes a JOIN public.financeiro_cobrancas cb ON cb.id=a.cobranca_id AND cb.empresa_id=a.empresa_id
  JOIN public.clientes c ON c.id=cb.cliente_empresa_id AND c.empresa_id=a.empresa_id
  WHERE a.empresa_id=p_empresa AND NOT EXISTS(SELECT 1 FROM app_private.webiss_rascunhos d WHERE d.cobranca_id=a.cobranca_id AND d.ambiente=a.ambiente)
    AND NOT EXISTS(SELECT 1 FROM app_private.webiss_notas_consultadas n WHERE n.fiscal_config_id=a.fiscal_config_id
      AND n.empresa_id=a.empresa_id AND n.ambiente=a.ambiente AND n.numero_nfse=a.numero_nfse);
$$;

-- A proven pre-dispatch failure may discard an archive prepared for that failed attempt.
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_nfse_webiss(
  p_user_id uuid, p_cobranca_id uuid, p_tentativa_id uuid, p_status text, p_mensagem text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_empresa uuid := public.resolve_empresa_id_for_user(p_user_id);
  v_attempt app_private.webiss_emissoes;
BEGIN
  IF v_empresa IS NULL OR p_status IS NULL OR p_status NOT IN ('rejeitada','incerta','falha_pre_envio') THEN
    RAISE EXCEPTION 'Finalizacao fiscal invalida.';
  END IF;
  -- Mesmo ordenamento de locks usado no preparo e na confirmacao.
  PERFORM 1 FROM public.financeiro_cobrancas WHERE id = p_cobranca_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca fiscal fora do tenant.'; END IF;
  IF p_status = 'falha_pre_envio' THEN
    UPDATE app_private.webiss_emissoes SET xml_envio=NULL
      WHERE cobranca_id=p_cobranca_id AND empresa_id=v_empresa AND tentativa_id=p_tentativa_id AND status='processando';
  END IF;
  UPDATE app_private.webiss_emissoes SET status = p_status, lease_ate = NULL,
    mensagem = left(p_mensagem, 1000), updated_at = now()
  WHERE cobranca_id = p_cobranca_id AND empresa_id = v_empresa AND tentativa_id = p_tentativa_id
    AND status = 'processando' RETURNING * INTO v_attempt;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_attempt.ambiente = 'producao' THEN
    UPDATE public.financeiro_cobrancas SET nfse_status = p_status, updated_at = now()
    WHERE id = p_cobranca_id AND empresa_id = v_empresa AND nfse_id IS NULL;
  END IF;
  INSERT INTO public.configuracoes_integracao_fiscal_logs
    (empresa_id, fiscal_config_id, usuario_id, operacao, status, mensagem, detalhes)
  VALUES (v_empresa, v_attempt.fiscal_config_id, p_user_id, 'Emissão',
    CASE WHEN p_status = 'incerta' THEN 'Pendente' ELSE 'Erro' END, left(p_mensagem,1000),
    jsonb_build_object('ambiente',v_attempt.ambiente,'tentativaId',p_tentativa_id,'cobrancaId',p_cobranca_id));
END;
$$;
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_rascunho_webiss(p_user_id uuid,p_rascunho_id uuid,p_tentativa_id uuid,p_status text,p_mensagem text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('falha_pre_envio','rejeitada','incerta') THEN RAISE EXCEPTION 'Estado de tentativa invalido.'; END IF;
  IF p_status='falha_pre_envio' THEN
    UPDATE app_private.webiss_rascunhos SET xml_envio=NULL
      WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id)
        AND tentativa_id=p_tentativa_id AND status='processando';
  END IF;
  UPDATE app_private.webiss_rascunhos SET status=p_status,mensagem=left(p_mensagem,2000),lease_ate=NULL,updated_at=now()
    WHERE id=p_rascunho_id AND empresa_id=public.resolve_empresa_id_for_user(p_user_id)
      AND tentativa_id=p_tentativa_id AND status='processando';
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa substituida ou confirmada; consulte o RPS.'; END IF;
END;
$$;
COMMIT;
