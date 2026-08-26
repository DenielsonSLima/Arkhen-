/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  retry: vi.fn(),
  hook: {
    companyGroups: [],
    counters: { pendentes: 0, concluidos: 0, todos: 0, ativos: 0, inativos: 0 },
    isLoading: false,
    errorMessage: 'Falha ao consultar get_protocolos_operacionais',
    activeTab: 'pendentes' as const,
    setActiveTab: vi.fn(),
    activeEmpresaTab: 'ativas' as const,
    setActiveEmpresaTab: vi.fn(),
    searchTerm: '',
    setSearchTerm: vi.fn(),
    dataInicial: '',
    setDataInicial: vi.fn(),
    dataFinal: '',
    setDataFinal: vi.fn(),
    protocolos: [],
    updateProtocolo: vi.fn(),
  },
}));

vi.mock('./hooks/useProtocolos', () => ({
  useProtocolos: () => ({ ...mocks.hook, retry: mocks.retry }),
}));

vi.mock('./hooks/useProtocolosRealtime', () => ({
  useProtocolosRealtime: vi.fn(),
}));

import { ProtocolosPage } from './ProtocolosPage';

describe('ProtocolosPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('não apresenta falha operacional como lista vazia e permite repetir a consulta', () => {
    render(<ProtocolosPage />);

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar os protocolos');
    expect(screen.getByText('Falha ao consultar get_protocolos_operacionais')).toBeTruthy();
    expect(screen.queryByText('Nenhum protocolo configurado')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });
});
