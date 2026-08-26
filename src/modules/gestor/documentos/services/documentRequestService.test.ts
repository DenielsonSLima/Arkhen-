import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));

import {
  documentRequestService,
  normalizeDocumentRequestInput,
  normalizeDocumentRequestTransition,
} from './documentRequestService';

const EMPRESA_ID = 'dc02b4d1-5b5c-43a5-9871-2b5ed09c444e';
const CLIENTE_ID = '3b93af38-f16e-4f53-b646-80731e744ef9';
const REQUEST_ID = '24d7f2e0-6c02-49b1-b229-03d8ca3752d9';
const RESPONSAVEL_ID = 'e0a841fa-a911-4d5e-b57d-2028a0416975';
const REVISOR_ID = 'd266a40a-ed27-4012-8af0-a18ebda1988e';
const DOCUMENT_ID = '7f5214cf-a502-45c1-80d7-c67cbe8e4be1';
const persistedRequest = {
  id: REQUEST_ID, clienteId: CLIENTE_ID, competencia: '2026-08',
  titulo: 'Extratos bancários', descricao: 'Enviar em PDF.', dataLimite: '2026-09-05',
  status: 'Pendente', responsavelId: RESPONSAVEL_ID, responsavelNome: 'Ana Responsável',
  revisorId: REVISOR_ID, revisorNome: 'Bruno Revisor', tarefaId: '', tarefaTitulo: '',
  documentoId: '', documentoNome: '', evidenciaTexto: '', auditoriaPendente: false,
  allowedActions: ['Recebido'], history: [],
  createdAt: '2026-08-25T12:00:00.000Z', updatedAt: '2026-08-25T12:00:00.000Z',
};

describe('documentRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'current_empresa_id') return { data: EMPRESA_ID, error: null };
      if (name === 'current_user_has_permission') return { data: true, error: null };
      if (name === 'listar_clientes_solicitacoes_documentos') return {
        data: [{ cliente_id: CLIENTE_ID, cliente_nome: 'Cliente Real Ltda.', cliente_status: 'Ativa' }], error: null,
      };
      if (name === 'listar_solicitacoes_documentos_operacionais') return { data: [persistedRequest], error: null };
      if (name === 'listar_opcoes_solicitacoes_documentos') return { data: {
        users: [{ id: RESPONSAVEL_ID, nome: 'Ana Responsável' }], tasks: [],
        documents: [{ id: DOCUMENT_ID, nome: 'extrato.pdf' }],
      }, error: null };
      if (name === 'criar_solicitacao_documento_operacional') return { data: persistedRequest, error: null };
      if (name === 'transicionar_solicitacao_documento_operacional') return {
        data: { ...persistedRequest, status: args?.p_status, evidenciaTexto: args?.p_justificativa }, error: null,
      };
      return { data: null, error: { message: 'RPC inesperado' } };
    });
  });

  it('normaliza somente campos operacionais permitidos', () => {
    expect(normalizeDocumentRequestInput({
      clienteId: CLIENTE_ID, competencia: '2026-08', titulo: '  Extratos bancários  ',
      descricao: '  Enviar em PDF.  ', dataLimite: '2026-09-05',
      responsavelId: RESPONSAVEL_ID, revisorId: REVISOR_ID,
    })).toEqual({
      cliente_id: CLIENTE_ID, competencia: '2026-08-01', titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.', data_limite: '2026-09-05',
      responsavel_id: RESPONSAVEL_ID, revisor_id: REVISOR_ID, tarefa_id: null,
    });
  });

  it.each([
    [{ clienteId: 'invalido', competencia: '2026-08', titulo: 'Extratos', dataLimite: '2026-09-05', responsavelId: RESPONSAVEL_ID }, 'empresa cliente'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-13', titulo: 'Extratos', dataLimite: '2026-09-05', responsavelId: RESPONSAVEL_ID }, 'competência'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-08', titulo: ' ', dataLimite: '2026-09-05', responsavelId: RESPONSAVEL_ID }, 'entre 2 e 160'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-08', titulo: 'Extratos', dataLimite: '2026-02-30', responsavelId: RESPONSAVEL_ID }, 'data limite'],
    [{ clienteId: CLIENTE_ID, competencia: '2026-08', titulo: 'Extratos', dataLimite: '2026-09-05', responsavelId: RESPONSAVEL_ID, revisorId: RESPONSAVEL_ID }, 'pessoas diferentes'],
  ])('rejeita entrada inválida antes do banco', (input, message) => {
    expect(() => normalizeDocumentRequestInput(input)).toThrow(message);
  });

  it('cria somente pela RPC auditável sem DML direto', async () => {
    await expect(documentRequestService.create({
      clienteId: CLIENTE_ID, competencia: '2026-08', titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.', dataLimite: '2026-09-05',
      responsavelId: RESPONSAVEL_ID, revisorId: REVISOR_ID,
    })).resolves.toMatchObject({ id: REQUEST_ID, responsavelNome: 'Ana Responsável' });
    expect(mocks.rpc).toHaveBeenCalledWith('criar_solicitacao_documento_operacional', {
      p_payload: expect.objectContaining({ cliente_id: CLIENTE_ID, responsavel_id: RESPONSAVEL_ID }),
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('transiciona com justificativa e documento real pela RPC', async () => {
    await expect(documentRequestService.transition({
      id: REQUEST_ID, status: 'Recebido', justification: 'Arquivo recebido e identificado.',
      documentId: DOCUMENT_ID,
    })).resolves.toMatchObject({ status: 'Recebido' });
    expect(mocks.rpc).toHaveBeenCalledWith('transicionar_solicitacao_documento_operacional', {
      p_id: REQUEST_ID, p_status: 'Recebido', p_justificativa: 'Arquivo recebido e identificado.',
      p_documento_id: DOCUMENT_ID,
    });
  });

  it('barra transição sem evidência suficiente', () => {
    expect(() => normalizeDocumentRequestTransition({
      id: REQUEST_ID, status: 'Concluído', justification: 'ok',
    })).toThrow('entre 8 e 2.000');
  });

  it('lista clientes e opções somente por RPCs tenant-safe', async () => {
    await expect(documentRequestService.listClients()).resolves.toEqual([
      { id: CLIENTE_ID, nome: 'Cliente Real Ltda.', status: 'Ativa' },
    ]);
    await expect(documentRequestService.listOptions(CLIENTE_ID, '2026-08')).resolves.toMatchObject({
      users: [{ id: RESPONSAVEL_ID, nome: 'Ana Responsável' }],
      documents: [{ id: DOCUMENT_ID, nome: 'extrato.pdf' }],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('não transforma resposta malformada da listagem em estado vazio', async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'listar_solicitacoes_documentos_operacionais') {
        return { data: { unexpected: true }, error: null };
      }
      return { data: null, error: { message: 'RPC inesperado' } };
    });

    await expect(documentRequestService.list()).rejects.toThrow('formato inválido');
  });

  it('deriva capacidade pelas permissões do tenant', async () => {
    await expect(documentRequestService.getCapabilities()).resolves.toEqual({ canCreate: true, canUpdate: true });
  });

  it('propaga erro do servidor sem tentar DML direto', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'sessão sem escritório' } });
    await expect(documentRequestService.create({
      clienteId: CLIENTE_ID, competencia: '2026-08', titulo: 'Extratos bancários',
      dataLimite: '2026-09-05', responsavelId: RESPONSAVEL_ID,
    })).rejects.toThrow('sessão sem escritório');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
