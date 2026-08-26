/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRequest: vi.fn(),
  updateStatus: vi.fn(),
  retry: vi.fn(),
  state: {
    requests: [{
      id: '24d7f2e0-6c02-49b1-b229-03d8ca3752d9',
      clienteId: '3b93af38-f16e-4f53-b646-80731e744ef9',
      competencia: '2026-08',
      titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.',
      dataLimite: '2026-09-05',
      status: 'Pendente' as const,
      createdAt: '2026-08-25T12:00:00.000Z',
      updatedAt: '2026-08-25T12:00:00.000Z',
    }],
    clients: [
      { id: '3b93af38-f16e-4f53-b646-80731e744ef9', nome: 'Cliente Exemplo Ltda.', status: 'Ativa' as const },
      { id: 'd9ab7852-35fd-4eef-a895-455ec59ffed3', nome: 'Cliente Histórico Ltda.', status: 'Inativa' as const },
    ],
    canCreate: true,
    canUpdate: true,
    isLoading: false,
    isError: false,
    errorMessage: '',
    isCreating: false,
    updatingRequestId: null as string | null,
    updateError: '',
  },
}));

vi.mock('../hooks/useDocumentRequests', () => ({
  useDocumentRequests: () => ({
    ...mocks.state,
    createRequest: mocks.createRequest,
    updateStatus: mocks.updateStatus,
    retry: mocks.retry,
  }),
}));

import { SolicitacoesDocumentosTab } from './SolicitacoesDocumentosTab';

describe('SolicitacoesDocumentosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRequest.mockResolvedValue(undefined);
    mocks.updateStatus.mockResolvedValue(undefined);
    mocks.state.canCreate = true;
    mocks.state.canUpdate = true;
  });

  afterEach(cleanup);

  it('mostra empresa, competência, prazo e estado operacional persistido', () => {
    render(<SolicitacoesDocumentosTab />);

    expect(screen.getAllByText('Cliente Exemplo Ltda.')).toHaveLength(2);
    expect(screen.getByText('agosto de 2026')).toBeTruthy();
    expect(screen.getByText('05/09/2026')).toBeTruthy();
    expect(screen.getByLabelText('Status de Extratos bancários')).toBeTruthy();
  });

  it('cria uma solicitação vinculada ao cliente e à competência informados', async () => {
    render(<SolicitacoesDocumentosTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    fireEvent.change(screen.getByLabelText('Empresa cliente'), {
      target: { value: '3b93af38-f16e-4f53-b646-80731e744ef9' },
    });
    fireEvent.change(screen.getByLabelText('Competência da solicitação'), { target: { value: '2026-07' } });
    fireEvent.change(screen.getByLabelText('Data limite'), { target: { value: '2026-08-08' } });
    fireEvent.change(screen.getByLabelText('Documento solicitado'), { target: { value: 'Folha assinada' } });
    fireEvent.change(screen.getByLabelText('Orientações para o cliente (opcional)'), {
      target: { value: 'Enviar todas as páginas.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar solicitação' }));

    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith({
      clienteId: '3b93af38-f16e-4f53-b646-80731e744ef9',
      competencia: '2026-07',
      dataLimite: '2026-08-08',
      titulo: 'Folha assinada',
      descricao: 'Enviar todas as páginas.',
    }));
  });

  it('persiste a mudança do status selecionado', async () => {
    render(<SolicitacoesDocumentosTab />);

    fireEvent.change(screen.getByLabelText('Status de Extratos bancários'), {
      target: { value: 'Recebido' },
    });

    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith({
      id: '24d7f2e0-6c02-49b1-b229-03d8ca3752d9',
      status: 'Recebido',
    }));
  });

  it('desabilita criação e alteração para um perfil somente leitura', () => {
    mocks.state.canCreate = false;
    mocks.state.canUpdate = false;

    render(<SolicitacoesDocumentosTab />);

    expect((screen.getByRole('button', { name: 'Nova solicitação' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Status de Extratos bancários') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/não criar ou alterar o andamento/i)).toBeTruthy();
  });

  it('mantém clientes inativos disponíveis para identificação e filtro histórico', () => {
    render(<SolicitacoesDocumentosTab />);

    expect(screen.getByRole('option', { name: 'Cliente Histórico Ltda. (Inativa)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    const formRegion = screen.getByRole('region', { name: 'Nova solicitação' });
    expect(within(formRegion).queryByRole('option', { name: /Cliente Histórico/ })).toBeNull();
  });
});
