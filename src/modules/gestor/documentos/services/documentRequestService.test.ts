import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const order = vi.fn();
  const single = vi.fn();
  const builder = { insert, update, select, eq, order, single };

  from.mockReturnValue(builder);
  insert.mockReturnValue(builder);
  update.mockReturnValue(builder);
  select.mockReturnValue(builder);
  eq.mockReturnValue(builder);

  return { rpc, from, insert, update, select, eq, order, single };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import {
  documentRequestService,
  normalizeDocumentRequestInput,
} from './documentRequestService';

const EMPRESA_ID = 'dc02b4d1-5b5c-43a5-9871-2b5ed09c444e';
const CLIENTE_ID = '3b93af38-f16e-4f53-b646-80731e744ef9';
const REQUEST_ID = '24d7f2e0-6c02-49b1-b229-03d8ca3752d9';
const persistedRow = {
  id: REQUEST_ID,
  cliente_id: CLIENTE_ID,
  competencia: '2026-08-01',
  titulo: 'Extratos bancários',
  descricao: 'Enviar em PDF.',
  data_limite: '2026-09-05',
  status: 'Pendente',
  created_at: '2026-08-25T12:00:00.000Z',
  updated_at: '2026-08-25T12:00:00.000Z',
};

describe('documentRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_empresa_id') return { data: EMPRESA_ID, error: null };
      if (name === 'listar_clientes_solicitacoes_documentos') {
        return {
          data: [{ cliente_id: CLIENTE_ID, cliente_nome: 'Cliente Real Ltda.', cliente_status: 'Ativa' }],
          error: null,
        };
      }
      return { data: true, error: null };
    });
    mocks.single.mockResolvedValue({ data: persistedRow, error: null });
    mocks.order.mockResolvedValue({
      data: [{ id: CLIENTE_ID, nome: 'Cliente Real Ltda.' }],
      error: null,
    });
  });

  it('normaliza somente os campos permitidos da nova solicitação', () => {
    expect(normalizeDocumentRequestInput({
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      titulo: '  Extratos bancários  ',
      descricao: '  Enviar em PDF.  ',
      dataLimite: '2026-09-05',
    })).toEqual({
      cliente_id: CLIENTE_ID,
      competencia: '2026-08-01',
      titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.',
      data_limite: '2026-09-05',
    });
  });

  it.each([
    [{ clienteId: 'invalido', competencia: '2026-08', titulo: 'Extratos' }, 'empresa cliente'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-13', titulo: 'Extratos' }, 'competência'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-08', titulo: ' ' }, 'entre 2 e 160'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-08', titulo: 'Extratos', dataLimite: '2026-02-30' }, 'data limite'],
  ])('rejeita entrada inválida antes de consultar o banco', (input, message) => {
    expect(() => normalizeDocumentRequestInput(input)).toThrow(message);
  });

  it('inclui o tenant obtido da sessão ao criar e não aceita empresa do formulário', async () => {
    await expect(documentRequestService.create({
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.',
      dataLimite: '2026-09-05',
    })).resolves.toMatchObject({
      id: REQUEST_ID,
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      status: 'Pendente',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('current_empresa_id');
    expect(mocks.from).toHaveBeenCalledWith('documentos_solicitacoes');
    expect(mocks.insert).toHaveBeenCalledWith({
      empresa_id: EMPRESA_ID,
      cliente_id: CLIENTE_ID,
      competencia: '2026-08-01',
      titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.',
      data_limite: '2026-09-05',
    });
  });

  it('restringe a atualização do status por empresa e identificador', async () => {
    mocks.single.mockResolvedValue({
      data: { ...persistedRow, status: 'Em conferência' },
      error: null,
    });

    await expect(documentRequestService.updateStatus(REQUEST_ID, 'Em conferência'))
      .resolves.toMatchObject({ id: REQUEST_ID, status: 'Em conferência' });

    expect(mocks.update).toHaveBeenCalledWith({ status: 'Em conferência' });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, 'empresa_id', EMPRESA_ID);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, 'id', REQUEST_ID);
  });

  it('lista a identificação mínima dos clientes permitidos pelo RPC tenant-safe', async () => {
    await expect(documentRequestService.listClients()).resolves.toEqual([
      { id: CLIENTE_ID, nome: 'Cliente Real Ltda.', status: 'Ativa' },
    ]);

    expect(mocks.rpc).toHaveBeenCalledWith('listar_clientes_solicitacoes_documentos');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('deriva a capacidade de edição das permissões validadas no tenant', async () => {
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, string>) => {
      if (name === 'current_empresa_id') return { data: EMPRESA_ID, error: null };
      return { data: args?.p_permission === 'documentos:create', error: null };
    });

    await expect(documentRequestService.getCapabilities()).resolves.toEqual({
      canCreate: true,
      canUpdate: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('current_user_has_permission', {
      p_empresa_id: EMPRESA_ID,
      p_permission: 'documentos:create',
    });
  });

  it('não grava quando a sessão não possui empresa ativa', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'sem vínculo' } });

    await expect(documentRequestService.create({
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      titulo: 'Extratos bancários',
    })).rejects.toThrow('identificar o escritório');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
