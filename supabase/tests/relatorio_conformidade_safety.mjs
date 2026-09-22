import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.ARKHEN_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
CREATE FUNCTION public.current_empresa_id() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-4111-8111-111111111111'::uuid$$;
CREATE FUNCTION public.current_user_access_allowed(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.allowed',true)='yes'$$;
CREATE FUNCTION public.current_user_has_permission(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT $2=current_setting('test.permission',true)$$;
CREATE FUNCTION public.current_user_has_client_access(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION public.current_user_can_access_client_row(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $2='22222222-2222-4222-8222-222222222222'::uuid$$;
CREATE TABLE atividades_modelos(id uuid,empresa_id uuid,nome text);
CREATE TABLE atividades_tarefas(id uuid DEFAULT gen_random_uuid(),empresa_id uuid DEFAULT public.current_empresa_id(),cliente_id uuid DEFAULT '22222222-2222-4222-8222-222222222222',modelo_id uuid DEFAULT '33333333-3333-4333-8333-333333333333',titulo text DEFAULT 'Obrigação',competencia text,status text,ativo bool DEFAULT true,prazo_legal date,prazo_interno date,concluido_em timestamptz,data_hora_conclusao timestamptz,responsavel_user_id uuid,revisor_user_id uuid);
CREATE TABLE atividades_instancias(empresa_id uuid DEFAULT public.current_empresa_id(),cliente_id uuid DEFAULT '22222222-2222-4222-8222-222222222222',modelo_id uuid DEFAULT '33333333-3333-4333-3333-333333333333',modelo_codigo text,competencia text,status text,ativo bool DEFAULT true);
SELECT set_config('test.actor','44444444-4444-4444-8444-444444444444',false),set_config('test.allowed','yes',false),set_config('test.permission','atividades:manage',false);
INSERT INTO atividades_tarefas(competencia,status,prazo_legal,prazo_interno,concluido_em) VALUES
 ('01/2025','Concluída','2025-01-20','2025-01-15','2025-01-21 01:00:00+00'),
 ('02/2025','Concluída',NULL,'2025-02-15','2025-02-16 03:01:00+00'),
 ('03/2025','Concluída',NULL,'2025-03-15','2025-03-15 10:00:00+00'),
 ('04/2025','Pendente','2025-04-20',NULL,NULL),
 ('05/2025','Aguardando revisão','2025-05-20',NULL,NULL),
 ('06/2025','Cancelada','2025-06-20',NULL,NULL);
INSERT INTO atividades_instancias(competencia,status,modelo_id) VALUES
 ('01/2025','Concluída','33333333-3333-4333-8333-333333333333'),
 ('12/2024','Concluída','33333333-3333-4333-8333-333333333333');
INSERT INTO atividades_tarefas(empresa_id,status) VALUES ('55555555-5555-4555-8555-555555555555','Concluída');
INSERT INTO atividades_tarefas(cliente_id,status) VALUES ('66666666-6666-4666-8666-666666666666','Concluída');
`);
await db.exec(await readFile(new URL('../migrations/20260922002336_relatorio_conformidade_prazos_reais.sql',import.meta.url),'utf8'));
await db.exec('SET ROLE authenticated');
const report=async()=> (await db.query('select public.get_relatorio_conformidade_json() data')).rows[0].data;
let r=await report();
assert.equal(r.totalObrigacoes,6); assert.equal(r.concluidas,4); assert.equal(r.atrasadas,2);
assert.equal(r.entregasNoPrazo,2); assert.equal(r.taxaConformidade,50);
assert.equal(r.entregasSemEvidenciaPrazo,1);
assert.equal(r.distribuicaoObrigacoes[0].percentualConcluido,66.67);
await assert.rejects(db.query('select public.get_relatorio_conformidade_json($1)',['66666666-6666-4666-8666-666666666666']),/não autorizado/);
await db.exec("SELECT set_config('test.permission','atividades:view',false)");
assert.equal((await report()).totalObrigacoes,0);
await db.exec(`RESET ROLE;
  UPDATE atividades_tarefas SET responsavel_user_id=auth.uid() WHERE competencia='01/2025';
  SET ROLE authenticated;
  SELECT set_config('test.permission','atividades:update-own',false)`);
assert.equal((await report()).totalObrigacoes,1);
assert.equal((await report()).taxaConformidade,100);
await db.exec("SELECT set_config('test.allowed','no',false)");
await assert.rejects(report(),/Sessão inválida/);
await db.exec("SELECT set_config('test.actor','',false)");
await assert.rejects(report(),/Sessão inválida/);
await db.exec('RESET ROLE; SET ROLE anon');
await assert.rejects(report(),/permission denied/);
await db.close();
console.log('Conformidade: prazo legal/interno, fuso, atraso, histórico, duplicidade, revisão, cancelamento, tenant e permissões OK');
