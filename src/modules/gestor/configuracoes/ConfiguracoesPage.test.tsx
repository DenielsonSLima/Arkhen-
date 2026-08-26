/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfiguracoesPage } from './ConfiguracoesPage';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('./meu-perfil/MeuPerfilConfig', () => ({
  MeuPerfilConfig: () => <div data-testid="meu-perfil">Meu perfil</div>,
}));

vi.mock('./marca-dagua/MarcaDaguaConfig', () => ({
  MarcaDaguaConfig: () => <div data-testid="marca-dagua">Marca d'água</div>,
}));

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConfiguracoesPage />
    </QueryClientProvider>,
  );
};

describe('ConfiguracoesPage initial subtab', () => {
  beforeEach(() => {
    sessionStorage.clear();
    rpcMock.mockReset();
    sessionStorage.setItem('contabil_config_initial_subtab', 'marca-dagua');
  });

  it('não troca para Meu Perfil enquanto as permissões ainda carregam', () => {
    rpcMock.mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(screen.getByRole('status').textContent).toContain('Validando seu acesso');
    expect(screen.queryByTestId('meu-perfil')).toBeNull();
  });

  it('abre diretamente a configuração solicitada após validar o acesso', async () => {
    rpcMock.mockResolvedValue({ data: ['*'], error: null });

    renderPage();

    expect(await screen.findByTestId('marca-dagua')).not.toBeNull();
    expect(screen.queryByTestId('meu-perfil')).toBeNull();
  });

  it('consome o destino persistido quando a guia já está montada', async () => {
    rpcMock.mockResolvedValue({ data: ['*'], error: null });
    renderPage();
    await screen.findByTestId('marca-dagua');
    sessionStorage.setItem('contabil_config_initial_subtab', 'marca-dagua');

    act(() => {
      window.dispatchEvent(new CustomEvent('open_config_subtab', {
        detail: { subTab: 'marca-dagua' },
      }));
    });

    expect(sessionStorage.getItem('contabil_config_initial_subtab')).toBeNull();
  });

  it('organiza as opções por objetivo e não oferece status simulado de APIs', async () => {
    sessionStorage.clear();
    rpcMock.mockResolvedValue({ data: ['*'], error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Comece por aqui' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Acessos e governança' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Integrações e ferramentas' })).toBeTruthy();
    expect(screen.queryByText('Status das APIs')).toBeNull();
  });

  it('não oferece gestão administrativa para membro com permissão nominal', async () => {
    sessionStorage.clear();
    rpcMock.mockImplementation((functionName: string) => Promise.resolve(
      functionName === 'current_user_permissions'
        ? { data: ['usuarios:manage', 'perfis:manage'], error: null }
        : { data: false, error: null },
    ));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Comece por aqui' })).toBeTruthy();
    expect(screen.queryByText('Equipe e Usuários')).toBeNull();
    expect(screen.queryByText('Perfis de Acesso')).toBeNull();
    expect(screen.queryByText('Permissões do Sistema')).toBeNull();
  });

  it('expõe a falha de permissões e permite tentar novamente', async () => {
    sessionStorage.clear();
    rpcMock.mockResolvedValue({ data: null, error: new Error('indisponível') });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível carregar seus acessos');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
