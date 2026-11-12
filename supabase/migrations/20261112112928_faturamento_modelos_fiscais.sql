BEGIN;
-- Presets WebISS. Não reservam RPS, não transmitem e não alteram notas existentes.
CREATE TABLE app_private.faturamento_modelos_fiscais (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  fiscal_config_id uuid NOT NULL REFERENCES public.configuracoes_integracao_fiscal(id),
  nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 100),
  dados jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  versao integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX faturamento_modelos_empresa ON app_private.faturamento_modelos_fiscais(empresa_id,fiscal_config_id);
ALTER TABLE app_private.faturamento_modelos_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY modelos_tenant ON app_private.faturamento_modelos_fiscais TO authenticated
USING (auth.uid() IS NOT NULL AND empresa_id=public.current_empresa_id())
WITH CHECK (auth.uid() IS NOT NULL AND empresa_id=public.current_empresa_id());
-- API somente por RPCs. Histórico preservado: inativação reversível, sem DELETE.
REVOKE ALL ON app_private.faturamento_modelos_fiscais FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.modelo_fiscal_dto(m app_private.faturamento_modelos_fiscais) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',m.id,'empresaId',m.empresa_id,'fiscalConfigId',m.fiscal_config_id,
 'nome',m.nome,'dados',m.dados,'ativo',m.ativo,'versao',m.versao,'updatedAt',m.updated_at);
$$;
REVOKE ALL ON FUNCTION app_private.modelo_fiscal_dto(app_private.faturamento_modelos_fiscais) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.listar_modelos_fiscais(p_empresa_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid := public.current_empresa_id(); result jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_empresa_id IS DISTINCT FROM t THEN RAISE EXCEPTION 'Empresa fiscal fora da sessao.'; END IF;
 SELECT coalesce(jsonb_agg(app_private.modelo_fiscal_dto(m) ORDER BY m.ativo DESC,lower(m.nome),m.id),'[]'::jsonb)
 INTO result FROM app_private.faturamento_modelos_fiscais m WHERE m.empresa_id=t;
 RETURN result;
END;
$$;

CREATE FUNCTION public.salvar_modelo_fiscal(p_empresa_id uuid,p_id uuid,p_versao integer,p_config_id uuid,p_nome text,p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid := public.current_empresa_id(); m app_private.faturamento_modelos_fiscais; k text; v jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_empresa_id IS DISTINCT FROM t THEN RAISE EXCEPTION 'Empresa fiscal fora da sessao.'; END IF;
 IF p_id IS NULL OR p_versao IS NULL OR p_versao<0 OR p_nome IS NULL OR length(trim(p_nome)) NOT BETWEEN 1 AND 100
 OR jsonb_typeof(p_dados) IS DISTINCT FROM 'object' OR octet_length(p_dados::text)>16000 THEN RAISE EXCEPTION 'Modelo invalido.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.configuracoes_integracao_fiscal f WHERE f.id=p_config_id AND f.empresa_id=t
 AND f.uf='SE' AND lower(trim(f.municipio))='itabaiana' AND lower(f.provedor)='webiss') THEN RAISE EXCEPTION 'Emitente fora da empresa ou provedor nao suportado.'; END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each(p_dados) LOOP
  IF k<>ALL(ARRAY['descricao','valor','itemListaServico','codigoCnae','codigoTributacaoMunicipio','codigoNbs',
   'codigoMunicipio','municipioIncidencia','exigibilidadeIss','issRetido','responsavelRetencao',
   'optanteSimplesNacional','regimeEspecial','incentivoFiscal','aliquotaIss'])
   OR jsonb_typeof(v)<>'string' OR length(v#>>'{}')>4000 THEN RAISE EXCEPTION 'Campo nao permitido no modelo: %',k; END IF;
 END LOOP;
 IF length(trim(coalesce(p_dados->>'descricao',''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Informe a descricao dos servicos.'; END IF;
 FOREACH k IN ARRAY ARRAY['valor','aliquotaIss'] LOOP
  IF coalesce(p_dados->>k,'')<>'' AND (p_dados->>k)!~'^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Valor decimal invalido: %',k; END IF;
 END LOOP;
 IF coalesce(nullif(p_dados->>'aliquotaIss',''),'0')::numeric>100 THEN RAISE EXCEPTION 'Aliquota invalida.'; END IF;
 FOREACH k IN ARRAY ARRAY['codigoMunicipio','municipioIncidencia'] LOOP
  IF coalesce(p_dados->>k,'')<>'' AND (p_dados->>k)!~'^[0-9]{7}$' THEN RAISE EXCEPTION 'Codigo IBGE invalido.'; END IF;
 END LOOP;
 SELECT * INTO m FROM app_private.faturamento_modelos_fiscais WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF m.empresa_id<>t THEN RAISE EXCEPTION 'Modelo indisponivel.'; END IF;
  -- Retry de criação com o mesmo UUID/payload não duplica.
  IF p_versao=0 AND m.fiscal_config_id=p_config_id AND m.nome=trim(p_nome) AND m.dados=p_dados THEN RETURN app_private.modelo_fiscal_dto(m); END IF;
  IF m.versao<>p_versao OR NOT m.ativo THEN RAISE EXCEPTION 'Modelo alterado ou inativo. Recarregue antes de editar.'; END IF;
  UPDATE app_private.faturamento_modelos_fiscais SET nome=trim(p_nome),dados=p_dados,fiscal_config_id=p_config_id,
   versao=versao+1,updated_by=auth.uid(),updated_at=now() WHERE id=p_id AND empresa_id=t RETURNING * INTO m;
 ELSE
  IF p_versao<>0 THEN RAISE EXCEPTION 'Modelo nao encontrado.'; END IF;
  INSERT INTO app_private.faturamento_modelos_fiscais(id,empresa_id,fiscal_config_id,nome,dados,created_by,updated_by)
  VALUES(p_id,t,p_config_id,trim(p_nome),p_dados,auth.uid(),auth.uid()) RETURNING * INTO m;
 END IF;
 RETURN app_private.modelo_fiscal_dto(m);
END;
$$;

CREATE FUNCTION public.ativar_modelo_fiscal(p_empresa_id uuid,p_id uuid,p_versao integer,p_ativo boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_empresa_id(); m app_private.faturamento_modelos_fiscais;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_empresa_id IS DISTINCT FROM t THEN RAISE EXCEPTION 'Empresa fiscal fora da sessao.'; END IF;
 SELECT * INTO m FROM app_private.faturamento_modelos_fiscais WHERE id=p_id AND empresa_id=t FOR UPDATE;
 IF NOT FOUND OR p_ativo IS NULL OR p_versao IS NULL OR m.versao<>p_versao THEN RAISE EXCEPTION 'Modelo alterado ou indisponivel. Recarregue.'; END IF;
 UPDATE app_private.faturamento_modelos_fiscais SET ativo=p_ativo,versao=versao+1,updated_by=auth.uid(),updated_at=now()
 WHERE id=p_id AND empresa_id=t RETURNING * INTO m;
 RETURN app_private.modelo_fiscal_dto(m);
END;
$$;
REVOKE ALL ON FUNCTION public.listar_modelos_fiscais(uuid),public.salvar_modelo_fiscal(uuid,uuid,integer,uuid,text,jsonb),
 public.ativar_modelo_fiscal(uuid,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_modelos_fiscais(uuid),public.salvar_modelo_fiscal(uuid,uuid,integer,uuid,text,jsonb),
 public.ativar_modelo_fiscal(uuid,uuid,integer,boolean) TO authenticated;
COMMIT;
