/** @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getModelos: vi.fn(),
  getClientes: vi.fn(),
  ensureInstancias: vi.fn(),
  getInstancias: vi.fn(),
  getFechamentoMeta: vi.fn(),
}));

vi.mock('../services/atividadesService', () => ({
  atividadesService: serviceMock,
}));

import { useAtividades } from './useAtividades';

describe('useAtividades internal-tab context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getModelos.mockResolvedValue([
      { id: 'modelo-1', codigo: 'modelo-1', nome: 'Rotina fiscal', tipos: [] },
    ]);
    serviceMock.getClientes.mockResolvedValue([
      {
        id: 'cliente-1',
        nome: 'Empresa teste',
        cnpj: '00000000000100',
        regime: 'Simples Nacional',
        tipoEstabelecimento: 'Matriz',
        modelosAtivos: ['modelo-1'],
      },
    ]);
    serviceMock.ensureInstancias.mockResolvedValue(undefined);
    serviceMock.getInstancias.mockResolvedValue([
      {
        id: 'instancia-1',
        clienteId: 'cliente-1',
        modeloId: 'modelo-1',
        competencia: '06/2026',
        status: 'Pendente',
        checklists: { Conferir: false },
      },
    ]);
    serviceMock.getFechamentoMeta.mockResolvedValue({
      finalizado: false,
      dataHora: '',
      usuario: '',
    });
  });

  it('selects the requested company once without a render feedback loop', async () => {
    const { result } = renderHook(() => useAtividades({
      initialCompanyId: 'cliente-1',
      initialCompetencia: '06/2026',
    }));

    await waitFor(() => {
      expect(result.current.selectedGroup?.id).toBe('cliente-1-06-2026');
    });

    expect(serviceMock.getModelos).toHaveBeenCalledTimes(1);
    expect(serviceMock.getClientes).toHaveBeenCalledTimes(1);
    expect(serviceMock.getFechamentoMeta).toHaveBeenCalledTimes(1);
  });
});
