/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../hooks/useInternalTabs', () => ({
  useInternalTabs: () => ({ activateModule: vi.fn() }),
}));

vi.mock('./hooks/useInicio', () => ({
  useInicio: () => ({
    stats: { clientesAtivos: 3 },
    vencimentosProximos: [],
    isLoading: false,
  }),
}));

vi.mock('./hooks/useInicioBootstrap', () => ({
  useInicioBootstrap: () => ({
    tarefasWorkspace: [],
    eventosAgenda: [],
    fraseMotivacional: {
      autor: 'Equipe Arkhen',
      texto: 'Organize hoje para crescer amanhã.',
    },
  }),
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
  afterEach(cleanup);

  it('identifica a contagem real do dashboard como clientes ativos', () => {
    render(<InicioPage />);

    expect(screen.getByText('3 clientes ativos')).toBeTruthy();
    expect(screen.queryByText(/empresas no radar/i)).toBeNull();
  });
});
