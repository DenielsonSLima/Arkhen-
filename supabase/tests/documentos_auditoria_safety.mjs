// Run with ARKHEN_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node this-file.
// Isolated PostgreSQL, no remote data or requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.ARKHEN_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const actor='11111111-1111-4111-8111-111111111111', tenant='22222222-2222-4222-8222-222222222222';
const doc='33333333-3333-4333-8333-333333333333', doc2='44444444-4444-4444-8444-444444444444';
const op='55555555-5555-4555-8555-555555555555';
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE storage.objects(bucket_id text,name text,owner uuid,UNIQUE(bucket_id,name));
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE TABLE public.empresas(id uuid PRIMARY KEY);
 CREATE TABLE public.documentos(id uuid PRIMARY KEY,empresa_id uuid REFERENCES empresas,owner_user_id uuid,scope text,cliente_id text,storage_bucket text,storage_path text,nome text);
 CREATE TABLE public.documentos_solicitacoes(documento_id uuid REFERENCES documentos(id) ON DELETE RESTRICT);
 CREATE TABLE public.configuracoes_eventos_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid,usuario_id uuid,acao text,modulo text,tipo text,ip_address text,detalhes jsonb,created_at timestamptz DEFAULT now());
 CREATE FUNCTION public.current_empresa_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
 CREATE FUNCTION public.is_empresa_member(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $1=public.current_empresa_id() AND auth.uid() IS NOT NULL$$;
 CREATE FUNCTION public.current_user_is_client_scoped(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE FUNCTION public.documento_cliente_belongs_to_empresa(text,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $2=public.current_empresa_id() AND current_setting('test.client',true)='yes'$$;
 CREATE FUNCTION public.current_user_has_permission(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.manage',true)='yes'$$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
 ALTER TABLE public.configuracoes_eventos_logs ENABLE ROW LEVEL SECURITY;
 CREATE POLICY tenant ON public.configuracoes_eventos_logs FOR ALL TO authenticated USING (empresa_id=public.current_empresa_id()) WITH CHECK (empresa_id=public.current_empresa_id());
 SELECT set_config('test.actor','${actor}',false),set_config('test.tenant','${tenant}',false),set_config('test.manage','yes',false),set_config('test.client','yes',false);
 INSERT INTO empresas VALUES ('${tenant}');
 INSERT INTO documentos VALUES ('${doc}','${tenant}','${actor}','empresa','cliente','documentos','${tenant}/clientes/cliente/file','evidencia'),('${doc2}','${tenant}','${actor}','empresa','cliente','documentos','${tenant}/clientes/cliente/file2','outro');
 INSERT INTO storage.objects VALUES ('documentos','${tenant}/clientes/cliente/file','${actor}');
 INSERT INTO documentos_solicitacoes VALUES ('${doc}');
`);
for (const name of ['20260922001515_documentos_exclusao_reconciliavel.sql','20260922001525_auditoria_logs_imutaveis.sql']) {
 await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
}
await db.exec('SET ROLE authenticated');
await assert.rejects(db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]),/foreign key/i);
await db.exec('RESET ROLE');
assert.equal((await db.query('select count(*)::int n from documentos')).rows[0].n,2);
assert.equal((await db.query('select count(*)::int n from app_private.documentos_exclusoes')).rows[0].n,0);
await db.exec('delete from documentos_solicitacoes');
await db.exec("SET ROLE authenticated; SELECT set_config('test.manage','no',false)");
// An employee cannot delete another employee's corporate document without permission.
await db.exec(`SELECT set_config('test.actor','66666666-6666-4666-8666-666666666666',false)`);
await assert.rejects(db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]),/autorizada/i);
await db.exec(`SELECT set_config('test.actor','${actor}',false),set_config('test.manage','yes',false)`);
// Operational client access is mandatory even for a document manager.
await db.exec("SELECT set_config('test.client','no',false)");
await assert.rejects(db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]),/autorizada/i);
await db.exec("SELECT set_config('test.client','yes',false)");
// A metadata path cannot direct the service-role cleanup into another tenant.
await db.exec(`RESET ROLE; UPDATE documentos SET storage_path='other-tenant/clientes/cliente/file' WHERE id='${doc}'; SET ROLE authenticated`);
await assert.rejects(db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]),/identificação segura/i);
await db.exec(`RESET ROLE; UPDATE documentos SET storage_path='${tenant}/clientes/cliente/file' WHERE id='${doc}';
 UPDATE storage.objects SET owner='66666666-6666-4666-8666-666666666666'; SET ROLE authenticated`);
await assert.rejects(db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]),/propriedade/i);
await db.exec(`RESET ROLE; UPDATE storage.objects SET owner='${actor}'; SET ROLE authenticated`);
await db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc,doc2]]);
await db.query('select public.preparar_exclusao_documentos($1,$2::uuid[])',[op,[doc2,doc]]);
await assert.rejects(db.query('select * from app_private.documentos_exclusoes_arquivos'),/permission denied/i);
await assert.rejects(db.query('select public.listar_arquivos_exclusao_pendentes($1)',[actor]),/permission denied/i);
await db.exec('RESET ROLE');
assert.equal((await db.query('select count(*)::int n from documentos')).rows[0].n,0);
assert.equal((await db.query('select count(*)::int n from app_private.documentos_exclusoes_arquivos')).rows[0].n,2);
await assert.rejects(db.exec(`INSERT INTO documentos VALUES ('${doc}','${tenant}','${actor}','empresa','cliente','documentos','${tenant}/clientes/cliente/file','novo')`),/processamento/i);
await db.exec('SET ROLE service_role');
assert.equal((await db.query('select * from public.listar_arquivos_exclusao_pendentes($1)',[actor])).rows.length,2);
assert.equal((await db.query('select * from public.listar_arquivos_exclusao_pendentes($1)',['77777777-7777-4777-8777-777777777777'])).rows.length,0);
await db.query('select public.confirmar_limpeza_documento($1,$2,$3)',[actor,op,doc]);
assert.equal((await db.query('select * from public.listar_arquivos_exclusao_pendentes($1)',[actor])).rows.length,1);
await db.exec(`RESET ROLE;
 CREATE FUNCTION public.test_servidor_gravar_log() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.configuracoes_eventos_logs(empresa_id,usuario_id,acao,modulo,tipo) VALUES (public.current_empresa_id(),auth.uid(),'acao servidor','Documentos','Sucesso');$$;
 GRANT EXECUTE ON FUNCTION public.test_servidor_gravar_log() TO authenticated;
 SET ROLE authenticated;
 SELECT public.test_servidor_gravar_log();
`);
for (const sql of ["insert into configuracoes_eventos_logs(acao) values('forjado')", "update configuracoes_eventos_logs set acao='forjado'",'delete from configuracoes_eventos_logs','truncate configuracoes_eventos_logs']) await assert.rejects(db.exec(sql),/permission denied/i);
await db.exec('RESET ROLE');
await assert.rejects(db.exec('delete from configuracoes_eventos_logs'),/histórico/i);
await db.exec(`INSERT INTO configuracoes_eventos_logs(empresa_id,acao,modulo,tipo,created_at) SELECT '${tenant}',CASE WHEN n=205 THEN 'evento antigo procurado' ELSE 'evento recente' END,'Fiscal','Sucesso',now()-n*interval '1 minute' FROM generate_series(1,205) n; SET ROLE authenticated;`);
let page=(await db.query("select public.consultar_eventos_logs('','','',null,null) value")).rows[0].value;
assert.equal(page.total,206); assert.equal(page.rows.length,100);
const last=page.rows.at(-1);
const next=(await db.query('select public.consultar_eventos_logs($1,$2,$3,$4,$5) value',['','','',last.created_at,last.id])).rows[0].value;
assert.equal(next.rows.length,100); assert.ok(!next.rows.some(r=>page.rows.some(x=>x.id===r.id)));
const search=(await db.query("select public.consultar_eventos_logs('procurado','','',null,null) value")).rows[0].value;
assert.equal(search.total,1);
await db.close();
console.log('PASS: atomic FK rollback, private queue, actor scope, idempotent retry, server-only audit append, immutable history and cursor pagination.');
