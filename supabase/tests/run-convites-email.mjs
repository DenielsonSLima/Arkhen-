// Usage: node supabase/tests/run-convites-email.mjs /tmp/.../pglite/dist/index.js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Provide the temporary PGlite package entry point.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const loadFunction = async (migration, name) => {
  const source = await read(migration);
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing original function ${name}`);
  const end = source.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`Missing function terminator ${name}`);
  await db.exec(source.slice(start, end + 4));
};
try {
  await db.exec(await read('fixtures/convites_email_schema.sql'));
  await loadFunction('../migrations/20260904033321_credenciais_usuarios_gerenciados.sql',
    'resolver_empresa_gestor_edge');
  for (const name of ['preparar_provisionamento_funcionario_email', 'provisionar_usuario_funcionario_email']) {
    await loadFunction('../migrations/20260904033331_convites_usuarios_email.sql', name);
  }
  await db.exec(await read('convites_email_auth_behaviour.sql'));
  // A mesma transacao de teste reproduz primeiro o defeito e depois testa a
  // migration real; nenhum usuario ou convite e criado fora do banco em memoria.
  await db.exec('SELECT test_reproduzir_auto_confirm_legado()');
  console.log('PASS legacy Auth INSERT then metadata UPDATE reproduces 42501');
  await db.exec(await read('../migrations/20260908121459_respeitar_confirmacao_email_auth.sql'));
  await db.exec('SELECT test_convites_email_apos_correcao()');
  console.log('PASS invite provisioning, pending access, denial cases and explicit confirmation');
} finally {
  await db.close();
}
