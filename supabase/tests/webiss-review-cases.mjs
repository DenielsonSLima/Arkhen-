import assert from 'node:assert/strict';

// Every case uses a fresh local draft. Invalid review must fail before reserving any RPS.
export async function testWebissReview({ db, scalar, ids, input }) {
  const original = (await db.query('select to_jsonb(c) data from clientes c where id=$1', [ids.client])).rows[0].data;
  const config = await scalar('select configuracao from configuracoes_integracao_fiscal where id=$1', [ids.config]);
  const cases = [
    ['CEP incompleto', 'cep', '123', /CEP/],
    ['Razão social longa', 'razao_social', 'A'.repeat(151), /Razao social/],
    ['Razão social em branco', 'razao_social', '  ', /Razao social/],
    ['Razão social só com espaço Unicode', 'razao_social', '\u00a0\u3000', /Razao social/],
    ['Limite UTF-16 do builder', 'razao_social', '😀'.repeat(76), /Razao social/],
    ['Endereço longo', 'endereco', 'A'.repeat(126), /Endereco/],
    ['Bairro longo', 'bairro', 'A'.repeat(61), /Bairro/],
    ['Email longo', 'email', 'a'.repeat(81), /Email/],
    ['UF inválida', 'uf', 'SER', /UF/],
    ['Telefone longo', 'telefone', '1'.repeat(21), /Telefone/],
    ['Caractere de controle', 'endereco', 'Rua\u0001teste', /XML/],
    ['Caractere reservado XML', 'email', 'a\uffff@test.test', /XML/],
    ['Inscrição municipal longa', 'inscricaoMunicipal', '1'.repeat(16), /Inscricao municipal/],
    ['Inscrição municipal em branco', 'inscricaoMunicipal', '  ', /Inscricao municipal/],
    ['Descrição com controle', 'descricao', 'Serviço\u000bcontabil', /XML/],
    ['Número em branco', 'tomadorNumero', '  ', /Numero do endereco/],
    ['Descrição UTF-16 longa', 'descricao', '😀'.repeat(1001), /Discriminacao/],
    ['Código municipal UTF-16 longo', 'codigoTributacaoMunicipio', '😀'.repeat(11), /Codigo municipal/],
  ];
  for (const [name, field, value, error] of cases) {
    const draftInput = { ...input, dados: { ...input.dados } };
    const configField = field === 'inscricaoMunicipal';
    const draftField = ['descricao', 'tomadorNumero', 'codigoTributacaoMunicipio'].includes(field);
    if (configField) await db.query("update configuracoes_integracao_fiscal set configuracao=jsonb_set(configuracao,'{inscricaoMunicipal}',$1::jsonb) where id=$2", [JSON.stringify(value), ids.config]);
    else if (draftField) draftInput.dados[field] = value;
    else await db.query(`update clientes set ${field}=$1 where id=$2`, [value, ids.client]); // fields are constants above
    const before = await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal where id=$1", [ids.config]);
    const draft = await scalar('select salvar_rascunho_nfse_webiss($1)', [draftInput]);
    const review = await scalar('select revisar_rascunho_nfse_webiss($1)', [draft.id]);
    assert.equal(review.ready, false, name);
    assert.match(review.blockers.join(' '), error, name);
    await assert.rejects(scalar('select preparar_emissao_rascunho_webiss($1,$2)', [ids.tenant, draft.id]), /Revisao fiscal pendente/, name);
    const unchanged = (await db.query('select rps_numero, tentativa_id, snapshot, status from app_private.webiss_rascunhos where id=$1', [draft.id])).rows[0];
    assert.deepEqual(unchanged, { rps_numero: null, tentativa_id: null, snapshot: null, status: 'rascunho' }, name);
    assert.equal(await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal where id=$1", [ids.config]), before, name);
    if (configField) await db.query('update configuracoes_integracao_fiscal set configuracao=$1 where id=$2', [config, ids.config]);
    else if (!draftField) await db.query(`update clientes set ${field}=$1 where id=$2`, [original[field], ids.client]);
  }
  // Valid boundaries, formatted digits, accents, XML-escaped symbols and optional absence remain supported.
  await db.query('update clientes set razao_social=$1,endereco=$2,bairro=$3,email=$4,telefone=$5,cep=$6,uf=$7 where id=$8',
    ['R'.repeat(150), 'E'.repeat(125), 'B'.repeat(60), 'a'.repeat(80), '1'.repeat(20), '49.500-000', 'se', ids.client]);
  await db.query("update configuracoes_integracao_fiscal set configuracao=jsonb_set(configuracao,'{inscricaoMunicipal}',$1::jsonb) where id=$2", [JSON.stringify('1'.repeat(15)), ids.config]);
  const valid = await scalar('select salvar_rascunho_nfse_webiss($1)', [{ ...input, dados: { ...input.dados, descricao: 'Serviços & <contábeis>\nCompetência\t2026', tomadorNumero: '1234567890' } }]);
  const reviewed = await scalar('select revisar_rascunho_nfse_webiss($1)', [valid.id]);
  assert.equal(reviewed.ready, true, JSON.stringify(reviewed.blockers));
  assert.equal(reviewed.tomador.cep, '49500000');
  assert.equal(reviewed.tomador.uf, 'SE');
  const unicodeBoundary = await scalar('select salvar_rascunho_nfse_webiss($1)', [{ ...input, dados: {
    ...input.dados, descricao: '😀'.repeat(1000), codigoTributacaoMunicipio: '😀'.repeat(10),
  } }]);
  assert.equal((await scalar('select revisar_rascunho_nfse_webiss($1)', [unicodeBoundary.id])).ready, true);
  await db.query('update clientes set endereco=null,bairro=null,email=null,telefone=null,cep=null,uf=null where id=$1', [ids.client]);
  assert.equal((await scalar('select revisar_rascunho_nfse_webiss($1)', [valid.id])).ready, true);
  await db.query('update clientes set razao_social=$1,endereco=$2,bairro=$3,email=$4,telefone=$5,cep=$6,uf=$7 where id=$8',
    [original.razao_social, original.endereco, original.bairro, original.email, original.telefone, original.cep, original.uf, ids.client]);
  await db.query('update configuracoes_integracao_fiscal set configuracao=$1 where id=$2', [config, ids.config]);
  console.log(`PASS ${cases.length} invalid fiscal reviews block RPS reservation; valid boundaries and optional fields preserved`);
}
