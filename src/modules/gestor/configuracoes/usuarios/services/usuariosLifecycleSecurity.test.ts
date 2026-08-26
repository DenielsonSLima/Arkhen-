import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryCall {
  table: string;
  operation: 'select' | 'update' | 'insert' | 'delete' | null;
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

const mocks = vi.hoisted(() => {
  const calls: QueryCall[] = [];
  const results: QueryResult[] = [];

  const from = vi.fn((table: string) => {
    const call: QueryCall = { table, operation: null, filters: [] };
    calls.push(call);

    const consume = () => Promise.resolve(results.shift() || { data: null, error: null });
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => {
      if (!call.operation) call.operation = 'select';
      return builder;
    });
    builder.update = vi.fn((payload: unknown) => {
      call.operation = 'update';
      call.payload = payload;
      return builder;
    });
    builder.insert = vi.fn((payload: unknown) => {
      call.operation = 'insert';
      call.payload = payload;
      return builder;
    });
    builder.delete = vi.fn(() => {
      call.operation = 'delete';
      return builder;
    });
    builder.eq = vi.fn((column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    });
    builder.single = vi.fn(consume);
    builder.maybeSingle = vi.fn(consume);
    builder.order = vi.fn(() => builder);
    builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => (
      consume().then(resolve, reject)
    );
    return builder;
  });

  return {
    calls,
    results,
    from,
    rpc: vi.fn(),
    getUser: vi.fn(),
    invoke: vi.fn(),
  };
});

vi.mock('../../../../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
  },
}));

import { usuariosService, type SaveUsuarioInput } from './usuariosService';

const row = {
  id: 'usuario-config',
  empresa_id: 'empresa-real',
  auth_user_id: 'auth-convidado',
  perfil_id: 'membership-real',
  nome: 'Pessoa Convidada',
  email: 'pessoa@empresa.com.br',
  cpf: null,
  telefone: null,
  perfil: 'Assistente',
  status: 'Ativo' as const,
  access_config: null,
  ultimo_acesso_em: null,
  created_at: '2026-08-25T00:00:00.000Z',
};

const editInput: SaveUsuarioInput = {
  id: row.id,
  nome: row.nome,
  email: row.email,
  cpf: '',
  telefone: '',
  perfil: row.perfil,
  status: 'Ativo',
  accessConfig: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    intervals: [{ start: '08:00', end: '18:00' }],
    message: 'Fora do horário.',
  },
};

describe('usuariosService — integridade do vínculo Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.results.length = 0;
    mocks.rpc.mockResolvedValue({ data: row, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-gestor' } }, error: null });
  });

  it('nunca vincula uma conta por e-mail no navegador', async () => {
    mocks.results.push({ data: row, error: null });

    const result = await usuariosService.vincularAuthUserPorEmail(
      ' PESSOA@EMPRESA.COM.BR ',
      'auth-convidado',
    );

    expect(result?.authUserId).toBe('auth-convidado');
    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0]).toMatchObject({
      table: 'configuracoes_usuarios',
      operation: 'select',
      filters: [
        ['auth_user_id', 'auth-convidado'],
        ['email', 'pessoa@empresa.com.br'],
      ],
    });
  });

  it('inativa cadastro e membership em uma única chamada transacional', async () => {
    await usuariosService.inativarUsuario(row.id);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('salvar_usuario_configurado', {
      p_usuario_id: row.id,
      p_payload: { status: 'Inativo' },
    });
    expect(mocks.calls.filter((call) => call.operation === 'update')).toHaveLength(0);
  });

  it('expõe o bloqueio do banco ao trocar e-mail de conta Auth vinculada', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'O e-mail de uma conta vinculada não pode ser alterado.' },
    });

    await expect(usuariosService.saveUsuario({
      ...editInput,
      email: 'outra-pessoa@empresa.com.br',
    })).rejects.toThrow('não pode ser alterado');

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('não exclui cadastro já vinculado ao Auth, mesmo sem histórico', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'empresa-real', error: null });
    mocks.results.push({ data: row, error: null });

    await expect(usuariosService.excluirUsuario({
      id: row.id,
      authUserId: row.auth_user_id,
      nome: row.nome,
      email: row.email,
      cpf: '',
      telefone: '',
      perfil: row.perfil,
      status: row.status,
      accessConfig: editInput.accessConfig,
      createdAt: row.created_at,
    })).rejects.toThrow('Use Inativar');

    expect(mocks.calls.filter((call) => call.operation === 'delete')).toHaveLength(0);
  });

  it('envia a troca de perfil para derivação atômica de papel no servidor', async () => {
    await usuariosService.saveUsuario({
      ...editInput,
      perfil: 'Administrador',
      status: 'Ativo',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('salvar_usuario_configurado', {
      p_usuario_id: row.id,
      p_payload: expect.objectContaining({
        perfil: 'Administrador',
        status: 'Ativo',
      }),
    });
    expect(mocks.calls.filter((call) => call.operation === 'update')).toHaveLength(0);
  });
});
