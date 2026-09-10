// Isolated SQL test: no WebISS requests or real waits. PGlite serializes concurrent client calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const reserve=(env='producao')=>scalar('select public.reservar_intervalo_consulta_webiss($1)',[env]);
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA app_private;');
  const migration=await readFile(new URL('../migrations/20260910041856_webiss_consulta_intervalos.sql',import.meta.url),'utf8');
  assert.match(migration,/FOR UPDATE/);
  assert.ok(!migration.includes('pg_sleep'));
  await db.exec(migration);
  assert.equal(await scalar("select relrowsecurity from pg_class where oid='app_private.webiss_consulta_intervalos'::regclass"),true);
  await assert.rejects(reserve(null),/Ambiente/);
  await assert.rejects(reserve('https://outside.invalid'),/Ambiente/);
  assert.deepEqual(await reserve(),{aguardarMs:0});
  assert.deepEqual(await reserve('homologacao'),{aguardarMs:0});
  const before=await scalar("select extract(epoch from liberar_em)::text from app_private.webiss_consulta_intervalos where ambiente='producao'");
  const concurrent=await Promise.all(Array.from({length:6},()=>reserve()));
  for(let i=0;i<concurrent.length;i++) {
    assert.ok(concurrent[i].aguardarMs>=(i+1)*3000-1000);
    assert.ok(concurrent[i].aguardarMs<=(i+1)*3000);
    if(i) assert.ok(concurrent[i].aguardarMs>concurrent[i-1].aguardarMs);
  }
  const after=await scalar("select extract(epoch from liberar_em)::text from app_private.webiss_consulta_intervalos where ambiente='producao'");
  assert.equal(Number(after)-Number(before),18);
  console.log('PASS independent environment slots and concurrent requests reserve exactly 3 seconds each');
  await db.exec("UPDATE app_private.webiss_consulta_intervalos SET liberar_em=clock_timestamp()+interval '61 seconds' WHERE ambiente='producao'");
  const cappedBefore=await scalar("select liberar_em::text from app_private.webiss_consulta_intervalos where ambiente='producao'");
  await assert.rejects(reserve(),/Fila de consultas/);
  assert.equal(await scalar("select liberar_em::text from app_private.webiss_consulta_intervalos where ambiente='producao'"),cappedBefore);
  await db.exec("UPDATE app_private.webiss_consulta_intervalos SET liberar_em=clock_timestamp()+interval '59 seconds' WHERE ambiente='producao'");
  const accepted=await reserve();
  assert.ok(accepted.aguardarMs>58000 && accepted.aguardarMs<=59000);
  console.log('PASS 60-second cap rejects without advancing the queue and bounded wait is returned');
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'app_private.webiss_consulta_intervalos','SELECT']),false);
    assert.equal(await scalar('select has_function_privilege($1,$2,$3)',[role,'public.reservar_intervalo_consulta_webiss(text)','EXECUTE']),role==='service_role');
    await db.exec('SET ROLE '+role);
    await assert.rejects(scalar('select * from app_private.webiss_consulta_intervalos'),/permission denied/);
    if(role==='service_role') assert.ok((await reserve('homologacao')).aguardarMs>=0);
    else await assert.rejects(reserve(),/permission denied/);
    await db.exec('RESET ROLE');
  }
  console.log('PASS private RLS table inaccessible and reservation RPC restricted to service_role');
} catch(error) {console.error(error.message,error.where||'');process.exitCode=1;} finally {await db.close();}
