/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({ value: null as any }));

vi.mock('../../../../hooks/useInternalTabs', () => ({
  useInternalTabs: () => ({ openTab: vi.fn() }),
}));

vi.mock('../../protocolos/hooks/useEmpresaProtocolosConfiguracao', () => ({
  useEmpresaProtocolosConfiguracao: () => hookMock.value,
}));

import { TabProtocolosEntregas } from './TabProtocolosEntregas';
import { ProtocolosError } from '../../protocolos/services/protocolosError';

const company = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Cliente Novo',
  tipo: 'Simples Nacional',
} as any;

const catalogo = [{
  id: 'dctfweb',
  nome: 'DCTFWeb',
  categoria: 'Fiscal',
  orgao: 'Receita Federal',
  diaLimite: 25,
  descricao: 'Obrigação fiscal',
  status: 'Ativo',
  regimes: ['Simples Nacional'],
  periodicidadePadrao: 'mensal',
  origemPadrao: 'Ambos',
}];

const initialConfigs = [{ entregaId: 'dctfweb', ativo: false, periodicidade: 'mensal' }];
const canonicalConfigs = [{ entregaId: 'dctfweb', ativo: true, periodicidade: 'trimestral' }];
const initialUpdatedAt = '2026-08-31T20:00:00.000Z';
const canonicalUpdatedAt = '2026-08-31T20:01:00.000Z';

afterEach(cleanup);

describe('TabProtocolosEntregas', () => {
  beforeEach(() => {
    hookMock.value = {
      data: { catalogo, configs: initialConfigs, updatedAt: initialUpdatedAt },
      error: null,
      isLoading: false,
      isSaving: false,
      saveError: null,
      refetch: vi.fn(),
      saveConfiguracao: vi.fn().mockResolvedValue({
        catalogo,
        configs: canonicalConfigs,
        updatedAt: canonicalUpdatedAt,
      }),
      resetSaveError: vi.fn(),
    };
  });

  it('edita o envelope carregado e adota a configuração canônica retornada ao salvar', async () => {
    render(<TabProtocolosEntregas company={company} />);

    const checkbox = await screen.findByRole('checkbox', { name: /dctfweb/i }) as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quinzenal' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar entregas/i }));

    await waitFor(() => {
      expect(hookMock.value.saveConfiguracao).toHaveBeenCalledWith(
        [expect.objectContaining({ entregaId: 'dctfweb', ativo: true, periodicidade: 'quinzenal' })],
        initialUpdatedAt,
      );
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('trimestral');
    });
    expect(screen.getByRole('status').textContent).toContain('Entregas sincronizadas');
  });

  it('exibe falha de carregamento sem fallback local e permite tentar novamente', () => {
    hookMock.value = {
      ...hookMock.value,
      data: undefined,
      error: new Error('Configuração indisponível.'),
    };

    render(<TabProtocolosEntregas company={company} />);

    expect(screen.getByRole('alert').textContent).toContain('Configuração indisponível.');
    expect(screen.queryByText('DCTFWeb')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(hookMock.value.refetch).toHaveBeenCalledOnce();
  });

  it('recarrega a versão canônica depois de um conflito de gravação', async () => {
    hookMock.value.saveConfiguracao = vi.fn().mockRejectedValue(
      new ProtocolosError('conflict', 'Configuração alterada por outro usuário.'),
    );
    hookMock.value.refetch = vi.fn().mockResolvedValue({
      data: { catalogo, configs: canonicalConfigs, updatedAt: canonicalUpdatedAt },
      error: null,
    });

    render(<TabProtocolosEntregas company={company} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /dctfweb/i }));
    fireEvent.click(screen.getByRole('button', { name: /salvar entregas/i }));
    fireEvent.click(await screen.findByRole('button', { name: /recarregar configuração/i }));

    await waitFor(() => {
      expect(hookMock.value.refetch).toHaveBeenCalledOnce();
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('trimestral');
    });
  });
});
