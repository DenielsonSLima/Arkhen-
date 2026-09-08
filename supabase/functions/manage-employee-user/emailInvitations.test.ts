import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), invite: vi.fn(),
  redirect: vi.fn(), from: vi.fn(),
}));
vi.mock('./runtime.ts', () => ({
  HttpError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  authenticateActor: mocks.authenticate,
  createServiceClient: () => ({
    rpc: mocks.rpc, from: mocks.from,
    auth: { admin: { getUserById: mocks.getUser, inviteUserByEmail: mocks.invite } },
  }),
  jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
}));
vi.mock('./inviteConfiguration.ts', () => ({ inviteRedirectUrl: mocks.redirect }));

import { getEmailInvitationStatus, resendEmailInvite } from './emailInvitations.ts';

const tenant = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000001';
const authId = '30000000-0000-4000-8000-000000000001';
const membershipId = '40000000-0000-4000-8000-000000000001';
const profileId = '50000000-0000-4000-8000-000000000001';
const version = '60000000-0000-4000-8000-000000000001';
const request = new Request('https://example.com', { method: 'POST' });
let tables: Record<string, Record<string, unknown>[]>;
let authUser: Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue('70000000-0000-4000-8000-000000000001');
  mocks.rpc.mockResolvedValue({ data: tenant, error: null });
  mocks.redirect.mockReturnValue('https://arkhen.vercel.app/redefinir-senha');
  authUser = {
    id: authId, email: 'convite@example.com', invited_at: null,
    confirmation_sent_at: null, email_confirmed_at: null, last_sign_in_at: null,
    app_metadata: { login_method: 'email', account_type: 'employee_email', credential_version: version },
  };
  mocks.getUser.mockImplementation(async () => ({ data: { user: authUser }, error: null }));
  mocks.invite.mockResolvedValue({ data: { user: { id: authId } }, error: null });
  tables = {
    configuracoes_usuarios: [{
      id: userId, empresa_id: tenant, auth_user_id: authId, perfil_id: membershipId,
      perfil_acesso_id: profileId, nome: 'Pessoa de Teste', email: 'convite@example.com',
      auth_credential_version: version, login_method: 'email', status: 'Pendente',
      must_change_password: true,
    }],
    perfis: [{ id: membershipId, user_id: authId, empresa_id: tenant, papel: 'membro', ativo: false }],
    configuracoes_perfis_acesso: [{ id: profileId, empresa_id: tenant, ativo: true }],
  };
  mocks.from.mockImplementation((table: string) => {
    const filters: [string, unknown][] = [];
    const result = () => ({
      data: tables[table].filter((row) => filters.every(([key, value]) => row[key] === value)),
      error: null,
    });
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
});

describe('email invitation status', () => {
  it('consulta o gestor e retorna somente ID e timestamps do convite pendente', async () => {
    const response = await getEmailInvitationStatus(request);
    expect(mocks.authenticate).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('resolver_empresa_gestor_edge', {
      p_actor_user_id: '70000000-0000-4000-8000-000000000001',
    });
    expect(await response.json()).toEqual({ ok: true, invitations: [{
      usuario_id: userId, invited_at: null, confirmation_sent_at: null, email_confirmed_at: null,
    }] });
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it('informa aceite confirmado ainda pendente de primeira senha', async () => {
    authUser.email_confirmed_at = '2026-09-08T12:30:00Z';
    const response = await getEmailInvitationStatus(request);
    expect((await response.json()).invitations[0].email_confirmed_at)
      .toBe('2026-09-08T12:30:00Z');
  });

  it('nao retorna dados de outro tenant, inativos ou identidade inconsistente', async () => {
    tables.configuracoes_usuarios.push({
      ...tables.configuracoes_usuarios[0], id: 'outra-empresa', empresa_id: 'outro-tenant',
    });
    authUser.app_metadata = { account_type: 'employee_email', credential_version: 'errada' };
    expect(await (await getEmailInvitationStatus(request)).json())
      .toEqual({ ok: true, invitations: [] });
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it('falha fechada se o Auth estiver indisponivel', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'network' } });
    await expect(getEmailInvitationStatus(request)).rejects.toMatchObject({ status: 503 });
  });

  it('nao apresenta uma conta com acesso inconsistente como convite nao enviado', async () => {
    authUser.last_sign_in_at = '2026-09-08T12:30:00Z';
    expect(await (await getEmailInvitationStatus(request)).json())
      .toEqual({ ok: true, invitations: [] });
  });
});

describe('resend email invitation', () => {
  it.each([null, '2026-09-08T12:30:00Z'])('envia o mesmo convite sem recriar conta: %s', async (sentAt) => {
    authUser.invited_at = sentAt;
    authUser.confirmation_sent_at = sentAt;
    const response = await resendEmailInvite(request, { usuario_id: userId });
    expect(await response.json()).toEqual({ ok: true, usuario_id: userId, invite_sent: true });
    expect(mocks.invite).toHaveBeenCalledWith('convite@example.com', {
      redirectTo: 'https://arkhen.vercel.app/redefinir-senha',
      data: { nome: 'Pessoa de Teste', conta_gerenciada: true },
    });
  });

  it('nao envia quando o gestor nao tem autorizacao', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(resendEmailInvite(request, { usuario_id: userId }))
      .rejects.toMatchObject({ status: 403 });
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it.each([
    ['empresa_id', 'outro-tenant'], ['status', 'Inativo'], ['must_change_password', false],
    ['login_method', 'cpf'],
  ])('recusa usuario fora do conjunto pendente: %s', async (key, value) => {
    tables.configuracoes_usuarios[0][key as string] = value;
    await expect(resendEmailInvite(request, { usuario_id: userId }))
      .rejects.toMatchObject({ status: 404 });
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it.each(['membership', 'profile', 'email', 'version', 'user_metadata'])
    ('recusa vinculo inconsistente: %s', async (variation) => {
      if (variation === 'membership') tables.perfis[0].ativo = true;
      if (variation === 'profile') tables.configuracoes_perfis_acesso[0].empresa_id = 'outro-tenant';
      if (variation === 'email') authUser.email = 'outra-conta@example.com';
      if (variation === 'version') tables.configuracoes_usuarios[0].auth_credential_version = 'invalida';
      if (variation === 'user_metadata') {
        authUser.user_metadata = authUser.app_metadata;
        authUser.app_metadata = {};
      }
      await expect(resendEmailInvite(request, { usuario_id: userId }))
        .rejects.toMatchObject({ status: 403 });
      expect(mocks.invite).not.toHaveBeenCalled();
    });

  it.each(['email_confirmed_at', 'last_sign_in_at'])('recusa convite aceito: %s', async (key) => {
    authUser[key] = '2026-09-08T12:30:00Z';
    await expect(resendEmailInvite(request, { usuario_id: userId }))
      .rejects.toMatchObject({ status: 409 });
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it('nao declara envio se o provedor recusar ou retornar outra identidade', async () => {
    mocks.invite.mockResolvedValue({ data: { user: { id: 'outra-conta' } }, error: null });
    await expect(resendEmailInvite(request, { usuario_id: userId }))
      .rejects.toMatchObject({ status: 503 });
    mocks.invite.mockResolvedValue({ data: { user: null }, error: { message: 'SMTP failed' } });
    await expect(resendEmailInvite(request, { usuario_id: userId }))
      .rejects.toMatchObject({ status: 503 });
  });

  it('valida destino antes de iniciar qualquer operacao remota', async () => {
    mocks.redirect.mockImplementation(() => { throw new Error('configuracao invalida'); });
    await expect(resendEmailInvite(request, { usuario_id: userId })).rejects.toThrow('configuracao invalida');
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });
});
