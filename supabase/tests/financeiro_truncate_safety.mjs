// PostgreSQL isolado: nenhuma conexão ou alteração em produção.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.ARKHEN_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE public.financeiro_lancamentos(id integer);
  CREATE TABLE public.configuracoes_contas_bancarias(id integer);
  INSERT INTO public.financeiro_lancamentos VALUES (1);
  INSERT INTO public.configuracoes_contas_bancarias VALUES (1);
  GRANT ALL ON public.financeiro_lancamentos, public.configuracoes_contas_bancarias TO PUBLIC, anon, authenticated, service_role;
  ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.configuracoes_contas_bancarias ENABLE ROW LEVEL SECURITY;
`);
const migrations = new URL('../migrations/', import.meta.url);
const name = (await readdir(migrations)).find((file) => file.endsWith('_financeiro_revogar_truncate_cliente.sql'));
assert.ok(name, 'Migration de proteção TRUNCATE deve existir');
await db.exec(await readFile(new URL(name, migrations), 'utf8'));
for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  for (const table of ['financeiro_lancamentos', 'configuracoes_contas_bancarias']) {
    await assert.rejects(db.exec(`TRUNCATE public.${table}`), /permission denied/i);
  }
  await db.exec('RESET ROLE');
}
for (const table of ['financeiro_lancamentos', 'configuracoes_contas_bancarias']) {
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM public.${table}`)).rows[0].count, 1);
  assert.equal((await db.query("SELECT has_table_privilege('service_role',$1,'TRUNCATE') allowed", [`public.${table}`])).rows[0].allowed, true);
}
await db.close();
console.log('PASS: TRUNCATE negado a anon/authenticated nas duas tabelas; linhas e privilégios de servidor preservados.');
