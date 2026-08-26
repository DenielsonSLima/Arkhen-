/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRequest: vi.fn(),
  transitionRequest: vi.fn(),
  retry: vi.fn(),
  optionsState: {
    data: {
      users: [
        { id: 'e0a841fa-a911-4d5e-b57d-2028a0416975', nome: 'Ana Responsável' },
        { id: 'd266a40a-ed27-4012-8af0-a18ebda1988e', nome: 'Bruno Revisor' },
      ],
      tasks: [{
        id: '90eae775-0708-482f-a22f-a27ba54ca765',
        titulo: 'Fechamento mensal',
        clienteId: '3b93af38-f16e-4f53-b646-80731e744ef9',
        competencia: '2026-08',
      }],
      documents: [],
    },
    isFetching: false,
    isError: false,
  },
  state: {
    requests: [{
      id: '24d7f2e0-6c02-49b1-b229-03d8ca3752d9',
      clienteId: '3b93af38-f16e-4f53-b646-80731e744ef9',
      competencia: '2026-08',
      titulo: 'Extratos bancários',
      descricao: 'Enviar em PDF.',
      dataLimite: '2026-09-05',
      status: 'Pendente' as const,
      responsavelId: 'e0a841fa-a911-4d5e-b57d-2028a0416975',
      responsavelNome: 'Ana Responsável',
      revisorId: '',
      revisorNome: '',
      tarefaId: '',
      tarefaTitulo: '',
      documentoId: '',
      documentoNome: '',
      evidenciaTexto: '',
      auditoriaPendente: false,
      allowedActions: ['Recebido' as const],
      history: [{
        id: 'evento-1', from: '', to: 'Pendente' as const,
        occurredAt: '2026-08-25T12:00:00.000Z', actorName: 'Gestora Real',
      }],
      createdAt: '2026-08-25T12:00:00.000Z',
      updatedAt: '2026-08-25T12:00:00.000Z',
    }],
    clients: [
      { id: '3b93af38-f16e-4f53-b646-80731e744ef9', nome: 'Cliente Exemplo Ltda.', status: 'Ativa' as const },
      { id: '1744b203-189c-476e-a47c-d10648b43387', nome: 'Outro Cliente Ativo Ltda.', status: 'Ativa' as const },
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
    transitionRequest: mocks.transitionRequest,
    retry: mocks.retry,
  }),
  useDocumentRequestOptions: () => ({
    ...mocks.optionsState,
    refetch: vi.fn(),
  }),
}));

import { SolicitacoesDocumentosTab } from './SolicitacoesDocumentosTab';

describe('SolicitacoesDocumentosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRequest.mockResolvedValue(undefined);
    mocks.transitionRequest.mockResolvedValue(undefined);
    mocks.state.canCreate = true;
    mocks.state.canUpdate = true;
    mocks.optionsState.isFetching = false;
    mocks.optionsState.isError = false;
  });

  afterEach(cleanup);

  it('mostra empresa, competência, prazo e estado operacional persistido', () => {
    render(<SolicitacoesDocumentosTab />);

    expect(screen.getAllByText('Cliente Exemplo Ltda.')).toHaveLength(2);
    expect(screen.getByText('agosto de 2026')).toBeTruthy();
    expect(screen.getByText('05/09/2026')).toBeTruthy();
    expect(screen.getAllByText('Pendente').length).toBeGreaterThan(0);
    expect(screen.getByText('Responsável: Ana Responsável')).toBeTruthy();
    fireEvent.click(screen.getByText('Histórico auditável (1)'));
    expect(screen.getByText(/Gestora Real/)).toBeTruthy();
  });

  it('cria uma solicitação vinculada ao cliente e à competência informados', async () => {
    render(<SolicitacoesDocumentosTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    fireEvent.change(screen.getByLabelText('Empresa cliente'), {
      target: { value: '3b93af38-f16e-4f53-b646-80731e744ef9' },
    });
    fireEvent.change(screen.getByLabelText('Competência da solicitação'), { target: { value: '2026-07' } });
    fireEvent.change(screen.getByLabelText('Data limite'), { target: { value: '2026-08-08' } });
    fireEvent.change(screen.getByLabelText('Responsável'), {
      target: { value: 'e0a841fa-a911-4d5e-b57d-2028a0416975' },
    });
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
      responsavelId: 'e0a841fa-a911-4d5e-b57d-2028a0416975',
      revisorId: '',
      tarefaId: '',
    }));
  });

  it('persiste a transição com evidência explícita', async () => {
    render(<SolicitacoesDocumentosTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }));
    fireEvent.change(screen.getByLabelText('Evidência ou justificativa'), {
      target: { value: 'Arquivo recebido e conferido.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(mocks.transitionRequest).toHaveBeenCalledWith({
      id: '24d7f2e0-6c02-49b1-b229-03d8ca3752d9',
      status: 'Recebido',
      justification: 'Arquivo recebido e conferido.',
      documentId: undefined,
    }));
  });

  it('desabilita criação e alteração para um perfil somente leitura', () => {
    mocks.state.canCreate = false;
    mocks.state.canUpdate = false;

    render(<SolicitacoesDocumentosTab />);

    expect((screen.getByRole('button', { name: 'Nova solicitação' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/itens atribuídos a você continuam/i)).toBeTruthy();
  });

  it('mantém clientes inativos disponíveis para identificação e filtro histórico', () => {
    render(<SolicitacoesDocumentosTab />);

    expect(screen.getByRole('option', { name: 'Cliente Histórico Ltda. (Inativa)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    const formRegion = screen.getByRole('region', { name: 'Nova solicitação' });
    expect(within(formRegion).queryByRole('option', { name: /Cliente Histórico/ })).toBeNull();
  });

  it('descarta vínculos incompatíveis ao trocar empresa ou competência', () => {
    render(<SolicitacoesDocumentosTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));

    const client = screen.getByLabelText('Empresa cliente') as HTMLSelectElement;
    const competence = screen.getByLabelText('Competência da solicitação') as HTMLInputElement;
    const responsible = screen.getByLabelText('Responsável') as HTMLSelectElement;
    const reviewer = screen.getByLabelText('Revisor (opcional)') as HTMLSelectElement;
    const task = screen.getByLabelText('Atividade vinculada (opcional)') as HTMLSelectElement;

    fireEvent.change(client, { target: { value: '3b93af38-f16e-4f53-b646-80731e744ef9' } });
    fireEvent.change(responsible, { target: { value: 'e0a841fa-a911-4d5e-b57d-2028a0416975' } });
    fireEvent.change(reviewer, { target: { value: 'd266a40a-ed27-4012-8af0-a18ebda1988e' } });
    fireEvent.change(task, { target: { value: '90eae775-0708-482f-a22f-a27ba54ca765' } });

    fireEvent.change(competence, { target: { value: '2026-09' } });
    expect(task.value).toBe('');
    fireEvent.change(task, { target: { value: '90eae775-0708-482f-a22f-a27ba54ca765' } });
    fireEvent.change(client, { target: { value: '1744b203-189c-476e-a47c-d10648b43387' } });
    expect(responsible.value).toBe('');
    expect(reviewer.value).toBe('');
    expect(task.value).toBe('');
  });

  it('bloqueia opções e envio enquanto os vínculos estão carregando', () => {
    mocks.optionsState.isFetching = true;
    render(<SolicitacoesDocumentosTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    fireEvent.change(screen.getByLabelText('Empresa cliente'), {
      target: { value: '3b93af38-f16e-4f53-b646-80731e744ef9' },
    });

    expect(screen.getByText('Carregando responsáveis e atividades disponíveis...')).toBeTruthy();
    expect((screen.getByLabelText('Responsável') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Revisor (opcional)') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Atividade vinculada (opcional)') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Criar solicitação' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('expõe falha das opções e mantém o envio bloqueado', () => {
    mocks.optionsState.isError = true;
    render(<SolicitacoesDocumentosTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova solicitação' }));
    fireEvent.change(screen.getByLabelText('Empresa cliente'), {
      target: { value: '3b93af38-f16e-4f53-b646-80731e744ef9' },
    });

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar responsáveis');
    expect((screen.getByRole('button', { name: 'Criar solicitação' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
