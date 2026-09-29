/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceHook = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAtividadesWorkspace', () => ({
  useAtividadesWorkspace: workspaceHook,
}));

import { AbaRotinas } from './AbaRotinas';

const saveRotinaAsync = vi.fn();
const deleteRotinaAsync = vi.fn();
const assignResponsibleAsync = vi.fn();
const assignResponsibleBatchAsync = vi.fn();

const rotina = {
  id: '11111111-1111-4111-8111-111111111111',
  clienteId: '22222222-2222-4222-8222-222222222222',
  modeloId: '33333333-3333-4333-8333-333333333333',
  protocoloCodigo: 'extrato-bancario',
  nome: 'Extrato Bancário',
  categoria: 'Documentos',
  frequencia: 'Mensal',
  intervaloDias: 30,
  responsavel: '',
  cliente: 'Empresa Alfa',
  proximaExecucao: '2026-09-05',
  prioridade: 'Média',
  ativa: true,
  checklist: ['Receber extrato'],
  observacoes: '',
};

const cliente = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Empresa Alfa',
  cnpj: '12.345.678/0001-90',
  regime: 'Simples Nacional',
  tipoParceiroId: 'cliente-contabil',
  tipoParceiroNome: 'Cliente Contábil',
  isClienteContabil: true,
  tipoEstabelecimento: 'Matriz',
  modelosAtivos: ['33333333-3333-4333-8333-333333333333'],
};

const usuario = {
  configUsuarioId: '44444444-4444-4444-8444-444444444444',
  userId: '55555555-5555-4555-8555-555555555555',
  nome: 'Ana Gestora',
};

const makeWorkspace = () => ({
  rotinas: [rotina],
  tarefas: [],
  usuarios: [usuario],
  usuarioAtual: usuario,
  clientes: [cliente],
  modelos: [{
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Documentos mensais',
    descricao: '',
    etapas: ['Receber extrato'],
  }],
  podeGerenciar: true,
  isLoadingPermissoes: false,
  isLoading: false,
  isSaving: false,
  workspaceError: null,
  refetchWorkspace: vi.fn(),
  saveRotinaAsync,
  deleteRotinaAsync,
  assignResponsibleAsync,
  assignResponsibleBatchAsync,
});

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  workspaceHook.mockReturnValue(makeWorkspace());
  saveRotinaAsync.mockResolvedValue(undefined);
  deleteRotinaAsync.mockResolvedValue(undefined);
  assignResponsibleAsync.mockResolvedValue(undefined);
  assignResponsibleBatchAsync.mockResolvedValue({
    successIds: [rotina.id],
    failed: [],
  });
});

describe('AbaRotinas', () => {
  it('abre por empresas, elimina as abas antigas e atribui responsável dentro da empresa', async () => {
    render(<AbaRotinas />);

    expect(screen.getByRole('tab', { name: /empresas/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /consulta/i })).toBeTruthy();
    expect(screen.queryByText('Todos os Modelos')).toBeNull();
    expect(screen.queryByText('Diárias')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /empresa alfa/i }));
    expect(await screen.findByText('Extrato Bancário')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Responsável por Extrato Bancário'), {
      target: { value: usuario.configUsuarioId },
    });

    await waitFor(() => {
      expect(assignResponsibleAsync).toHaveBeenCalledWith({
        rotina: expect.objectContaining({ id: rotina.id, clienteId: cliente.id }),
        responsibleId: usuario.configUsuarioId,
      });
    });
  });

  it('filtra por CNPJ e confirma a reatribuição em lote', async () => {
    render(<AbaRotinas />);
    fireEvent.click(screen.getByRole('tab', { name: /consulta/i }));

    fireEvent.change(screen.getByLabelText('Buscar rotinas'), { target: { value: '12345678' } });
    expect(await screen.findByText('Extrato Bancário')).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/Selecionar Extrato Bancário/));
    fireEvent.change(screen.getByLabelText('Novo responsável das rotinas selecionadas'), {
      target: { value: usuario.configUsuarioId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Alterar responsável' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar alteração' }));

    await waitFor(() => {
      expect(assignResponsibleBatchAsync).toHaveBeenCalledWith({
        rotinas: [expect.objectContaining({ id: rotina.id })],
        responsibleId: usuario.configUsuarioId,
      });
    });
  });

  it('seleciona todas as áreas da empresa e define um responsável em lote', async () => {
    const rotinaFiscal = {
      ...rotina,
      id: '77777777-7777-4777-8777-777777777777',
      nome: 'DCTFWeb',
      categoria: 'Fiscal',
    };
    workspaceHook.mockReturnValue({
      ...makeWorkspace(),
      rotinas: [rotina, rotinaFiscal],
    });
    assignResponsibleBatchAsync.mockResolvedValueOnce({
      successIds: [rotina.id, rotinaFiscal.id],
      failed: [],
    });
    render(<AbaRotinas />);

    fireEvent.click(screen.getByRole('button', { name: /empresa alfa/i }));
    expect(screen.getByRole('heading', { name: 'Fiscal' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }));
    fireEvent.change(screen.getByLabelText('Novo responsável das rotinas selecionadas da empresa'), {
      target: { value: usuario.configUsuarioId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Definir responsável' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar alteração' }));

    await waitFor(() => {
      expect(assignResponsibleBatchAsync).toHaveBeenCalledWith({
        rotinas: expect.arrayContaining([
          expect.objectContaining({ id: rotina.id }),
          expect.objectContaining({ id: rotinaFiscal.id }),
        ]),
        responsibleId: usuario.configUsuarioId,
      });
    });
  });

  it('avisa sobre rotinas sem empresa ativa e oferece acesso pela Consulta', () => {
    workspaceHook.mockReturnValue({
      ...makeWorkspace(),
      rotinas: [{ ...rotina, clienteId: undefined }],
    });

    render(<AbaRotinas />);

    expect(screen.getByText(/1 rotina não está vinculada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Consulta' }));

    expect(screen.getByRole('tab', { name: /consulta/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Extrato Bancário')).toBeTruthy();
  });

  it('filtra parceiros por tipo e impede criar rotina fora de Cliente Contábil', () => {
    const fornecedor = {
      ...cliente,
      id: '66666666-6666-4666-8666-666666666666',
      nome: 'Fornecedor Beta',
      cnpj: '98.765.432/0001-10',
      regime: 'Lucro Real',
      tipoParceiroId: 'fornecedor',
      tipoParceiroNome: 'Fornecedor',
      isClienteContabil: false,
    };
    workspaceHook.mockReturnValue({
      ...makeWorkspace(),
      clientes: [cliente, fornecedor],
    });

    render(<AbaRotinas />);
    fireEvent.change(screen.getByLabelText('Filtrar por tipo de parceiro'), {
      target: { value: 'fornecedor' },
    });

    expect(screen.queryByRole('button', { name: /Empresa Alfa/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fornecedor Beta/ }));
    expect(screen.queryByRole('button', { name: /Nova rotina|Criar primeira rotina/ })).toBeNull();
    expect(screen.getByText(/somente para parceiros do tipo Cliente Contábil/)).toBeTruthy();
  });

  it('preserva filtros e página ao abrir uma empresa e voltar', () => {
    const clientes = Array.from({ length: 13 }, (_, index) => ({
      ...cliente,
      id: `cliente-${String(index + 1).padStart(2, '0')}`,
      nome: `Empresa ${String(index + 1).padStart(2, '0')}`,
      cnpj: `12.345.678/00${String(index + 1).padStart(2, '0')}-90`,
    }));
    workspaceHook.mockReturnValue({
      ...makeWorkspace(),
      rotinas: [],
      clientes,
    });

    render(<AbaRotinas />);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    fireEvent.click(screen.getByRole('button', { name: /Empresa 13/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para empresas' }));

    expect(screen.getByRole('button', { name: /Empresa 13/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Página 2' }).getAttribute('aria-current')).toBe('page');
  });
});
