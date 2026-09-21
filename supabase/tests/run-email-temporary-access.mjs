// Isolated database only. Usage: node this-file /tmp/.../pglite/dist/index.js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const loadFunction = async (migration, name) => {
  const source = await read(migration);
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert(start >= 0);
  const end = source.indexOf('\n$$;', start);
  assert(end > start);
  await db.exec(source.slice(start, end + 4));
};
const authId = '40000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000001';
const version = '50000000-0000-4000-8000-000000000001';
const claims = { sub: authId, role: 'authenticated', app_metadata: { credential_version: version } };
try {
  await db.exec(await read('fixtures/convites_email_schema.sql'));
  await db.exec(`
    DROP TRIGGER on_auth_user_created_auto_confirm ON auth.users;
    CREATE SCHEMA private;
    CREATE TABLE private.identidades_funcionarios_cpf (
      configuracao_usuario_id uuid, auth_user_id uuid, empresa_id uuid,
      cpf_normalizado text, auth_alias text
    );
    ALTER TABLE public.configuracoes_perfis_acesso ADD COLUMN codigo text;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$
      SELECT current_setting('request.jwt.claims',true)::jsonb
    $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT (auth.jwt()->>'sub')::uuid
    $$;
    CREATE FUNCTION public._obter_contexto_usuario_ativo_interno()
    RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"existing_path":true}'::jsonb $$;
  `);
  await loadFunction('../migrations/20260904033341_primeiro_acesso_usuarios_gerenciados.sql',
    'preparar_primeiro_acesso_usuario_gerenciado');
  await loadFunction('../migrations/20260904033321_credenciais_usuarios_gerenciados.sql',
    'current_user_access_allowed');
  await db.exec(await read('../migrations/20260921163326_primeiro_acesso_email_senha_temporaria.sql'));
  await db.query(`INSERT INTO auth.users (id,email,email_confirmed_at,invited_at,raw_app_meta_data)
    VALUES ($1,'temporary@example.com',now(),now(),$2)`, [authId, JSON.stringify({
    account_type: 'employee_email', login_method: 'email', credential_version: version,
  })]);
  await db.query(`INSERT INTO public.perfis (id,user_id,empresa_id,papel,ativo)
    VALUES ($1,$1,$2,'membro',false)`, [authId, companyId]);
  await db.query(`INSERT INTO public.configuracoes_usuarios
    (id,auth_user_id,empresa_id,perfil_id,perfil_acesso_id,nome,email,cpf,login_method,
      status,must_change_password,auth_credential_version,access_config)
    VALUES ($1,$1,$2,$1,'30000000-0000-4000-8000-000000000001','Pessoa de Teste',
      'temporary@example.com','52998224725','email','Pendente',true,$3,'{"enabled":false}')`,
  [authId, companyId, version]);
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
  const context = (await db.query('SELECT public.obter_contexto_usuario_atual() AS value')).rows[0].value;
  assert.equal(context.must_change_password, true);
  assert.equal(context.email, 'temporary@example.com');
  assert.equal(context.login_method, 'email');
  assert.equal((await db.query('SELECT public.current_user_access_allowed($1) AS value', [companyId])).rows[0].value, false);
  const rejectionCases = [
    ['unconfirmed email', 'UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1'],
    ['missing invite', 'UPDATE auth.users SET invited_at=NULL WHERE id=$1'],
    ['mismatched email', "UPDATE auth.users SET email='other@example.com' WHERE id=$1"],
    ['wrong account type', "UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data || '{\"account_type\":\"employee_cpf\"}' WHERE id=$1"],
    ['stale credential', "UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data || '{\"credential_version\":\"50000000-0000-4000-8000-000000000002\"}' WHERE id=$1"],
    ['inactive user', "UPDATE public.configuracoes_usuarios SET status='Inativo' WHERE id=$1"],
    ['active membership', 'UPDATE public.perfis SET ativo=true WHERE id=$1'],
    ['privileged membership', "UPDATE public.perfis SET papel='admin' WHERE id=$1"],
    ['cross tenant profile', "UPDATE public.configuracoes_usuarios SET perfil_acesso_id='30000000-0000-4000-8000-000000000002' WHERE id=$1"],
  ];
  for (const [name, mutation] of rejectionCases) {
    await db.exec('BEGIN');
    await db.query(mutation, [authId]);
    await assert.rejects(db.query('SELECT public.obter_contexto_usuario_atual()'), (error) => error.code === (['inactive user', 'active membership'].includes(name) ? '23514' : '42501'), name);
    await db.exec('ROLLBACK');
  }
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ ...claims, app_metadata: {} })]);
  await assert.rejects(db.query('SELECT public.obter_contexto_usuario_atual()'), (error) => error.code === '42501');
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: '20000000-0000-4000-8000-000000000001' })]);
  assert.deepEqual((await db.query('SELECT public.obter_contexto_usuario_atual() AS value')).rows[0].value, { existing_path: true });
  console.log('PASS email first access, RLS remains blocked, 10 invalid states rejected, existing account path preserved');
} finally {
  await db.close();
}
