// Terminal-only regression. Install @electric-sql/pglite@0.5.11 in a temporary
// directory and set PGLITE_MODULE to its dist/index.js; no production access.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const dir = fileURLToPath(new URL('.', import.meta.url));
const migration = readFileSync(`${dir}../migrations/${readdirSync(`${dir}../migrations`).find(x => x.endsWith('_remover_modulo_reforma_tributaria.sql'))}`, 'utf8');
const shared = readFileSync(`${dir}fixtures/rtc-shared-functions.sql`, 'utf8');
const signatures = JSON.parse(readFileSync(`${dir}fixtures/rtc-exclusive-signatures.json`, 'utf8'));
const rtcTables = ['adequacoes', 'validacoes_xml', 'simulacoes', 'decisoes'];
assert(!/\bCASCADE\b/i.test(migration));
assert(migration.indexOf('DROP TRIGGER') < migration.indexOf('UPDATE public.configuracoes_perfis_acesso'));
const fixture = `
CREATE ROLE authenticated; CREATE ROLE anon;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.current_empresa_id() RETURNS uuid LANGUAGE sql AS $$SELECT auth.uid()$$;
CREATE FUNCTION public.current_user_access_allowed(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
CREATE FUNCTION public.current_user_has_permission(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
CREATE FUNCTION public.configuracoes_modulos_can_manage() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE TABLE public.configuracoes_modulos_sistema(empresa_id uuid,modulo text,habilitado boolean,atualizado_por uuid,updated_at timestamptz, UNIQUE(empresa_id,modulo),CONSTRAINT configuracoes_modulos_sistema_modulo_check CHECK(modulo IS NOT NULL));
CREATE TABLE public.configuracoes_modulos_auditoria(empresa_id uuid,modulo text,habilitado_anterior boolean,habilitado_novo boolean,alterado_por uuid);
CREATE TABLE public.configuracoes_perfis_acesso(id int,permissoes text[]);
CREATE TABLE public.preferencias_sidebar_menu(id int, menu_order text[]);
CREATE TABLE public.preferencias_usuario_modulos(id int, modulo text,chave text,valor jsonb);
CREATE TABLE public.clientes(id int); INSERT INTO public.clientes VALUES(42);
CREATE TABLE public.documentos(id int); INSERT INTO public.documentos VALUES(42);
CREATE TABLE public.simulacoes_rescisao(id int); INSERT INTO public.simulacoes_rescisao VALUES(42);
CREATE TABLE auth.users(id int); INSERT INTO auth.users VALUES(42);
${rtcTables.map(x => `CREATE TABLE public.reforma_tributaria_${x}(id int PRIMARY KEY);`).join('\n')}
ALTER TABLE public.reforma_tributaria_decisoes ADD COLUMN simulacao_id int REFERENCES public.reforma_tributaria_simulacoes(id);
INSERT INTO public.configuracoes_perfis_acesso VALUES(1,ARRAY['clientes:view','reforma-tributaria:view','simulacoes:view','reforma-tributaria:manage']),(2,ARRAY['reforma-tributaria:manage','financeiro:view']),(3,ARRAY['agenda:view']);
INSERT INTO public.preferencias_sidebar_menu VALUES(1,ARRAY['inicio','reforma-tributaria','simulacoes-calculos','conformidade']),(2,ARRAY['financeiro']);
INSERT INTO public.preferencias_usuario_modulos VALUES(1,'app-local-storage','arkhen_sidebar_menu_order',to_jsonb('["inicio","reforma-tributaria","simulacoes-calculos","financeiro"]'::text)),(2,'outro','outro','{"keep":true}');
${signatures.map(sig => sig.startsWith('aplicar_') ? `CREATE FUNCTION public.${sig} RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;` : `CREATE FUNCTION public.${sig} RETURNS boolean LANGUAGE plpgsql AS $$BEGIN RETURN true; END$$;`).join('\n')}
CREATE TRIGGER aplicar_permissoes_reforma_perfil_padrao BEFORE INSERT ON public.configuracoes_perfis_acesso FOR EACH ROW EXECUTE FUNCTION public.aplicar_permissoes_reforma_perfil_padrao();
${shared}
REVOKE ALL ON FUNCTION public.listar_configuracoes_modulos_sistema(),public.modulo_sistema_habilitado(text),public.salvar_configuracoes_modulos_sistema(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_configuracoes_modulos_sistema(),public.modulo_sistema_habilitado(text),public.salvar_configuracoes_modulos_sistema(jsonb) TO authenticated;
`;
const db = new PGlite();
await db.exec(fixture);
const snapshot = async () => (await db.query(`SELECT proname,prosrc,proacl::text,prosecdef,proconfig FROM pg_proc WHERE proname IN ('listar_configuracoes_modulos_sistema','modulo_sistema_habilitado','salvar_configuracoes_modulos_sistema') ORDER BY proname`)).rows;
const before = await snapshot();
await db.exec(migration);
const after = await snapshot();
for (let i=0;i<before.length;i++) {
  assert.equal(after[i].proacl,before[i].proacl);
  assert.equal(after[i].prosecdef,before[i].prosecdef);
  assert.deepEqual(after[i].proconfig,before[i].proconfig);
  let expected=before[i].prosrc.replace(/^.*\('reforma-tributaria'.*\n/m,'').replace(", 'reforma-tributaria'",'').replace('jsonb_array_length(p_modulos) > 9','jsonb_array_length(p_modulos) > 8');
  assert.equal(after[i].prosrc,expected);
}
assert.deepEqual((await db.query('SELECT permissoes FROM configuracoes_perfis_acesso ORDER BY id')).rows.map(x=>x.permissoes),[['clientes:view','simulacoes:view'],['financeiro:view'],['agenda:view']]);
assert.deepEqual((await db.query('SELECT menu_order FROM preferencias_sidebar_menu ORDER BY id')).rows.map(x=>x.menu_order),[['inicio','simulacoes-calculos','conformidade'],['financeiro']]);
const prefs=(await db.query('SELECT valor FROM preferencias_usuario_modulos ORDER BY id')).rows;
assert.equal(typeof prefs[0].valor,'string'); assert.deepEqual(JSON.parse(prefs[0].valor),['inicio','simulacoes-calculos','financeiro']);assert.deepEqual(prefs[1].valor,{keep:true});
assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE '%reforma%'" )).rows[0].n,0);
for(const t of rtcTables) assert.equal((await db.query(`SELECT to_regclass('public.reforma_tributaria_${t}') t`)).rows[0].t,null);
for(const t of ['clientes','documentos','simulacoes_rescisao','auth.users']) assert.equal((await db.query(`SELECT id FROM ${t}`)).rows[0].id,42);
assert((await db.query("SELECT to_regprocedure('public.set_updated_at()') f")).rows[0].f);
const catalog=(await db.query('SELECT listar_configuracoes_modulos_sistema() c')).rows[0].c;
assert.equal(catalog.modulos.length,11);assert(catalog.modulos.some(x=>x.id==='simulacoes-calculos'));
assert.equal((await db.query("SELECT modulo_sistema_habilitado('reforma-tributaria') b")).rows[0].b,false);
await assert.rejects(db.query("SELECT salvar_configuracoes_modulos_sistema('[{\"id\":\"reforma-tributaria\",\"habilitado\":true}]')"),/Modulo inválido/);
await db.close();
console.log('PASS final state: objects, ACL/auth source, catalog, permissions, both menu formats, unrelated data');
for(const [name,mutation,expected] of [
 ...rtcTables.map(t=>[t,`INSERT INTO reforma_tributaria_${t}(id) VALUES(1)`,'RTC data appeared']),
 ['module config',"INSERT INTO configuracoes_modulos_sistema(modulo) VALUES('reforma-tributaria')",'RTC data appeared'],
 ['audit',"INSERT INTO configuracoes_modulos_auditoria(modulo) VALUES('reforma-tributaria')",'RTC data appeared'],
 ['function drift',"CREATE OR REPLACE FUNCTION public.modulo_sistema_habilitado(p_modulo text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$SELECT true$$",'Shared function changed'],
 ['unexpected dependency','CREATE VIEW public.keep_rtc AS SELECT * FROM reforma_tributaria_adequacoes','depend'],
 ['unknown preferences',"INSERT INTO preferencias_usuario_modulos VALUES(3,'reforma-tributaria','state','{}')",'Unexpected RTC preferences']
]) {
 const db=new PGlite(); await db.exec(fixture); await db.exec(mutation);
 await assert.rejects(db.exec(migration),new RegExp(expected)); await db.exec('ROLLBACK');
 assert((await db.query("SELECT to_regclass('public.reforma_tributaria_adequacoes') t")).rows[0].t);
 assert((await db.query("SELECT permissoes FROM configuracoes_perfis_acesso WHERE id=1")).rows[0].permissoes.includes('reforma-tributaria:view'));
 await db.close();console.log(`PASS atomic abort: ${name}`);
}
const clean = new PGlite(); await clean.exec(fixture);
await clean.exec('DELETE FROM configuracoes_perfis_acesso; DELETE FROM preferencias_sidebar_menu; DELETE FROM preferencias_usuario_modulos');
await clean.exec(migration); await clean.close(); console.log('PASS clean replay: zero profiles and preferences');
