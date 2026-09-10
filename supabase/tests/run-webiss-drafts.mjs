// Isolated PostgreSQL behaviour tests. Never connects to the application database.
// node supabase/tests/run-webiss-drafts.mjs /tmp/.../@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const ids = { tenant:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',
  config:'00000000-0000-4000-8000-000000000011',client:'00000000-0000-4000-8000-000000000021' };
const scalar = async (sql,values=[]) => Object.values((await db.query(sql,values)).rows[0])[0];
try {
  await db.exec(await read('fixtures/webiss_schema.sql'));
  await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT public.current_empresa_id()$$;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS $$SELECT sha256(convert_to($1,'UTF8'))$$;
    ALTER TABLE configuracoes_empresa ADD COLUMN razao_social text;
    ALTER TABLE configuracoes_integracao_fiscal ADD COLUMN created_at timestamptz DEFAULT now();`);
  const cpfSource=await read('../migrations/20260901124629_acesso_funcionario_cpf.sql');
  const cpfNormalize=cpfSource.indexOf('CREATE OR REPLACE FUNCTION public.normalizar_cpf(');
  await db.exec(cpfSource.slice(cpfNormalize,cpfSource.indexOf('$$;',cpfNormalize)+3));
  const cpfStart=cpfSource.indexOf('CREATE OR REPLACE FUNCTION public.cpf_valido(');
  await db.exec(cpfSource.slice(cpfStart,cpfSource.indexOf('$$;',cpfStart)+3));
  for(const migration of ['20260907135151_webiss_emissao_segura.sql','20260907135202_webiss_parametros_diagnostico.sql',
    '20260910030106_webiss_rascunhos_fiscais.sql','20260910030107_webiss_rascunhos_emissao.sql','20260910030109_webiss_notas_consultadas_historico.sql','20260910032827_webiss_historico_filtros.sql']) {
    await db.exec(await read('../migrations/'+migration));
    console.log('PASS migration '+migration);
  }
  await db.query("select set_config('test.empresa',$1,false)",[ids.tenant]);
  await db.query('insert into empresas(id) values($1),($2)',[ids.tenant,ids.other]);
  await db.query("insert into configuracoes_empresa(id,empresa_id,cnpj,razao_social) values($1,$1,'11222333000181','Emitente')",[ids.tenant]);
  await db.query("insert into clientes(id,empresa_id,cnpj,tipo,nome,razao_social,endereco,bairro,cidade,uf,cep) values($1,$2,'11144477735','PF','Cliente','Cliente','Rua teste','Centro','Itabaiana','SE','49500000')",[ids.client,ids.tenant]);
  await db.query(`insert into configuracoes_integracao_fiscal(id,empresa_id,ativo,uf,municipio,provedor,ambiente,configuracao,
    certificado_arquivo_secret_id,certificado_senha_secret_id,certificado_metadata)
    values($1,$2,true,'SE','Itabaiana','WebISS','homologacao',
    '{"inscricaoMunicipal":"12345","serieRps":"A","proximoNumeroRps":"1"}',gen_random_uuid(),gen_random_uuid(),
    '{"certificadoCNPJ":"11222333000181","certificadoValidade":"2099-12-31"}')`,[ids.config,ids.tenant]);
  const dados={competencia:'2026-09-01',dataEmissao:'2026-09-10',descricao:'SERVICOS CONTABEIS REF. 08/2026',valor:'405.00',
    itemListaServico:'17.03',codigoCnae:'6920601',codigoTributacaoMunicipio:'1703',codigoMunicipio:'2802908',municipioIncidencia:'2800308',
    exigibilidadeIss:'1',issRetido:'2',optanteSimplesNacional:'1',incentivoFiscal:'2',aliquotaIss:'3.51',tomadorNumero:'10',tomadorCodigoMunicipio:'2802908'};
  const input={fiscalConfigId:ids.config,clienteId:ids.client,ambiente:'homologacao',dados};
  let draft=await scalar('select salvar_rascunho_nfse_webiss($1)',[input]);
  assert.equal(await scalar('select count(*)::int from financeiro_cobrancas'),0);
  let review=await scalar('select revisar_rascunho_nfse_webiss($1)',[draft.id]);
  assert.equal(review.ready,true,JSON.stringify(review.blockers));
  assert.equal(await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal"),'1');
  assert.equal(await scalar('select rps_numero from app_private.webiss_rascunhos where id=$1',[draft.id]),null);
  console.log('PASS save/review create no banking charge or RPS');
  const prepared=await scalar('select preparar_emissao_rascunho_webiss($1,$2)',[ids.tenant,draft.id]);
  assert.equal(prepared.reconciliarPrimeiro,false);
  assert.equal(prepared.servico.competencia,'2026-09-01');
  assert.equal(prepared.rps.data,'2026-09-10');
  assert.equal(prepared.servico.municipioIncidencia,'2800308');
  await assert.rejects(scalar('select preparar_emissao_rascunho_webiss($1,$2)',[ids.tenant,draft.id]),/andamento/);
  await assert.rejects(scalar('select salvar_rascunho_nfse_webiss($1)',[{...input,id:draft.id}]),/edicao/);
  const consulted=await scalar('select preparar_consulta_rascunho_webiss($1,$2)',[ids.tenant,draft.id]);
  assert.equal(consulted.tentativaId,prepared.tentativaId);
  assert.equal(await scalar('select status from app_private.webiss_rascunhos where id=$1',[draft.id]),'processando');
  await db.query('select finalizar_tentativa_rascunho_webiss($1,$2,$3,$4,$5)',[ids.tenant,draft.id,prepared.tentativaId,'incerta','timeout']);
  const reconciled=await scalar('select preparar_emissao_rascunho_webiss($1,$2)',[ids.tenant,draft.id]);
  assert.equal(reconciled.reconciliarPrimeiro,true);
  assert.equal(reconciled.rps.numero,prepared.rps.numero);
  assert.equal(await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal"),'2');
  await assert.rejects(scalar('select finalizar_tentativa_rascunho_webiss($1,$2,$3,$4,$5)',[ids.tenant,draft.id,prepared.tentativaId,'rejeitada','stale']),/substituida/);
  console.log('PASS leases, immutable snapshots, uncertain retry and stale token');
  const result={tentativaId:reconciled.tentativaId,xml:'<Nfse/>',codigoVerificacao:'ABC',dataEmissao:'2026-09-10T10:00:00-03:00'};
  await scalar('select confirmar_emissao_rascunho_webiss($1,$2,$3,$4,$5)',[ids.tenant,draft.id,'99','ABC',result]);
  await scalar('select confirmar_emissao_rascunho_webiss($1,$2,$3,$4,$5)',[ids.tenant,draft.id,'99','ABC',result]);
  assert.equal(await scalar('select count(*)::int from configuracoes_integracao_fiscal_logs'),1);
  const notes=await scalar('select listar_ultimas_nfse_parceiro_webiss($1,$2,$3)',[ids.config,ids.client,'homologacao']);
  assert.equal(notes.length,1);
  const copy=await scalar('select copiar_rascunho_nfse_webiss($1,$2,$3,$4,$5,$6)',[draft.id,ids.client,ids.config,'homologacao','2026-10-01','rascunho']);
  assert.equal(copy.rpsNumero,null);assert.equal(copy.numeroNfse,null);assert.equal(copy.dados.competencia,'2026-10-01');
  assert.equal(copy.dados.descricao,dados.descricao);
  console.log('PASS confirmation idempotency, latest evidence and copy resets fiscal identity');
  await assert.rejects(scalar('select salvar_rascunho_nfse_webiss($1)',[{...input,dados:{...dados,descricao:{texto:"nao serializar"}}}]),/devem ser textos/);
  await assert.rejects(scalar('select salvar_rascunho_nfse_webiss($1)',[{...input,dados:{...dados,IBSCBS:{}}}]),/nao suportados/);
  const makeNote=async(number,day,situacao="confirmada",bloqueios=[])=>{
    const xml=`<Nfse numero="${number}"/>`;
    return {numero_nfse:String(number),codigo_verificacao:"V"+number,data_emissao:`2026-09-${String(day).padStart(2,'0')}T10:00:00-03:00`,
      xml,hash_sha256:await scalar("select encode(extensions.digest($1,'sha256'),'hex')",[xml]),situacao,dados,qualidade:{faltantes:[],bloqueios,limitacoes:[]}};
  };
  const canceled=await makeNote(99,10,"cancelada");
  await scalar('select registrar_notas_consultadas_webiss($1,$2,$3,$4,$5)',[ids.tenant,ids.config,ids.client,'homologacao',[canceled]]);
  let history=await scalar('select listar_faturamento_nfse_webiss()');
  const canceledRows=history.filter(x=>x.numeroNfse==='99');
  assert.equal(canceledRows.length,1);assert.equal(canceledRows[0].status,'cancelada');assert.equal(canceledRows[0].origem,'consultada');
  await assert.rejects(scalar('select copiar_rascunho_nfse_webiss($1,$2,$3,$4,$5,$6)',[draft.id,ids.client,ids.config,'homologacao','2026-10-01','rascunho']),/ultimas cinco/);
  const cacheNotes=[];for(let n=101;n<=107;n++)cacheNotes.push(await makeNote(n,n-100,'confirmada',n===107?['IBSCBS nao suportado']:[]));
  for(const batch of [cacheNotes.slice(0,5),cacheNotes.slice(5)])await scalar('select registrar_notas_consultadas_webiss($1,$2,$3,$4,$5)',[ids.tenant,ids.config,ids.client,'homologacao',batch]);
  const latest=await scalar('select listar_ultimas_nfse_parceiro_webiss($1,$2,$3)',[ids.config,ids.client,'homologacao']);
  assert.deepEqual(latest.map(x=>x.numero),['107','106','105','104','103']);
  const period=await scalar('select listar_ultimas_nfse_parceiro_webiss($1,$2,$3,$4,$5)',[ids.config,ids.client,'homologacao','2026-09-01','2026-09-03']);
  assert.deepEqual(period.map(x=>x.numero),['103','102','101']);
  await assert.rejects(scalar('select copiar_rascunho_nfse_webiss($1,$2,$3,$4,$5,$6)',[latest[0].id,ids.client,ids.config,'homologacao','2026-10-01','consultada']),/nao suportados/);
  const periodCopy=await scalar('select copiar_rascunho_nfse_webiss($1,$2,$3,$4,$5,$6,$7,$8)',[period[2].id,ids.client,ids.config,'homologacao','2026-10-01','consultada','2026-09-01','2026-09-03']);
  assert.equal(periodCopy.rpsNumero,null);assert.equal(periodCopy.numeroNfse,null);
  const doc=await scalar('select obter_documento_nfse_webiss($1,$2,$3)',[latest[1].id,'consultada','homologacao']);assert.equal(doc.numero,'106');
  await assert.rejects(scalar('select registrar_notas_consultadas_webiss($1,$2,$3,$4,$5)',[ids.tenant,ids.config,ids.client,'homologacao',[{...cacheNotes[0],hash_sha256:'0'.repeat(64)}]]),/Hash/);
  assert.deepEqual(await scalar('select listar_ultimas_nfse_parceiro_webiss($1,$2,$3)',[ids.config,ids.client,'producao']),[]);
  console.log('PASS cache hash, cancellation precedence, last five ordering, period-before-limit, unsupported copy and environment isolation');
  const filtered=await scalar('select listar_faturamento_nfse_webiss($1,$2,$3,$4,$5,$6,$7)',
    ['homologacao','confirmada','',ids.config,ids.client,'2026-09-01','2026-09-03']);
  assert.deepEqual(filtered.map(x=>x.numeroNfse),['103','102','101']);
  for(const [configId,clientId] of [[ids.other,ids.client],[ids.config,ids.other]]) {
    assert.deepEqual(await scalar('select listar_faturamento_nfse_webiss($1,$2,$3,$4,$5)',
      ['homologacao',null,'',configId,clientId]),[]);
  }
  const oldCall=await scalar('select listar_faturamento_nfse_webiss($1,$2,$3)',['homologacao','confirmada','106']);
  assert.equal(oldCall.length,1);assert.equal(oldCall[0].numeroNfse,'106');
  assert.equal(await scalar("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='listar_faturamento_nfse_webiss'"),1);
  await assert.rejects(scalar('select listar_faturamento_nfse_webiss(p_data_inicial=>$1,p_data_final=>$2)',['2026-09-10','2026-09-01']),/Periodo fiscal invalido/);
  const beforeMidnight={...await makeNote(108,8),data_emissao:'2026-09-09T01:30:00Z'};
  const midnight={...await makeNote(109,9),data_emissao:'2026-09-09T03:00:00Z'};
  await scalar('select registrar_notas_consultadas_webiss($1,$2,$3,$4,$5)',[ids.tenant,ids.config,ids.client,'homologacao',[beforeMidnight,midnight]]);
  const localDay=await scalar('select listar_faturamento_nfse_webiss(p_data_inicial=>$1,p_data_final=>$2)',['2026-09-09','2026-09-09']);
  assert.deepEqual(localDay.map(x=>x.numeroNfse),['109']);
  console.log('PASS history exact emitter/partner/status/period filters, municipal timezone, legacy calls and no RPC overload');

  await db.query("update configuracoes_integracao_fiscal set ativo=false where id=$1",[ids.config]);
  const consultInactive=await scalar('select preparar_consulta_parceiro_webiss($1,$2,$3,$4)',[ids.tenant,ids.config,ids.client,'producao']);
  assert.equal(consultInactive.ambiente,'producao');
  assert.equal((await scalar('select revisar_rascunho_nfse_webiss($1)',[copy.id])).ready,false);
  await db.query("select set_config('test.empresa',$1,false)",[ids.other]);
  await assert.rejects(scalar('select revisar_rascunho_nfse_webiss($1)',[draft.id]),/nao encontrado/);
  assert.deepEqual(await scalar('select listar_faturamento_nfse_webiss()'),[]);
  await assert.rejects(scalar('select obter_documento_nfse_webiss($1)',[draft.id]),/nao encontrado/);
  await assert.rejects(scalar('select salvar_rascunho_nfse_webiss($1)',[{...input,id:draft.id}]),/fora do tenant/);
  console.log('PASS inactive config permits only consultation; tenant isolation');
  await db.exec('SET ROLE anon');
  await assert.rejects(scalar('select listar_faturamento_nfse_webiss()'),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await assert.rejects(scalar('select preparar_emissao_rascunho_webiss($1,$2)',[ids.tenant,draft.id]),/permission denied/);
  await db.exec('RESET ROLE');
  console.log('PASS anonymous and direct privileged RPC calls denied');
} catch(error) { console.error(error.message,error.where || ""); process.exitCode=1; } finally { await db.close(); }
