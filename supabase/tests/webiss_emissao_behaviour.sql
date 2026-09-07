-- Rodar exclusivamente sobre fixtures/webiss_schema.sql em PostgreSQL isolado.
BEGIN;
INSERT INTO empresas VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO configuracoes_empresa VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','11222333000181');
INSERT INTO clientes(id,empresa_id,cnpj,tipo,nome) VALUES ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','11222333000181','PJ','Tomador fixture');
INSERT INTO configuracoes_integracao_fiscal(id,empresa_id,ativo,uf,municipio,provedor,ambiente,configuracao,certificado_arquivo_secret_id,certificado_senha_secret_id)
VALUES ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000001',true,'SE','Itabaiana','WebISS','homologacao',
  '{"inscricaoMunicipal":"123","codigoCnae":"6920601","codigoServico":"1701","itemListaServico":"17.01","optanteSimplesNacional":"2","proximoNumeroRps":"1","serieRps":"A"}',
  '00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000031');
INSERT INTO vault.decrypted_secrets VALUES ('00000000-0000-4000-8000-000000000030','CERTIFICADO_FIXTURE'),('00000000-0000-4000-8000-000000000031','SENHA_FIXTURE');
INSERT INTO financeiro_cobrancas(id,empresa_id,cliente_empresa_id,status,valor,descricao)
VALUES ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','Pendente',100,'Servico fixture');

DO $$
DECLARE
  empresa uuid := '00000000-0000-4000-8000-000000000001';
  outra uuid := '00000000-0000-4000-8000-000000000002';
  cobranca uuid := '00000000-0000-4000-8000-000000000040';
  preparado jsonb;
  retomado jsonb;
  resultado text;
  bloqueado boolean;
BEGIN
  bloqueado := false;
  BEGIN PERFORM preparar_emissao_nfse_webiss(outra,cobranca);
  EXCEPTION WHEN OTHERS THEN bloqueado := SQLERRM LIKE '%fora do tenant%'; END;
  ASSERT bloqueado, 'Outro tenant conseguiu preparar emissao';
  preparado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT preparado->>'ambiente' = 'homologacao';
  ASSERT (preparado->>'reconciliarPrimeiro')::boolean = false;
  ASSERT preparado->>'certificadoBase64' = 'CERTIFICADO_FIXTURE';
  ASSERT NOT EXISTS (SELECT 1 FROM app_private.webiss_emissoes WHERE snapshot::text LIKE '%FIXTURE%'), 'Segredo persistido no snapshot';
  bloqueado := false;
  BEGIN PERFORM preparar_emissao_nfse_webiss(empresa,cobranca);
  EXCEPTION WHEN OTHERS THEN bloqueado := SQLERRM LIKE '%em andamento%'; END;
  ASSERT bloqueado, 'Segunda chamada recebeu permissao para transmitir';
  PERFORM finalizar_tentativa_nfse_webiss(empresa,cobranca,(preparado->>'tentativaId')::uuid,'incerta','Timeout fixture');
  UPDATE configuracoes_integracao_fiscal SET configuracao = configuracao || '{"serieRps":"B","codigoServico":"999"}';
  retomado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT (retomado->>'reconciliarPrimeiro')::boolean, 'Timeout permitiu reenviar';
  ASSERT retomado->'rps' = preparado->'rps' AND retomado->'servico' = preparado->'servico', 'Snapshot mudou apos envio incerto';
  ASSERT retomado->>'tentativaId' <> preparado->>'tentativaId';
  bloqueado := false;
  BEGIN PERFORM confirmar_emissao_nfse_webiss(empresa,cobranca,'123','V',jsonb_build_object('tentativaId',preparado->>'tentativaId'));
  EXCEPTION WHEN OTHERS THEN bloqueado := SQLERRM LIKE '%substituida%'; END;
  ASSERT bloqueado, 'Token substituido confirmou resultado';
  PERFORM confirmar_emissao_nfse_webiss(empresa,cobranca,'123','V',jsonb_build_object('tentativaId',retomado->>'tentativaId'));
  ASSERT (SELECT nfse_id IS NULL FROM financeiro_cobrancas WHERE id=cobranca), 'Homologacao marcou cobranca emitida';
  ASSERT (SELECT count(*)=1 FROM configuracoes_integracao_fiscal_logs WHERE status='Sucesso');
  PERFORM confirmar_emissao_nfse_webiss(empresa,cobranca,'123','V',jsonb_build_object('tentativaId',retomado->>'tentativaId'));
  ASSERT (SELECT count(*)=1 FROM configuracoes_integracao_fiscal_logs WHERE status='Sucesso'), 'Confirmacao duplicou log';
  UPDATE configuracoes_integracao_fiscal SET ambiente='producao';
  preparado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT preparado->>'ambiente'='producao' AND (preparado->>'jaEmitida')::boolean = false;
  ASSERT (preparado->>'reconciliarPrimeiro')::boolean = false;
  PERFORM confirmar_emissao_nfse_webiss(empresa,cobranca,'456','V',jsonb_build_object('tentativaId',preparado->>'tentativaId'));
  PERFORM confirmar_emissao_nfse_webiss(empresa,cobranca,'456','V',jsonb_build_object('tentativaId',preparado->>'tentativaId'));
  ASSERT (SELECT nfse_id='456' AND nfse_status='emitida' FROM financeiro_cobrancas WHERE id=cobranca);
  ASSERT (SELECT (stats->>'emitidas')::integer=1 FROM configuracoes_integracao_fiscal);
  ASSERT (preparar_emissao_nfse_webiss(empresa,cobranca)->>'jaEmitida')::boolean;
  bloqueado := false;
  BEGIN PERFORM preparar_consulta_nfse_webiss(outra,cobranca);
  EXCEPTION WHEN OTHERS THEN bloqueado := true; END;
  ASSERT bloqueado, 'Consulta cruzada entre tenants';
END;
$$;

DO $$
DECLARE
  empresa uuid := '00000000-0000-4000-8000-000000000001';
  cobranca uuid := '00000000-0000-4000-8000-000000000041';
  preparado jsonb;
  retomado jsonb;
  bloqueado boolean := false;
BEGIN
  INSERT INTO financeiro_cobrancas(id,empresa_id,cliente_empresa_id,status,valor,descricao)
  VALUES(cobranca,empresa,'00000000-0000-4000-8000-000000000010','Pendente',200,'Outra fixture');
  preparado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT preparado #>> '{rps,numero}' = '2', 'Numerador nao avancou atomicamente';
  PERFORM finalizar_tentativa_nfse_webiss(empresa,cobranca,(preparado->>'tentativaId')::uuid,'falha_pre_envio','Senha invalida');
  UPDATE configuracoes_integracao_fiscal SET configuracao = configuracao || '{"codigoServico":"1702"}';
  retomado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT (retomado->>'reconciliarPrimeiro')::boolean = false, 'Falha local bloqueou correcoes antes de transmitir';
  ASSERT retomado #>> '{rps,numero}' = preparado #>> '{rps,numero}', 'Falha local consumiu novo RPS';
  ASSERT retomado #>> '{servico,codigoTributacaoMunicipio}' = '1702', 'Correcao local nao aplicada';
  -- Uma finalizacao atrasada jamais libera o lock da nova tentativa.
  PERFORM finalizar_tentativa_nfse_webiss(empresa,cobranca,(preparado->>'tentativaId')::uuid,'falha_pre_envio','Resposta atrasada');
  ASSERT (SELECT status='processando' FROM app_private.webiss_emissoes WHERE cobranca_id=cobranca);
  UPDATE app_private.webiss_emissoes SET lease_ate=now()-interval '1 minute' WHERE cobranca_id=cobranca;
  retomado := preparar_emissao_nfse_webiss(empresa,cobranca);
  ASSERT (retomado->>'reconciliarPrimeiro')::boolean, 'Lease vencida permitiu segundo envio';
  PERFORM finalizar_tentativa_nfse_webiss(empresa,cobranca,(retomado->>'tentativaId')::uuid,'incerta','Timeout');
  UPDATE configuracoes_integracao_fiscal SET ambiente='homologacao';
  BEGIN PERFORM preparar_emissao_nfse_webiss(empresa,cobranca);
  EXCEPTION WHEN OTHERS THEN bloqueado := SQLERRM LIKE '%antes de mudar o ambiente%'; END;
  ASSERT bloqueado, 'Mudanca de ambiente ignorou emissao incerta';
  ASSERT preparar_consulta_nfse_webiss(empresa,cobranca)->>'ambiente'='producao', 'Consulta perdeu ambiente original';
END;
$$;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND p.proname IN ('preparar_emissao_nfse_webiss','preparar_consulta_nfse_webiss','finalizar_tentativa_nfse_webiss','confirmar_emissao_nfse_webiss')
  LOOP
    ASSERT NOT has_function_privilege('anon',f,'EXECUTE');
    ASSERT NOT has_function_privilege('authenticated',f,'EXECUTE');
    ASSERT has_function_privilege('service_role',f,'EXECUTE');
  END LOOP;
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='app_private.webiss_emissoes'::regclass);
END;
$$;
ROLLBACK;
