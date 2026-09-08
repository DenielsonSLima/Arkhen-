/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsuariosConfig } from './UsuariosConfig';

const mocks = vi.hoisted(() => ({
  saveUsuario: vi.fn(), getUsuarios: vi.fn(), listInvitations: vi.fn(), resendInvitation: vi.fn(),
}));

vi.mock('./services/usuariosService', () => ({
  usuariosService: {
    getUsuarios: mocks.getUsuarios,
    saveUsuario: mocks.saveUsuario,
  },
}));

vi.mock('./services/usuarioInvitationsService', () => ({
  usuarioInvitationsService: { list: mocks.listInvitations, resend: mocks.resendInvitation },
}));

vi.mock('../perfis/services/perfisService', () => ({
  perfisService: {
    listPerfis: vi.fn().mockResolvedValue([{
      id: 'perfil-admin',
      codigo: 'administrador',
      nome: 'Administrador',
      descricao: 'Gestão do escritório',
      permissoes: ['usuarios:manage'],
    }]),
  },
}));

describe('cadastro de usuário por convite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUsuarios.mockResolvedValue([]);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const pendingUser = {
    id: 'usuario-pendente', authUserId: 'auth-pendente', nome: 'Maria da Silva',
    email: 'maria@example.com', cpf: '52998224725', telefone: '79999999999',
    formaAcesso: 'email', perfil: 'Administrador', status: 'Pendente', mustChangePassword: true,
    accessConfig: { enabled: false, days: [], intervals: [], message: '' },
  };
  const invitation = {
    usuario_id: 'usuario-pendente', invited_at: null,
    confirmation_sent_at: null, email_confirmed_at: null,
  };

  it('envia apenas por clique, impede duplicação durante envio e atualiza o status confirmado', async () => {
    mocks.getUsuarios.mockResolvedValue([pendingUser]);
    mocks.listInvitations.mockResolvedValueOnce([invitation]).mockResolvedValue([{
      ...invitation, invited_at: '2026-09-08T14:00:00Z',
    }]);
    let confirmSend!: () => void;
    mocks.resendInvitation.mockImplementation(() => new Promise<void>((resolve) => { confirmSend = resolve; }));
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    expect(await screen.findByText('Não enviado')).toBeDefined();
    expect(screen.getByText(/primeira senha pelo link do convite/)).toBeDefined();
    expect(mocks.resendInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() => expect(mocks.resendInvitation).toHaveBeenCalledWith('usuario-pendente', expect.anything()));
    const sendingButton = await screen.findByRole('button', { name: 'Enviando convite...' });
    expect((sendingButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(sendingButton);
    expect(mocks.resendInvitation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Editar Usuário')).toBeNull();

    confirmSend();
    expect((await screen.findByRole('status')).textContent).toBe('Convite enviado para maria@example.com.');
    expect(await screen.findByText(/^Enviado em /)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reenviar convite' })).toBeDefined();
    expect(mocks.listInvitations).toHaveBeenCalledTimes(2);
    expect(mocks.getUsuarios).toHaveBeenCalledTimes(2);
  });

  it('mostra falha de envio sem sucesso falso e mantém os dados do usuário', async () => {
    mocks.getUsuarios.mockResolvedValue([pendingUser]);
    mocks.listInvitations.mockResolvedValue([invitation]);
    mocks.resendInvitation.mockRejectedValue(new Error('O envio do convite está indisponível.'));
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    await screen.findByText('Não enviado');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect((await screen.findByRole('alert')).textContent).toBe('O envio do convite está indisponível.');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Não enviado')).toBeDefined();
    expect(screen.getByText('Maria da Silva')).toBeDefined();
    expect(mocks.listInvitations).toHaveBeenCalledTimes(2);
    expect(mocks.resendInvitation).toHaveBeenCalledTimes(1);
  });

  it('consulta o status mesmo se perder a resposta do envio para não manter Não enviado incorretamente', async () => {
    mocks.getUsuarios.mockResolvedValue([pendingUser]);
    mocks.listInvitations.mockResolvedValueOnce([invitation]).mockResolvedValue([{
      ...invitation, invited_at: '2026-09-08T14:00:00Z',
    }]);
    mocks.resendInvitation.mockRejectedValue(new Error('Não foi possível confirmar a resposta do envio.'));
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    await screen.findByText('Não enviado');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(await screen.findByText(/^Enviado em /)).toBeDefined();
    expect(screen.queryByText('Não enviado')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(mocks.resendInvitation).toHaveBeenCalledTimes(1);
    expect(mocks.listInvitations).toHaveBeenCalledTimes(2);
  });

  it('falha na consulta não bloqueia a lista nem afirma que o convite não foi enviado', async () => {
    mocks.getUsuarios.mockResolvedValue([pendingUser]);
    mocks.listInvitations.mockRejectedValue(new Error('Consulta indisponível'));
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    expect(await screen.findByText('Status do convite indisponível')).toBeDefined();
    expect(screen.getByText('Maria da Silva')).toBeDefined();
    expect(screen.queryByText('Não enviado')).toBeNull();
    expect((screen.getByRole('button', { name: 'Enviar convite' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.listInvitations).toHaveBeenCalledTimes(1);
    expect(mocks.resendInvitation).not.toHaveBeenCalled();
  });

  it('não permite reenviar quando o convite já foi aceito e a senha está pendente', async () => {
    mocks.getUsuarios.mockResolvedValue([pendingUser]);
    mocks.listInvitations.mockResolvedValue([{
      ...invitation, invited_at: '2026-09-08T14:00:00Z', email_confirmed_at: '2026-09-08T14:05:00Z',
    }]);
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    expect(await screen.findByText('Convite aceito, senha pendente')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Reenviar convite' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.resendInvitation).not.toHaveBeenCalled();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('mantém o motivo da recusa junto das ações ao salvar com o formulário rolado', async () => {
    const message = 'Você não tem permissão para gerenciar usuários.';
    mocks.saveUsuario.mockRejectedValue(new Error(message));
    render(<QueryClientProvider client={queryClient}><UsuariosConfig /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: /Novo Usuário/ }));
    fireEvent.click(screen.getByRole('button', { name: /E-mail Envia convite/ }));
    fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '79999999999' } });
    fireEvent.change(screen.getByLabelText('Perfil de Acesso'), { target: { value: 'perfil-admin' } });

    const form = screen.getByRole('button', { name: 'Salvar Usuário' }).closest('form')!;
    const scrollContainer = form.querySelector('.usuario-modal-content-scroll')!;
    scrollContainer.scrollTop = 600;
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);
    // O alerta permanece fora da área rolável, ao lado das ações fixas do formulário.
    expect(scrollContainer.contains(alert)).toBe(false);
    expect(form.contains(alert)).toBe(true);
    expect(scrollContainer.scrollTop).toBe(600);
    expect((screen.getByLabelText('Nome Completo') as HTMLInputElement).value).toBe('Maria da Silva');
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('maria@example.com');
    expect(screen.getByText('Cadastrar Usuário')).toBeDefined();
    expect(screen.queryByText(/Convite enviado para/)).toBeNull();
    expect(mocks.saveUsuario).toHaveBeenCalledTimes(1);
    expect(mocks.saveUsuario.mock.calls[0][0]).toMatchObject({
      formaAcesso: 'email', perfilId: 'perfil-admin', status: 'Pendente',
    });

    fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Maria Silva' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.saveUsuario).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
