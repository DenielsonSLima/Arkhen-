-- Cache de respostas oficiais, últimas notas por emitente/tomador/ambiente e cópia sem IDs fiscais.
BEGIN;
CREATE TABLE app_private.webiss_notas_consultadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id), ambiente text NOT NULL CHECK(ambiente IN ('homologacao','producao')),
  numero_nfse text NOT NULL, codigo_verificacao text NOT NULL, data_emissao timestamptz NOT NULL,
  xml text NOT NULL, hash_sha256 text NOT NULL, dados jsonb NOT NULL, qualidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  situacao text NOT NULL CHECK(situacao IN ('confirmada','cancelada','substituida')), sincronizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fiscal_config_id,ambiente,numero_nfse)
);
ALTER TABLE app_private.webiss_notas_consultadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.webiss_notas_consultadas FROM PUBLIC,anon,authenticated;
CREATE INDEX webiss_notas_parceiro_data ON app_private.webiss_notas_consultadas(empresa_id,fiscal_config_id,cliente_id,ambiente,data_emissao DESC);
CREATE FUNCTION public.preparar_consulta_parceiro_webiss(p_user_id uuid,p_fiscal_config_id uuid,p_cliente_id uuid,p_ambiente text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); f public.configuracoes_integracao_fiscal; c public.clientes; e jsonb;
BEGIN
  IF t IS NULL OR p_ambiente IS NULL OR p_ambiente NOT IN ('homologacao','producao') THEN RAISE EXCEPTION 'Contexto de consulta invalido.'; END IF;
  SELECT * INTO f FROM public.configuracoes_integracao_fiscal WHERE id=p_fiscal_config_id AND empresa_id=t
    AND uf='SE' AND lower(trim(municipio))='itabaiana' AND lower(provedor)='webiss';
  IF NOT FOUND THEN RAISE EXCEPTION 'Contexto fiscal fora da empresa.'; END IF;
  SELECT * INTO c FROM public.clientes WHERE id=p_cliente_id AND empresa_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tomador fora da empresa.'; END IF;
  IF f.cliente_id IS NULL THEN SELECT to_jsonb(x) INTO e FROM public.configuracoes_empresa x WHERE empresa_id=t;
  ELSE SELECT to_jsonb(x) INTO e FROM public.clientes x WHERE id=f.cliente_id AND empresa_id=t; END IF;
  RETURN jsonb_build_object('empresaId',t,'fiscalConfigId',f.id,'clienteId',c.id,'ambiente',p_ambiente,
    'endpoint',CASE p_ambiente WHEN 'producao' THEN 'https://itabaianase.webiss.com.br/ws/nfse.asmx' ELSE 'https://homologacao.webiss.com.br/ws/nfse.asmx' END,
    'prestador',jsonb_build_object('cnpj',app_private.normalizar_cnpj_alfanumerico(e->>'cnpj'),'inscricaoMunicipal',f.configuracao->>'inscricaoMunicipal'),
    'tomador',jsonb_build_object('documento',app_private.normalizar_cnpj_alfanumerico(c.cnpj)),
    'certificadoBase64',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_arquivo_secret_id),
    'certificadoSenha',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id=f.certificado_senha_secret_id));
END;
$$;
CREATE FUNCTION public.registrar_notas_consultadas_webiss(p_user_id uuid,p_fiscal_config_id uuid,p_cliente_id uuid,p_ambiente text,p_notas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=public.resolve_empresa_id_for_user(p_user_id); n jsonb; existing app_private.webiss_notas_consultadas; total integer:=0;
BEGIN
  -- Reuse the scoped context resolver without returning secrets to the caller.
  PERFORM public.preparar_consulta_parceiro_webiss(p_user_id,p_fiscal_config_id,p_cliente_id,p_ambiente);
  IF jsonb_typeof(p_notas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_notas)>5 THEN RAISE EXCEPTION 'Lote de consulta invalido.'; END IF;
  FOR n IN SELECT value FROM jsonb_array_elements(p_notas) LOOP
    IF coalesce(n->>'numero_nfse','')!~'^[0-9]{1,15}$' OR nullif(n->>'codigo_verificacao','') IS NULL
      OR coalesce(n->>'situacao','') NOT IN ('confirmada','cancelada','substituida')
      OR nullif(n->>'xml','') IS NULL OR octet_length(n->>'xml')>4194304
      OR coalesce(n->>'hash_sha256','')!~'^[0-9a-f]{64}$'
      OR jsonb_typeof(n->'dados') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Nota consultada incompleta.'; END IF;
    IF encode(extensions.digest(n->>'xml','sha256'),'hex')<>n->>'hash_sha256' THEN RAISE EXCEPTION 'Hash do XML consultado diverge.'; END IF;
    SELECT * INTO existing FROM app_private.webiss_notas_consultadas
      WHERE fiscal_config_id=p_fiscal_config_id AND ambiente=p_ambiente AND numero_nfse=n->>'numero_nfse' FOR UPDATE;
    IF FOUND AND (existing.empresa_id<>t OR existing.cliente_id<>p_cliente_id) THEN RAISE EXCEPTION 'Identidade da nota consultada diverge.'; END IF;
    INSERT INTO app_private.webiss_notas_consultadas(empresa_id,fiscal_config_id,cliente_id,ambiente,numero_nfse,codigo_verificacao,
      data_emissao,xml,hash_sha256,dados,qualidade,situacao)
    VALUES(t,p_fiscal_config_id,p_cliente_id,p_ambiente,n->>'numero_nfse',n->>'codigo_verificacao',
      (n->>'data_emissao')::timestamptz,n->>'xml',n->>'hash_sha256',app_private.webiss_dados_permitidos(n->'dados'),
      coalesce(n->'qualidade','{}'::jsonb),n->>'situacao')
    ON CONFLICT(fiscal_config_id,ambiente,numero_nfse) DO UPDATE SET codigo_verificacao=excluded.codigo_verificacao,
      data_emissao=excluded.data_emissao,xml=excluded.xml,hash_sha256=excluded.hash_sha256,dados=excluded.dados,
      qualidade=excluded.qualidade,situacao=excluded.situacao,sincronizado_em=now()
      WHERE app_private.webiss_notas_consultadas.empresa_id=t AND app_private.webiss_notas_consultadas.cliente_id=p_cliente_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Nota consultada foi vinculada a outro tomador; revise os cadastros duplicados.'; END IF;
    total:=total+1;
  END LOOP;
  RETURN total;
END;
$$;
-- Internal projection unifies evidence without deriving cancellation from banking state.
CREATE FUNCTION app_private.webiss_historico(p_empresa uuid) RETURNS SETOF jsonb
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
    'clienteId',c.id,'cobrancaId',a.cobranca_id,'ambiente',a.ambiente,'dados',a.snapshot->'servico','status',a.status,
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
CREATE FUNCTION public.listar_faturamento_nfse_webiss(p_ambiente text DEFAULT NULL,p_status text DEFAULT NULL,p_search text DEFAULT '')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY coalesce(row->>'emissao',row->>'updatedAt')::timestamptz DESC),'[]'::jsonb)
  FROM app_private.webiss_historico(public.current_empresa_id()) row
  WHERE (p_ambiente IS NULL OR row->>'ambiente'=p_ambiente) AND (p_status IS NULL OR row->>'status'=p_status)
    AND (coalesce(trim(p_search),'')='' OR row->>'parceiro' ILIKE '%'||trim(p_search)||'%' OR row->>'numeroNfse' ILIKE '%'||trim(p_search)||'%');
$$;
CREATE FUNCTION public.listar_ultimas_nfse_parceiro_webiss(p_fiscal_config_id uuid,p_cliente_id uuid,p_ambiente text,p_data_inicial date DEFAULT NULL,p_data_final date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'emissao')::timestamptz DESC,(row->>'numero')::numeric DESC),'[]'::jsonb) FROM (
    SELECT row||jsonb_build_object('numero',row->>'numeroNfse','sincronizadoEm',row->>'updatedAt',
      'qualidade',coalesce(row->'qualidade','{}'::jsonb)) AS row
    FROM app_private.webiss_historico(public.current_empresa_id()) row
    WHERE row->>'fiscalConfigId'=p_fiscal_config_id::text AND row->>'clienteId'=p_cliente_id::text
      AND row->>'ambiente'=p_ambiente AND row->>'status'='confirmada' AND row->>'xmlDisponivel'='true'
      AND nullif(row->>'emissao','') IS NOT NULL
      AND (p_data_inicial IS NULL OR (row->>'emissao')::timestamptz >= p_data_inicial::timestamp AT TIME ZONE 'America/Maceio')
      AND (p_data_final IS NULL OR (row->>'emissao')::timestamptz < (p_data_final+1)::timestamp AT TIME ZONE 'America/Maceio')
    ORDER BY (row->>'emissao')::timestamptz DESC,(row->>'numeroNfse')::numeric DESC LIMIT 5
  ) latest;
$$;
CREATE FUNCTION public.copiar_rascunho_nfse_webiss(p_origem_id uuid,p_cliente_id uuid,p_fiscal_config_id uuid,p_ambiente text,
  p_competencia date,p_origem text DEFAULT 'consultada',p_data_inicial date DEFAULT NULL,p_data_final date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE source jsonb; result jsonb; dados jsonb;
BEGIN
  SELECT value INTO source FROM jsonb_array_elements(public.listar_ultimas_nfse_parceiro_webiss(p_fiscal_config_id,p_cliente_id,p_ambiente,p_data_inicial,p_data_final))
    WHERE value->>'id'=p_origem_id::text AND value->>'origem'=p_origem;
  IF source IS NULL THEN RAISE EXCEPTION 'Nota nao pertence as ultimas cinco autorizadas deste emitente/tomador/ambiente.'; END IF;
  IF jsonb_array_length(coalesce(source#>'{qualidade,bloqueios}','[]'::jsonb))>0 THEN
    RAISE EXCEPTION 'A nota possui tributos/estruturas nao suportados para copia: %',source#>'{qualidade,bloqueios}'; END IF;
  IF p_competencia IS NULL THEN RAISE EXCEPTION 'Informe a competencia do novo rascunho.'; END IF;
  dados:=app_private.webiss_dados_permitidos(source->'dados')||jsonb_build_object('competencia',p_competencia::text,
    'dataEmissao',(now() AT TIME ZONE 'America/Maceio')::date::text);
  result:=public.salvar_rascunho_nfse_webiss(jsonb_build_object('fiscalConfigId',p_fiscal_config_id,'clienteId',p_cliente_id,'ambiente',p_ambiente,'dados',dados));
  UPDATE app_private.webiss_rascunhos AS d SET origem=jsonb_build_object('id',p_origem_id,'tipo',p_origem,'numero',source->>'numero',
    'qualidade',source->'qualidade','copiadaEm',now()) WHERE id=(result->>'id')::uuid
    RETURNING app_private.webiss_rascunho_dto(d) INTO result;
  -- Description is preserved for explicit review; never replace arbitrary month substrings.
  RETURN result;
END;
$$;
CREATE FUNCTION public.obter_documento_nfse_webiss(p_rascunho_id uuid,p_origem text DEFAULT 'rascunho',p_ambiente text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE t uuid:=public.current_empresa_id(); result jsonb;
BEGIN
  IF p_origem='rascunho' THEN
    SELECT jsonb_build_object('xml',resultado->>'xml','ambiente',ambiente,'numero',numero_nfse,'codigoVerificacao',codigo_verificacao,'empresaId',empresa_id)
    INTO result FROM app_private.webiss_rascunhos WHERE id=p_rascunho_id AND empresa_id=t AND status='confirmada';
  ELSIF p_origem='consultada' THEN
    SELECT jsonb_build_object('xml',xml,'ambiente',ambiente,'numero',numero_nfse,'codigoVerificacao',codigo_verificacao,'empresaId',empresa_id)
    INTO result FROM app_private.webiss_notas_consultadas WHERE id=p_rascunho_id AND empresa_id=t;
  ELSIF p_origem='cobranca' THEN
    SELECT jsonb_build_object('xml',resultado->>'xml','ambiente',ambiente,'numero',numero_nfse,'codigoVerificacao',resultado->>'codigoVerificacao','empresaId',empresa_id)
    INTO result FROM app_private.webiss_emissoes WHERE cobranca_id=p_rascunho_id AND empresa_id=t AND ambiente=p_ambiente AND status='confirmada';
  END IF;
  IF nullif(result->>'xml','') IS NULL THEN RAISE EXCEPTION 'XML autorizado nao encontrado neste contexto.'; END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION app_private.webiss_historico(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.preparar_consulta_parceiro_webiss(uuid,uuid,uuid,text),public.registrar_notas_consultadas_webiss(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_consulta_parceiro_webiss(uuid,uuid,uuid,text),public.registrar_notas_consultadas_webiss(uuid,uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.listar_faturamento_nfse_webiss(text,text,text),public.listar_ultimas_nfse_parceiro_webiss(uuid,uuid,text,date,date),
  public.copiar_rascunho_nfse_webiss(uuid,uuid,uuid,text,date,text,date,date),public.obter_documento_nfse_webiss(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_faturamento_nfse_webiss(text,text,text),public.listar_ultimas_nfse_parceiro_webiss(uuid,uuid,text,date,date),
  public.copiar_rascunho_nfse_webiss(uuid,uuid,uuid,text,date,text,date,date),public.obter_documento_nfse_webiss(uuid,text,text) TO authenticated;
COMMIT;
