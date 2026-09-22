import assert from 'node:assert/strict';

// Only used by run-webiss-drafts.mjs against the synthetic PGlite database.
export async function testLegacyEmissionGuard({ db, scalar, ids }) {
  const linkedCharge = '00000000-0000-4000-8000-000000000092';
  await db.query(`insert into financeiro_cobrancas(id,empresa_id,cliente_empresa_id,valor,status)
    values($1,$2,$3,405,'Pendente')`, [linkedCharge, ids.tenant, ids.client]);
  assert.equal(await scalar('select obter_rascunho_cobranca_webiss($1)', [linkedCharge]), null);
  const saved = [];
  for (const ambiente of ['homologacao', 'producao']) {
    saved.push(await scalar('select salvar_rascunho_nfse_webiss($1)', [{ cobrancaId: linkedCharge,
      fiscalConfigId: ids.config, clienteId: ids.client, ambiente, dados: { competencia: '2026-09-01' } }]));
  }
  await db.query("update app_private.webiss_rascunhos set updated_at='2026-09-01T00:00:00Z' where id=$1", [saved[0].id]);
  const draftCount = await scalar('select count(*)::int from app_private.webiss_rascunhos');
  await db.exec('SET ROLE authenticated');
  assert.equal((await scalar('select obter_rascunho_cobranca_webiss($1)', [linkedCharge])).id, saved[1].id);
  for (const draft of saved) {
    const resumed = await scalar('select obter_rascunho_cobranca_webiss($1,$2)', [linkedCharge, draft.ambiente]);
    assert.equal(resumed.id, draft.id);
    assert.equal(resumed.cobrancaId, linkedCharge);
    assert.equal(resumed.ambiente, draft.ambiente);
    assert.deepEqual(resumed.dados, draft.dados);
    assert.equal(resumed.rpsNumero, null);
  }
  await db.exec('RESET ROLE');
  assert.equal(await scalar('select count(*)::int from app_private.webiss_rascunhos'), draftCount);
  assert.equal(await scalar('select nfse_rps_numero from financeiro_cobrancas where id=$1', [linkedCharge]), null);
  await assert.rejects(scalar('select obter_rascunho_cobranca_webiss($1,$2)', [linkedCharge, 'invalid']), /Ambiente fiscal invalido/);
  await db.query("select set_config('test.empresa',$1,false)", [ids.other]);
  await assert.rejects(scalar('select obter_rascunho_cobranca_webiss($1)', [linkedCharge]), /fora da empresa/);
  await db.query("select set_config('test.empresa',$1,false)", [ids.tenant]);
  await db.exec('SET ROLE anon');
  await assert.rejects(scalar('select obter_rascunho_cobranca_webiss($1)', [linkedCharge]), /permission denied/);
  await db.exec('RESET ROLE');
  console.log('PASS resume linked draft by tenant, charge and environment without reserving RPS or creating duplicate');

  const charge = '00000000-0000-4000-8000-000000000090';
  const attempt = '00000000-0000-4000-8000-000000000091';
  await db.query(`insert into financeiro_cobrancas(id,empresa_id,cliente_empresa_id,valor,status)
    values($1,$2,$3,405,'Pendente')`, [charge, ids.tenant, ids.client]);
  const nextRps = await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal where id=$1", [ids.config]);
  await assert.rejects(scalar('select preparar_emissao_nfse_webiss($1,$2)', [ids.tenant, charge]), /Emissao direta.*desativada/);
  assert.equal(await scalar('select nfse_rps_numero from financeiro_cobrancas where id=$1', [charge]), null);
  assert.equal(await scalar('select count(*)::int from app_private.webiss_emissoes where cobranca_id=$1', [charge]), 0);
  assert.equal(await scalar("select configuracao->>'proximoNumeroRps' from configuracoes_integracao_fiscal where id=$1", [ids.config]), nextRps);
  await assert.rejects(scalar('select preparar_emissao_nfse_webiss($1,$2)', [ids.other, charge]), /fora da empresa/);

  const snapshot = { ambiente: 'homologacao', rps: { numero: '901', serie: 'A', tipo: '1' } };
  await db.query(`insert into app_private.webiss_emissoes(empresa_id,cobranca_id,ambiente,fiscal_config_id,snapshot,tentativa_id,status)
    values($1,$2,'homologacao',$3,$4,$5,'incerta')`, [ids.tenant, charge, ids.config, snapshot, attempt]);
  const original = await scalar('select to_jsonb(a) from app_private.webiss_emissoes a where cobranca_id=$1', [charge]);
  await assert.rejects(scalar('select preparar_emissao_nfse_webiss($1,$2)', [ids.tenant, charge]), /consulte o mesmo RPS/);
  const consultation = await scalar('select preparar_consulta_nfse_webiss($1,$2)', [ids.tenant, charge]);
  assert.deepEqual(consultation.rps, snapshot.rps);
  assert.equal(consultation.reconciliarPrimeiro, true);
  assert.equal(consultation.tentativaId, attempt);
  assert.deepEqual(await scalar('select to_jsonb(a) from app_private.webiss_emissoes a where cobranca_id=$1', [charge]), original);

  await db.exec('SET ROLE service_role');
  await assert.rejects(scalar('select preparar_emissao_nfse_webiss_cobranca($1,$2)', [ids.tenant, charge]), /permission denied/);
  await db.exec('RESET ROLE');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(scalar('select preparar_emissao_nfse_webiss($1,$2)', [ids.tenant, charge]), /permission denied/);
    await db.exec('RESET ROLE');
  }
  console.log('PASS legacy emission disabled before RPS reservation; original RPS consultation and tenant/role boundaries preserved');
}
