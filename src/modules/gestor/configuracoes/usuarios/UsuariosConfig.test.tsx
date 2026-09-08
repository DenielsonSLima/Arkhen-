/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsuariosConfig } from './UsuariosConfig';

const mocks = vi.hoisted(() => ({ saveUsuario: vi.fn() }));

vi.mock('./services/usuariosService', () => ({
  usuariosService: {
    getUsuarios: vi.fn().mockResolvedValue([]),
    saveUsuario: mocks.saveUsuario,
  },
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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
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
