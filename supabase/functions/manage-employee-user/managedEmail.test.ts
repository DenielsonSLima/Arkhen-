import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  createClient: vi.fn(),
  authenticate: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  invite: vi.fn(),
}));

vi.mock('./runtime.ts', () => ({
  HttpError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  asRecord: (value: unknown) => value,
  authenticateActor: mocks.authenticate,
  createServiceClient: mocks.createClient,
  jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
}));

import { inviteRedirectUrl } from './inviteConfiguration.ts';
import { inviteEmployeeByEmail } from './managedEmail.ts';

const payload = {
  nome: 'Pessoa de Teste',
  email: 'convite@example.com',
  cpf: '52998224725',
  telefone: '79999999999',
  perfil_id: '30000000-0000-4000-8000-000000000001',
  access_config: { enabled: false },
};
const request = new Request('https://edge.example.com', {
  method: 'POST', headers: { origin: 'https://untrusted.example.com' },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('Deno', { env: { get: mocks.env } });
  mocks.authenticate.mockResolvedValue('actor-id');
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === 'provisionar_usuario_funcionario_email'
      ? { id: 'usuario-id', status: 'Pendente', must_change_password: true }
      : {},
    error: null,
  }));
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null });
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.invite.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({
    rpc: mocks.rpc,
    auth: { admin: {
      createUser: mocks.createUser,
      deleteUser: mocks.deleteUser,
      inviteUserByEmail: mocks.invite,
    } },
  });
});

describe('destino do convite', () => {
  it('usa o domínio canônico quando APP_URL não está configurado', () => {
    expect(inviteRedirectUrl()).toBe('https://arkhen.vercel.app/redefinir-senha');
    expect(inviteRedirectUrl('  ')).toBe('https://arkhen.vercel.app/redefinir-senha');
  });

  it('preserva a origem configurada e remove caminho, query e fragmento', () => {
    expect(inviteRedirectUrl('https://preview.example.com/rota?origem=x#fragmento'))
      .toBe('https://preview.example.com/redefinir-senha');
    expect(inviteRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/redefinir-senha');
  });

  it.each(['invalid', '//example.com', 'http://example.com', 'file://localhost/rota',
    'javascript:alert(1)', 'https://user:password@example.com'])('rejeita configuração insegura: %s', (value) => {
    expect(() => inviteRedirectUrl(value)).toThrow('endereço de ativação');
  });
});

describe('envio de convite e falhas parciais', () => {
  it('envia para a página de primeira senha sem depender de APP_URL ou do Origin do caller', async () => {
    const response = await inviteEmployeeByEmail(request, payload);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, invite_sent: true });
    expect(mocks.invite).toHaveBeenCalledWith('convite@example.com', {
      redirectTo: 'https://arkhen.vercel.app/redefinir-senha',
      data: { nome: 'Pessoa de Teste', conta_gerenciada: true },
    });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ email_confirm: false }));
    expect(mocks.rpc.mock.invocationCallOrder[1]).toBeLessThan(mocks.invite.mock.invocationCallOrder[0]);
  });

  it('recusa destino inválido antes de criar conta ou vínculo', async () => {
    mocks.env.mockReturnValue('invalid');
    await expect(inviteEmployeeByEmail(request, payload)).rejects.toMatchObject({ status: 503 });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it.each(['response', 'network'])('compensa envio que falhou por %s sem devolver sucesso', async (failure) => {
    if (failure === 'network') mocks.invite.mockRejectedValue(new Error('network failed'));
    else mocks.invite.mockResolvedValue({ error: { message: 'SMTP unavailable' } });
    await expect(inviteEmployeeByEmail(request, payload)).rejects.toMatchObject({ status: 503 });
    expect(mocks.rpc).toHaveBeenCalledWith('desfazer_provisionamento_funcionario_email', {
      p_actor_user_id: 'actor-id', p_auth_user_id: 'auth-id',
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith('auth-id');
  });

  it('preserva a conta quando a compensação não pode provar que o convite não foi enviado', async () => {
    mocks.invite.mockRejectedValue(new Error('response lost'));
    mocks.rpc.mockImplementation(async (name: string) => name === 'desfazer_provisionamento_funcionario_email'
      ? { data: null, error: { code: '42501' } }
      : { data: { id: 'usuario-id' }, error: null });
    await expect(inviteEmployeeByEmail(request, payload)).rejects.toThrow('reconciliação');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
