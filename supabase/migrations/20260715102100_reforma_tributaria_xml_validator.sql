-- Validacao estrutural e aritmetica de XML fiscal com IBS/CBS.

CREATE OR REPLACE FUNCTION public.reforma_tributaria_xml_text(p_xml xml, p_xpath text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((xpath(p_xpath, p_xml))[1]::text, '');
$$;
CREATE OR REPLACE FUNCTION public.validar_reforma_tributaria_xml(
  p_cliente_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id(); v_conteudo text := COALESCE(p_payload->>'conteudoXml', '');
  v_documento xml;
  v_regime text; v_cliente_cnpj text; v_emitente_cnpj text;
  v_tipo text := 'desconhecido';
  v_modelo text; v_chave text; v_emitido_text text;
  v_emitido_em timestamptz;
  v_hash text; v_cst text; v_classe text; v_bc text;
  v_pcbs text; v_vcbs text; v_pibs_uf text; v_pibs_mun text; v_vibs text;
  v_grupos xml[];
  v_grupo xml;
  v_mono boolean; v_regra_especial boolean;
  v_itens integer; v_grupos_itens integer;
  v_inconsistencias jsonb := '[]'::jsonb;
  v_erro boolean := false;
  v_resultado text; v_id uuid; v_checklist jsonb; v_campos jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL OR NOT public.reforma_tributaria_cliente_autorizado(p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao pertence ao escritorio.';
  END IF;
  IF NOT public.reforma_tributaria_tem_permissao('reforma-tributaria:manage') THEN RAISE EXCEPTION
    'Permissao de gerenciamento da Reforma Tributaria necessaria.'; END IF;
  IF length(COALESCE(p_payload->>'arquivoNome', '')) > 255 THEN RAISE EXCEPTION
    'Nome de arquivo excede o limite permitido.'; END IF;
  IF v_conteudo = '' OR octet_length(v_conteudo) > 10485760 THEN RAISE EXCEPTION
    'XML vazio ou maior que 10 MB.'; END IF;
  IF v_conteudo ~* '<!DOCTYPE|<!ENTITY' THEN RAISE EXCEPTION
    'Declaracoes DTD e entidades nao sao aceitas.'; END IF;
  BEGIN
    SELECT xmlparse(document v_conteudo) INTO v_documento;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'XML malformado.';
  END;
  SELECT c.tipo, regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g')
  INTO v_regime, v_cliente_cnpj
  FROM public.clientes c
  WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa_id;
  IF COALESCE(array_length(xpath('//*[local-name()="infCte"]', v_documento), 1), 0) > 0 THEN
    v_tipo := 'cte';
  ELSIF COALESCE(array_length(xpath('//*[local-name()="infMDFe"]', v_documento), 1), 0) > 0 THEN
    v_tipo := 'mdfe';
  ELSIF COALESCE(array_length(xpath('//*[local-name()="InfNfse" or local-name()="CompNfse"]', v_documento), 1), 0) > 0 THEN
    v_tipo := 'nfse';
  ELSIF COALESCE(array_length(xpath('//*[local-name()="infNFe"]', v_documento), 1), 0) > 0 THEN
    v_modelo := public.reforma_tributaria_xml_text(v_documento, 'string((//*[local-name()="ide"]/*[local-name()="mod"])[1])');
    v_tipo := CASE WHEN v_modelo = '65' THEN 'nfce' ELSE 'nfe' END;
  END IF;
  v_emitente_cnpj := regexp_replace(public.reforma_tributaria_xml_text(
    v_documento,
    'string(((//*[local-name()="emit"]//*[local-name()="CNPJ"]) | (//*[local-name()="prest"]//*[local-name()="CNPJ"]) | (//*[local-name()="Prestador"]//*[local-name()="Cnpj"]))[1])'
  ), '\D', '', 'g');
  v_chave := regexp_replace(public.reforma_tributaria_xml_text(
    v_documento,
    'string(((//*[local-name()="infNFe"]/@Id) | (//*[local-name()="infCte"]/@Id) | (//*[local-name()="infMDFe"]/@Id) | (//*[local-name()="chNFe"]) | (//*[local-name()="chCTe"]) | (//*[local-name()="chMDFe"]))[1])'
  ), '^(NFe|CTe|MDFe)', '');
  v_emitido_text := public.reforma_tributaria_xml_text(
    v_documento,
    'string(((//*[local-name()="dhEmi"]) | (//*[local-name()="dEmi"]) | (//*[local-name()="DataEmissao"]))[1])'
  );
  IF v_emitido_text <> '' THEN
    BEGIN
      v_emitido_em := v_emitido_text::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
        'campo', 'emissao', 'severidade', 'aviso', 'mensagem', 'Data de emissao nao pode ser interpretada.'
      ));
    END;
  END IF;
  IF v_tipo = 'desconhecido' THEN
    v_erro := true;
    v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
      'campo', 'documento', 'severidade', 'erro', 'mensagem', 'Tipo de documento fiscal nao identificado no XML.'
    ));
  END IF;
  IF v_emitente_cnpj = '' OR v_cliente_cnpj = '' OR v_emitente_cnpj <> v_cliente_cnpj THEN
    v_erro := true;
    v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
      'campo', 'CNPJ', 'severidade', 'erro',
      'mensagem', 'CNPJ do emitente ausente ou diferente do cliente selecionado.'
    ));
  END IF;
  v_grupos := xpath('//*[local-name()="IBSCBS" or ((local-name()="gIBSCBS" or local-name()="gIBSCBSMono") and not(ancestor::*[local-name()="IBSCBS"]))]', v_documento);
  v_itens := COALESCE(array_length(xpath('//*[local-name()="det"]', v_documento), 1), 0);
  v_grupos_itens := COALESCE(array_length(xpath(
    '//*[local-name()="det"]//*[local-name()="IBSCBS" or ((local-name()="gIBSCBS" or local-name()="gIBSCBSMono") and not(ancestor::*[local-name()="IBSCBS"]))]',
    v_documento
  ), 1), 0);
  IF COALESCE(array_length(v_grupos, 1), 0) = 0 THEN
    v_erro := v_erro OR v_regime IN ('Lucro Presumido', 'Lucro Real');
    v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
      'campo', 'IBSCBS', 'severidade', CASE WHEN v_regime IN ('Lucro Presumido', 'Lucro Real') THEN 'erro' ELSE 'aviso' END,
      'mensagem', 'Grupo de IBS/CBS nao localizado no XML original.'
    ));
  ELSIF COALESCE(array_length(xpath('//*[local-name()="det" and not(.//*[local-name()="IBSCBS" or ((local-name()="gIBSCBS" or local-name()="gIBSCBSMono") and not(ancestor::*[local-name()="IBSCBS"]))])]', v_documento), 1), 0) > 0
    AND v_regime IN ('Lucro Presumido', 'Lucro Real') THEN
    v_erro := true;
    v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
      'campo', 'itens', 'severidade', 'erro', 'mensagem', 'Ha itens sem grupo IBS/CBS.'
    ));
  END IF;
  FOREACH v_grupo IN ARRAY COALESCE(v_grupos, ARRAY[]::xml[]) LOOP
    v_mono := COALESCE(array_length(xpath('self::*[local-name()="gIBSCBSMono"] | .//*[local-name()="gIBSCBSMono"]', v_grupo), 1), 0) > 0;
    v_cst := public.reforma_tributaria_xml_text(v_grupo, 'string((//*[local-name()="CST"])[1])');
    v_classe := public.reforma_tributaria_xml_text(v_grupo, 'string((//*[local-name()="cClassTrib"])[1])');
    v_bc := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string((//*[local-name()="qBCMono"])[1])' ELSE 'string((//*[local-name()="vBC"])[1])' END);
    v_pcbs := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string((//*[local-name()="adRemCBS"])[1])' ELSE 'string((//*[local-name()="pCBS"])[1])' END);
    v_vcbs := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string((//*[local-name()="vCBSMono"])[1])' ELSE 'string((//*[local-name()="vCBS"])[1])' END);
    v_pibs_uf := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string((//*[local-name()="adRemIBS"])[1])' ELSE 'string((//*[local-name()="pIBSUF"])[1])' END);
    v_pibs_mun := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string(0)' ELSE 'string((//*[local-name()="pIBSMun"])[1])' END);
    v_vibs := public.reforma_tributaria_xml_text(v_grupo, CASE WHEN v_mono THEN 'string((//*[local-name()="vIBSMono"])[1])' ELSE 'string((//*[local-name()="vIBS"])[1])' END);
    v_regra_especial := COALESCE(array_length(xpath('.//*[starts-with(local-name(), "gDif") or starts-with(local-name(), "gRed") or starts-with(local-name(), "gDev") or starts-with(local-name(), "gCred") or starts-with(local-name(), "gTransf") or starts-with(local-name(), "gEstorno")]', v_grupo), 1), 0) > 0;
    IF v_cst = '' OR v_classe = '' THEN
      v_erro := v_erro OR v_regime IN ('Lucro Presumido', 'Lucro Real');
      v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
        'campo', 'classificacao', 'severidade', CASE WHEN v_regime IN ('Lucro Presumido', 'Lucro Real') THEN 'erro' ELSE 'aviso' END,
        'mensagem', 'Grupo IBS/CBS sem CST ou cClassTrib.'
      ));
    END IF;
    IF NOT (v_bc ~ '^[0-9]+([.][0-9]+)?$' AND v_pcbs ~ '^[0-9]+([.][0-9]+)?$'
      AND v_vcbs ~ '^[0-9]+([.][0-9]+)?$' AND v_pibs_uf ~ '^[0-9]+([.][0-9]+)?$'
      AND v_pibs_mun ~ '^[0-9]+([.][0-9]+)?$' AND v_vibs ~ '^[0-9]+([.][0-9]+)?$') THEN
      v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
        'campo', 'valores', 'severidade', 'aviso',
        'mensagem', 'Tratamento sem campos do calculo padrao; exige revisao conforme CST e cClassTrib.'
      ));
    ELSIF v_regra_especial THEN
      v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
        'campo', 'tratamentoEspecial', 'severidade', 'aviso',
        'mensagem', 'Reducao, diferimento, devolucao ou credito especial detectado; revisar pela regra fiscal especifica.'
      ));
    ELSE
      IF abs(v_vcbs::numeric - round(v_bc::numeric * v_pcbs::numeric / CASE WHEN v_mono THEN 1 ELSE 100 END, 2)) > 0.02 THEN
        v_erro := true;
        v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
          'campo', 'vCBS', 'severidade', 'erro', 'mensagem', 'Valor CBS diverge da base multiplicada pela aliquota.'
        ));
      END IF;
      IF abs(v_vibs::numeric - round(v_bc::numeric * (v_pibs_uf::numeric + v_pibs_mun::numeric) / CASE WHEN v_mono THEN 1 ELSE 100 END, 2)) > 0.02 THEN
        v_erro := true;
        v_inconsistencias := v_inconsistencias || jsonb_build_array(jsonb_build_object(
          'campo', 'vIBS', 'severidade', 'erro', 'mensagem', 'Valor IBS diverge da base e aliquotas UF/municipio.'
        ));
      END IF;
    END IF;
  END LOOP;
  v_resultado := CASE WHEN v_erro THEN 'invalido' WHEN jsonb_array_length(v_inconsistencias) > 0 THEN 'alerta' ELSE 'valido' END;
  v_hash := encode(digest(convert_to(v_conteudo, 'UTF8'), 'sha256'), 'hex');
  v_campos := jsonb_build_object(
    'cnpjEmitente', v_emitente_cnpj, 'gruposIbsCbs', COALESCE(array_length(v_grupos, 1), 0),
    'itens', v_itens, 'gruposEmItens', v_grupos_itens, 'hashSha256', v_hash
  );
  INSERT INTO public.reforma_tributaria_validacoes_xml (
    empresa_id, cliente_id, arquivo_nome, tipo_documento, chave_acesso,
    emitido_em, arquivo_hash_sha256, resultado, campos, inconsistencias, versao_regra, validado_por
  ) VALUES (
    v_empresa_id, p_cliente_id, COALESCE(NULLIF(p_payload->>'arquivoNome', ''), 'documento.xml'),
    v_tipo, NULLIF(v_chave, ''), v_emitido_em, v_hash, v_resultado, v_campos, v_inconsistencias, 'rtc-2026.2', auth.uid()
  ) RETURNING id INTO v_id;
  INSERT INTO public.reforma_tributaria_adequacoes (empresa_id, cliente_id, atualizado_por)
  VALUES (v_empresa_id, p_cliente_id, auth.uid())
  ON CONFLICT (empresa_id, cliente_id) DO NOTHING;
  SELECT a.checklist INTO v_checklist FROM public.reforma_tributaria_adequacoes a
  WHERE a.empresa_id = v_empresa_id AND a.cliente_id = p_cliente_id;
  v_checklist := jsonb_set(
    jsonb_set(v_checklist, '{xml_emitido}', 'true'::jsonb),
    '{xml_validado}', to_jsonb(v_resultado <> 'invalido'), true
  );
  UPDATE public.reforma_tributaria_adequacoes
  SET checklist = v_checklist,
      status = CASE WHEN v_resultado = 'invalido' THEN 'xml_inconsistente'
        ELSE public.reforma_tributaria_status_checklist(v_checklist) END,
      atualizado_por = auth.uid(), updated_at = now()
  WHERE empresa_id = v_empresa_id AND cliente_id = p_cliente_id;
  RETURN jsonb_build_object(
    'id', v_id, 'resultado', v_resultado, 'inconsistencias', v_inconsistencias,
    'versaoRegra', 'rtc-2026.2', 'hashSha256', v_hash
  );
END;
$$;
REVOKE ALL ON FUNCTION public.reforma_tributaria_cliente_autorizado(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reforma_tributaria_tem_permissao(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reforma_tributaria_status_checklist(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reforma_tributaria_xml_text(xml, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_reforma_tributaria_painel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_reforma_tributaria_adequacao(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atualizar_reforma_tributaria_checklist(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_reforma_tributaria_xml(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_reforma_tributaria_painel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reforma_tributaria_adequacao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_reforma_tributaria_checklist(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_reforma_tributaria_xml(uuid, jsonb) TO authenticated;
