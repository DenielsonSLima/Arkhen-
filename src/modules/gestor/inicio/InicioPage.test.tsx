/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inicio: {
    stats: { clientesAtivos: 3 },
    summary: {
      dataReferencia: '2026-08-26',
      tarefas: {
        total: 0,
        done: 0,
        pct: 0,
        pendentesTotal: 0,
        pendentes: [],
        atividadesHoje: [],
        atividadesHojeTotal: 0,
        atrasadas: 0,
        vencemHoje: 0,
      },
      agenda: { total: 0, hojeTotal: 0, hoje: [], semana: [] },
      alertas: { total: 0, vencidos: 0, vencemHoje: 0, itens: [], criticos: [] },
      operacao: { pendenciasTotal: 0, atrasosTotal: 0, vencemHojeTotal: 0 },
      usuarios: [],
    },
    isLoading: false,
    dashboardError: false,
    retryDashboard: vi.fn(),
  },
  bootstrap: {
    fraseMotivacional: {
      autor: 'Equipe Arkhen',
      texto: 'Organize hoje para crescer amanhã.',
    },
  },
}));

vi.mock('../../../hooks/useInternalTabs', () => ({
  useInternalTabs: () => ({ activateModule: vi.fn() }),
}));

vi.mock('./hooks/useInicio', () => ({
  useInicio: () => mocks.inicio,
}));

vi.mock('./hooks/useInicioBootstrap', () => ({
  useInicioBootstrap: () => mocks.bootstrap,
}));

vi.mock('./hooks/useInicioSetup', () => ({
  useInicioSetup: () => ({
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./hooks/useInicioRealtime', () => ({
  useInicioRealtime: vi.fn(),
}));

import { InicioPage } from './InicioPage';

describe('InicioPage', () => {
  afterEach(() => {
    cleanup();
    mocks.inicio.dashboardError = false;
    vi.clearAllMocks();
  });

  it('identifica a contagem real do dashboard como clientes ativos', () => {
    render(<InicioPage />);

    expect(screen.getByText('3 clientes ativos')).toBeTruthy();
    expect(screen.queryByText(/empresas no radar/i)).toBeNull();
  });

  it('expõe falhas operacionais e permite tentar o carregamento novamente', () => {
    mocks.inicio.dashboardError = true;

    render(<InicioPage />);

    expect(screen.getByRole('alert').textContent).toContain('resumo operacional');
    expect(screen.getByText('Não foi possível carregar as atividades.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.inicio.retryDashboard).toHaveBeenCalledTimes(1);
  });
});
