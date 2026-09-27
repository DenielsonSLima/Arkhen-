// Banco isolado. Argumentos: entrada do PGlite e migration a validar.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const ids = {
  company: '10000000-0000-4000-8000-000000000001',
  owner: '20000000-0000-4000-8000-000000000001',
  member: '20000000-0000-4000-8000-000000000002',
};
const claims = (id, role = 'authenticated') => db.query(
  "SELECT set_config('request.jwt.claims',$1,false)",
  [JSON.stringify({ sub: id, role })],
);
try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid
    $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
      SELECT current_setting('request.jwt.claims',true)::jsonb->>'role'
    $$;
    CREATE TABLE public.perfis (
      id uuid, user_id uuid, empresa_id uuid, papel text, ativo boolean
    );
    CREATE TABLE public.configuracoes_usuarios (
      id uuid PRIMARY KEY, empresa_id uuid, auth_user_id uuid, perfil_id uuid,
      perfil text, status text, access_config jsonb, nome text,
      must_change_password boolean DEFAULT false,
      ultimo_acesso_em timestamptz, updated_at timestamptz,
      future_sensitive_column text
    );
    CREATE FUNCTION public.current_user_is_empresa_admin(company uuid)
    RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS (SELECT 1 FROM public.perfis WHERE user_id=auth.uid()
        AND empresa_id=company AND papel='admin' AND ativo)
    $$;
  `);
  for (const [id, role] of [[ids.owner, 'admin'], [ids.member, 'membro']]) {
    await db.query('INSERT INTO public.perfis VALUES ($1,$1,$2,$3,true)', [id, ids.company, role]);
    await db.query(`INSERT INTO public.configuracoes_usuarios
      (id,empresa_id,auth_user_id,perfil_id,perfil,status,access_config,nome)
      VALUES ($1,$2,$1,$1,'Administrador','Ativo','{"enabled":false}','Pessoa')`, [id, ids.company]);
  }
  await db.exec(await readFile(resolve(process.argv[3]), 'utf8'));
  await db.exec(`CREATE TRIGGER proteger_admin BEFORE UPDATE OR DELETE
    ON public.configuracoes_usuarios FOR EACH ROW
    EXECUTE FUNCTION public.proteger_administrador_configurado()`);
  await claims(ids.member);
  const login = await db.query(`UPDATE public.configuracoes_usuarios
    SET ultimo_acesso_em=now(),updated_at=now() WHERE id=$1 RETURNING ultimo_acesso_em`, [ids.member]);
  assert(login.rows[0].ultimo_acesso_em, 'Administrador gerenciado consegue registrar o proprio login');
  const forbiddenUpdates = [
    ["nome='Outro'", ids.member],
    ["status='Inativo'", ids.member],
    ["perfil='Gestor'", ids.member],
    ["access_config='{" + '"enabled":true' + "}'", ids.member],
    ['must_change_password=true', ids.member],
    ["future_sensitive_column='alterado'", ids.member],
    ['ultimo_acesso_em=now()', ids.owner],
    ['empresa_id=gen_random_uuid()', ids.member],
    ['auth_user_id=gen_random_uuid()', ids.member],
  ];
  for (const [assignment, id] of forbiddenUpdates) {
    await assert.rejects(db.query(`UPDATE public.configuracoes_usuarios
      SET ${assignment},updated_at=now() WHERE id=$1`, [id]), e => e.code === '42501', assignment);
  }
  await assert.rejects(db.query('DELETE FROM public.configuracoes_usuarios WHERE id=$1', [ids.member]), e => e.code === '42501');
  await claims(null);
  await assert.rejects(db.query('UPDATE public.configuracoes_usuarios SET ultimo_acesso_em=now() WHERE id=$1', [ids.member]), e => e.code === '42501');
  await claims(ids.owner);
  await db.query("UPDATE public.configuracoes_usuarios SET nome='Editado pelo gestor' WHERE id=$1", [ids.member]);
  await assert.rejects(db.query('DELETE FROM public.configuracoes_usuarios WHERE id=$1', [ids.owner]), e => e.code === '23514');
  await assert.rejects(db.query(`UPDATE public.configuracoes_usuarios
    SET access_config='{"enabled":true}' WHERE id=$1`, [ids.owner]), e => e.code === '23514');
  console.log('PASS login do administrador gerenciado, 11 alteracoes indevidas bloqueadas, gestor e protecao do ultimo administrador preservados');
} finally {
  await db.close();
}
