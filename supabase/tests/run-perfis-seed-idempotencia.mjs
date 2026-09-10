// Usage: node supabase/tests/run-perfis-seed-idempotencia.mjs /tmp/.../pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Provide the temporary PGlite package entry point.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const tenant = '00000000-0000-4000-8000-000000000001';
const otherTenant = '00000000-0000-4000-8000-000000000002';
const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');
const loadFunction = async (file, name) => {
  const source = await read(file);
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const delimiter = source.slice(start).match(/AS (\$\w*\$)/)?.[1];
  assert.ok(delimiter);
  const end = source.indexOf(`\n${delimiter};`, start);
  assert.ok(start >= 0 && end >= 0);
  await db.exec(source.slice(start, end + delimiter.length + 2));
};
const events = async () => Number((await db.query('select count(*) as n from test_events')).rows[0].n);
const seed = () => db.query('select public.seed_perfis_acesso_empresa($1)', [tenant]);
try {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE FUNCTION public.is_empresa_member(p uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT p = nullif(current_setting('test.tenant', true), '')::uuid
    $$;
    CREATE TABLE public.configuracoes_perfis_acesso (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, empresa_id uuid NOT NULL,
      codigo varchar, nome varchar, descricao text, permissoes text[],
      sistema boolean NOT NULL, ativo boolean NOT NULL, ordem integer,
      created_at timestamptz, updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.configuracoes_perfis_acesso ENABLE ROW LEVEL SECURITY;
    CREATE UNIQUE INDEX ON public.configuracoes_perfis_acesso(empresa_id, codigo)
      WHERE codigo IS NOT NULL;
    CREATE TABLE test_events (op text);
    CREATE FUNCTION test_capture() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO test_events VALUES (TG_OP); RETURN NEW; END;
    $$;
    CREATE TRIGGER test_capture AFTER INSERT OR UPDATE ON public.configuracoes_perfis_acesso
      FOR EACH ROW EXECUTE FUNCTION test_capture();
  `);
  await db.query("select set_config('test.tenant', $1, false)", [tenant]);
  await loadFunction('../migrations/20260713150000_seed_demo_operacional.sql', 'perfis_acesso_padrao');
  await db.exec(await read('../migrations/20260715102500_reforma_tributaria_rbac_defaults.sql'));
  await seed();
  const defaultCount = await events();
  assert.ok(defaultCount > 0);
  await db.exec('truncate test_events');
  await seed();
  assert.equal(await events(), defaultCount);
  console.log('PASS reproduz atualizacoes sem mudanca no seed anterior');

  await db.exec(await read('../migrations/20260909143648_evitar_loop_realtime_perfis.sql'));
  await db.exec('truncate test_events');
  const snapshot = (await db.query('select * from configuracoes_perfis_acesso order by id')).rows;
  for (let n = 0; n < 5; n++) await seed();
  assert.equal(await events(), 0);
  assert.deepEqual((await db.query('select * from configuracoes_perfis_acesso order by id')).rows, snapshot);
  console.log('PASS cinco consultas nao geram eventos nem alteram registros');

  await db.exec(`update configuracoes_perfis_acesso set descricao = null,
    permissoes = ARRAY['personalizada:view'], ativo = false where codigo = 'administrador';
    truncate test_events;`);
  await seed();
  assert.equal(await events(), 1);
  const changed = (await db.query("select * from configuracoes_perfis_acesso where codigo='administrador'")).rows[0];
  assert.ok(changed.descricao);
  assert.equal(changed.ativo, false);
  assert.deepEqual(changed.permissoes, ['personalizada:view']);
  await db.exec('truncate test_events');
  await seed();
  assert.equal(await events(), 0);
  console.log('PASS corrige metadados uma vez e preserva permissoes e inativacao');

  await db.exec("delete from configuracoes_perfis_acesso where codigo='cliente'");
  await seed();
  assert.equal(await events(), 1);
  console.log('PASS recria perfil ausente');

  await assert.rejects(db.query('select seed_perfis_acesso_empresa($1)', [otherTenant]), /Acesso nao autorizado/);
  await db.exec('SET ROLE anon');
  await assert.rejects(seed(), /permission denied/);
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await seed();
  await assert.rejects(db.query('select seed_perfis_acesso_empresa($1)', [otherTenant]), /Acesso nao autorizado/);
  console.log('PASS preserva restricoes de empresa e acesso anonimo');
} finally {
  await db.close();
}
