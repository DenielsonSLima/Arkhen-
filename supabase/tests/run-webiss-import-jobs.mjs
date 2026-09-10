// Isolated PostgreSQL tests; networking/random-byte APIs below are local stubs only.
// node supabase/tests/run-webiss-import-jobs.mjs /tmp/.../@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
const ids={user:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',
  staff:'00000000-0000-4000-8000-000000000003',config:'00000000-0000-4000-8000-000000000011',client:'00000000-0000-4000-8000-000000000021'};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const enqueue=(overrides={})=>scalar('select enfileirar_importacao_webiss($1,$2,$3,$4,$5,$6)',
  [overrides.user||ids.user,overrides.config||ids.config,overrides.client||ids.client,overrides.ambiente||'producao',overrides.inicio||'2026-09-01',overrides.fim||'2026-09-10']);
const tokenFor=(id)=>scalar("select headers->>'x-webiss-job-token' from net.http_request_queue where body->>'jobId'=$1",[id]);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA app_private; CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA net;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE empresas(id uuid PRIMARY KEY);
    CREATE TABLE perfis(user_id uuid,empresa_id uuid,ativo boolean,papel text);
    CREATE TABLE configuracoes_integracao_fiscal(id uuid PRIMARY KEY,empresa_id uuid,uf text,municipio text,provedor text,ativo boolean);
    CREATE TABLE clientes(id uuid PRIMARY KEY,empresa_id uuid);
    CREATE FUNCTION public.resolve_empresa_id_for_user(p uuid) RETURNS uuid LANGUAGE sql AS $$
      SELECT empresa_id FROM public.perfis WHERE user_id=p AND ativo=true LIMIT 1 $$;
    CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$
      SELECT substring(uuid_send(gen_random_uuid())||uuid_send(gen_random_uuid()) FROM 1 FOR n) $$;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS $$SELECT sha256(convert_to($1,'UTF8'))$$;
    CREATE TABLE net.http_request_queue(id bigserial PRIMARY KEY,url text,body jsonb,headers jsonb,timeout_ms int);
    CREATE TABLE net._http_response(id bigint,status_code integer,content text);
    CREATE FUNCTION net.http_get(url text,params jsonb,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE sql AS $$SELECT 0::bigint$$;
    CREATE FUNCTION net.http_delete(url text,params jsonb,headers jsonb,timeout_milliseconds integer,body jsonb) RETURNS bigint LANGUAGE sql AS $$SELECT 0::bigint$$;
    CREATE FUNCTION net.http_post(url text,body jsonb DEFAULT '{}'::jsonb,params jsonb DEFAULT '{}'::jsonb,headers jsonb DEFAULT '{}'::jsonb,timeout_milliseconds integer DEFAULT 2000) RETURNS bigint LANGUAGE plpgsql AS $$
      DECLARE id bigint;
      BEGIN INSERT INTO net.http_request_queue(url,body,headers,timeout_ms) VALUES(url,body,headers,timeout_milliseconds) RETURNING net.http_request_queue.id INTO id;
      RETURN id; END $$;
  `);
  const migration=await readFile(new URL('../migrations/20260910034923_webiss_import_jobs.sql',import.meta.url),'utf8');
  // pg_net is deliberately unavailable in the isolated engine; net.http_post above never performs networking.
  const extensionDeclaration='CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;';
  assert.ok(migration.includes(extensionDeclaration));
  await db.exec(migration.replace(extensionDeclaration,''));
  // Reproduce the unsafe extension grants found by the deployment audit, then apply the repair.
  await db.exec(`GRANT USAGE ON SCHEMA net TO PUBLIC,anon,authenticated;
    GRANT ALL ON TABLE net.http_request_queue,net._http_response TO PUBLIC,anon,authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO PUBLIC,anon,authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO PUBLIC,anon,authenticated;`);
  assert.equal(await scalar("select has_table_privilege('anon','net.http_request_queue','SELECT')"),true);
  assert.equal(await scalar("select has_function_privilege('authenticated','net.http_post(text,jsonb,jsonb,jsonb,integer)','EXECUTE')"),true);
  await db.exec(await readFile(new URL('../migrations/20260910040202_restringir_pg_net_importacao_webiss.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']) {
    assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'net.http_request_queue','SELECT']),false);
    assert.equal(await scalar('select has_column_privilege($1,$2,$3,$4)',[role,'net.http_request_queue','id','SELECT']),true);
    for(const column of ['body','headers','url']) {
      assert.equal(await scalar('select has_column_privilege($1,$2,$3,$4)',[role,'net.http_request_queue',column,'SELECT']),false);
    }
    assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'net.http_request_queue','INSERT']),true);
    assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'net._http_response','SELECT']),true);
    assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'net._http_response','INSERT']),true);
    assert.equal(await scalar('select has_sequence_privilege($1,$2,$3)',[role,'net.http_request_queue_id_seq','USAGE']),true);
    for(const signature of ['net.http_post(text,jsonb,jsonb,jsonb,integer)','net.http_get(text,jsonb,jsonb,integer)','net.http_delete(text,jsonb,jsonb,integer,jsonb)']) {
      assert.equal(await scalar('select has_function_privilege($1,$2,$3)',[role,signature,'EXECUTE']),true);
    }
    assert.equal(await scalar('select has_schema_privilege($1,$2,$3)',[role,'net','USAGE']),true);
    await db.exec('SET ROLE '+role);
    await assert.rejects(scalar('select * from net.http_request_queue'),/permission denied/);
    await assert.rejects(scalar('select headers from net.http_request_queue'),/permission denied/);
    await assert.rejects(scalar('select body from net.http_request_queue'),/permission denied/);
    assert.equal(await scalar('select count(*)::int from net._http_response'),0);
    assert.equal(await scalar("select net.http_get('https://example.invalid','{}','{}',1000)"),0);
    const directId=await scalar("select net.http_post('https://example.invalid')");
    assert.ok(Number(directId)>0);
    assert.equal(await scalar('select id from net.http_request_queue where id=$1',[directId]),directId);
    await db.exec('RESET ROLE');
  }
  await db.exec('TRUNCATE net.http_request_queue');
  console.log('PASS only queue id readable; headers/body protected and direct HTTP calls preserved');

  await db.query('insert into empresas values($1),($2)',[ids.user,ids.other]);
  await db.query('insert into auth.users values($1),($2),($3)',[ids.user,ids.other,ids.staff]);
  await db.query("insert into perfis values($1,$1,true,'admin'),($2,$2,true,'admin'),($3,$1,true,'contador')",[ids.user,ids.other,ids.staff]);
  await db.query("insert into configuracoes_integracao_fiscal values($1,$2,'SE','Itabaiana','WebISS',false)",[ids.config,ids.user]);
  await db.query('insert into clientes values($1,$2)',[ids.client,ids.user]);
  await assert.rejects(enqueue({user:ids.other}),/Contexto fiscal nao pertence/);
  await assert.rejects(enqueue({user:ids.staff}),/administrador ativo/);
  await assert.rejects(enqueue({client:ids.other}),/Parceiro nao pertence/);
  await assert.rejects(enqueue({inicio:'2025-01-01'}),/periodo/);
  assert.equal(await scalar('select count(*)::int from net.http_request_queue'),0);
  console.log('PASS enqueue validates administrator, tenant, partner and bounded period before networking');
  const first=await enqueue();
  assert.deepEqual(Object.keys(first).sort(),['jobId','requestId']);
  const request=(await db.query('select * from net.http_request_queue where id=$1',[first.requestId])).rows[0];
  assert.equal(request.url,'https://dgklhykjwzmeqxejlicz.supabase.co/functions/v1/webiss-import-worker');
  assert.deepEqual(request.body,{jobId:first.jobId});assert.equal(request.timeout_ms,60000);
  const token=await tokenFor(first.jobId);
  assert.match(token,/^[0-9a-f]{64}$/);
  const row=(await db.query('select * from app_private.webiss_import_jobs where id=$1',[first.jobId])).rows[0];
  assert.notEqual(row.token_hash,token);
  assert.equal(new Date(row.expires_at)-new Date(row.created_at),600000);
  assert.equal(row.ambiente,'producao');
  await assert.rejects(enqueue(),/andamento/);
  console.log('PASS one-shot fixed destination, secret hash/TTL and no emission activation');
  assert.equal(await scalar('select claim_webiss_import_job($1,$2)',[first.jobId,'0'.repeat(64)]),null);
  assert.equal(await scalar('select claim_webiss_import_job($1,$2)',[ids.other,token]),null);
  const claimed=await scalar('select claim_webiss_import_job($1,$2)',[first.jobId,token]);
  assert.deepEqual(Object.keys(claimed).sort(),['ambiente','clienteId','dataFinal','dataInicial','empresaId','fiscalConfigId','jobId','userId'].sort());
  assert.equal(claimed.userId,ids.user);assert.equal(claimed.ambiente,'producao');
  assert.equal(await scalar('select token_hash from app_private.webiss_import_jobs where id=$1',[first.jobId]),null);
  assert.equal(await scalar('select claim_webiss_import_job($1,$2)',[first.jobId,token]),null);
  console.log('PASS atomic claim binds job/context, consumes capability and rejects replay');
  await scalar('select finish_webiss_import_job($1,$2)',[first.jobId,{notesCount:2,pagesRead:1,coverage:'complete',xml:'must not persist',token:'must not persist'}]);
  const summary=await scalar('select resultado from app_private.webiss_import_jobs where id=$1',[first.jobId]);
  assert.equal(summary.notesCount,2);assert.ok(!('xml' in summary));assert.ok(!('token' in summary));
  assert.deepEqual(summary.periodo,{inicio:'2026-09-01',fim:'2026-09-10'});
  await assert.rejects(scalar('select finish_webiss_import_job($1,$2)',[first.jobId,{notesCount:3,pagesRead:1,coverage:'complete'}]),/nao esta/);
  const expired=await enqueue();
  await db.query("update app_private.webiss_import_jobs set expires_at=now()-interval '1 second' where id=$1",[expired.jobId]);
  assert.equal(await scalar('select claim_webiss_import_job($1,$2)',[expired.jobId,await tokenFor(expired.jobId)]),null);
  const revoked=await enqueue();
  await db.query('update perfis set ativo=false where user_id=$1',[ids.user]);
  await assert.rejects(scalar('select claim_webiss_import_job($1,$2)',[revoked.jobId,await tokenFor(revoked.jobId)]),/administrador ativo/);
  assert.equal(await scalar('select status from app_private.webiss_import_jobs where id=$1',[revoked.jobId]),'pending');
  await db.query('update perfis set ativo=true where user_id=$1',[ids.user]);
  await scalar('select claim_webiss_import_job($1,$2)',[revoked.jobId,await tokenFor(revoked.jobId)]);
  await scalar('select finish_webiss_import_job($1,$2,$3)',[revoked.jobId,null,'Falha de consulta.']);
  assert.equal(await scalar('select status from app_private.webiss_import_jobs where id=$1',[revoked.jobId]),'failed');
  console.log('PASS finish whitelist, one-way terminal state, expiry and actor revocation');
  for(const role of ['anon','authenticated']) {
    await db.exec('SET ROLE '+role);
    await assert.rejects(enqueue(),/permission denied/);
    await assert.rejects(scalar('select claim_webiss_import_job($1,$2)',[first.jobId,token]),/permission denied/);
    await assert.rejects(scalar('select finish_webiss_import_job($1,$2)',[first.jobId,{}]),/permission denied/);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  await assert.rejects(scalar('select count(*)::int from app_private.webiss_import_jobs'),/permission denied/);
  const allowed=await enqueue({inicio:'2026-09-02'});assert.ok(allowed.jobId);
  await db.exec('RESET ROLE');
  console.log('PASS application roles denied, service RPC allowed, private table inaccessible');
} catch(error) {console.error(error.message,error.where||'');process.exitCode=1;} finally {await db.close();}
