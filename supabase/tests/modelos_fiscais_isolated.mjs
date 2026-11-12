// Offline fixture only. Never connects to Supabase or any production database.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/tests/modelos_fiscais_isolated.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const config = '33333333-3333-4333-8333-333333333333', otherConfig = '44444444-4444-4444-8444-444444444444';
const id = '55555555-5555-4555-8555-555555555555';
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA app_private; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE FUNCTION public.current_empresa_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
 CREATE TABLE public.empresas(id uuid PRIMARY KEY);
 CREATE TABLE public.configuracoes_integracao_fiscal(id uuid PRIMARY KEY,empresa_id uuid,uf text,municipio text,provedor text);
 INSERT INTO public.empresas VALUES('${a}'),('${b}');
 INSERT INTO public.configuracoes_integracao_fiscal VALUES('${config}','${a}','SE','itabaiana','webiss'),('${otherConfig}','${b}','SE','itabaiana','webiss');
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 SELECT set_config('test.actor','${a}',false),set_config('test.tenant','${a}',false);`);
 await db.exec(await readFile(new URL('../migrations/20261112112928_faturamento_modelos_fiscais.sql', import.meta.url),'utf8'));
 await db.exec('SET ROLE authenticated');
 const save = (tenant, model, version, cfg, data={descricao:'Consultoria',valor:'200.00'}) => db.query(
  'SELECT public.salvar_modelo_fiscal($1,$2,$3,$4,$5,$6) result',[tenant,model,version,cfg,'Modelo',JSON.stringify(data)]);
 const list = tenant => db.query('SELECT public.listar_modelos_fiscais($1) result',[tenant]);
 const first = (await save(a,id,0,config)).rows[0].result;
 assert.equal(first.versao,1);
 assert.equal((await save(a,id,0,config)).rows[0].result.versao,1,'retry idempotent');
 assert.equal((await list(a)).rows[0].result.length,1);
 await assert.rejects(()=>save(a,id,1,otherConfig),/Emitente fora/);
 await assert.rejects(()=>save(b,id,1,config),/fora da sessao/);
 await assert.rejects(()=>save(a,id,1,config,{descricao:'x',competencia:'2026-01-01'}),/Campo nao permitido/);
 await assert.rejects(()=>save(a,id,1,config,{descricao:'x',valor:'-1'}),/decimal invalido/);
 await assert.rejects(()=>save(a,id,1,config,{descricao:'x',aliquotaIss:'101'}),/Aliquota invalida/);
 const edit = (await save(a,id,1,config,{descricao:'Editado'})).rows[0].result;
 assert.equal(edit.versao,2);
 await assert.rejects(()=>save(a,id,1,config),/alterado/);
 await db.query('SELECT public.ativar_modelo_fiscal($1,$2,$3,false)',[a,id,2]);
 assert.equal((await list(a)).rows[0].result[0].ativo,false);
 await assert.rejects(()=>save(a,id,3,config),/inativo/);
 await db.query('SELECT public.ativar_modelo_fiscal($1,$2,$3,true)',[a,id,3]);
 const cloneId='66666666-6666-4666-8666-666666666666';
 await save(a,cloneId,0,config,edit.dados);
 assert.equal((await list(a)).rows[0].result.length,2);
 await db.query("SELECT set_config('test.tenant',$1,false)",[b]);
 assert.deepEqual((await list(b)).rows[0].result,[]);
 await assert.rejects(()=>list(a),/fora da sessao/);
 await assert.rejects(()=>save(b,id,4,otherConfig),/Modelo indisponivel/);
 await assert.rejects(()=>db.query('SELECT public.ativar_modelo_fiscal($1,$2,4,false)',[b,id]),/indisponivel/);
 await assert.rejects(()=>db.query('SELECT * FROM app_private.faturamento_modelos_fiscais'),/permission denied/);
 await db.exec('RESET ROLE; SET ROLE anon');
 await assert.rejects(()=>list(b),/permission denied/);
 await db.exec('RESET ROLE');
 const rls=await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='app_private.faturamento_modelos_fiscais'::regclass");
 assert.equal(rls.rows[0].relrowsecurity,true);
 console.log('PASS: CRUD, optimistic version, retry, clone, archive/restore, validation, tenant and anonymous isolation; no network.');
} finally { await db.close(); }
