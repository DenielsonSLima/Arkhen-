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
  temVencimento: false,
  etapas: ['Conferir dados', 'Transmitir obrigação'],
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
    expect(screen.getByText('Mensal · sem vencimento fixo')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByLabelText('Rotina de DCTFWeb').textContent).toBe('Mensal');
    expect(screen.getByText('2 etapas')).toBeTruthy();
    expect(screen.getByText(/Etapas: Conferir dados.*Transmitir obrigação/)).toBeTruthy();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /salvar entregas/i }));

    await waitFor(() => {
      expect(hookMock.value.saveConfiguracao).toHaveBeenCalledWith(
        [expect.objectContaining({ entregaId: 'dctfweb', ativo: true, periodicidade: 'mensal' })],
        initialUpdatedAt,
      );
      expect(screen.getByLabelText('Rotina de DCTFWeb').textContent).toBe('Mensal');
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
      expect(screen.getByLabelText('Rotina de DCTFWeb').textContent).toBe('Mensal');
    });
  });

  it('reconcilia cards novos e removidos sem perder a edição local', async () => {
    const view = render(<TabProtocolosEntregas company={company} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /dctfweb/i }));

    const novaObrigacao = {
      ...catalogo[0],
      id: 'sped-fiscal',
      nome: 'SPED Fiscal',
    };
    hookMock.value = {
      ...hookMock.value,
      data: {
        catalogo: [...catalogo, novaObrigacao],
        configs: [
          ...initialConfigs,
          { entregaId: 'sped-fiscal', ativo: false, periodicidade: 'mensal' },
        ],
        updatedAt: initialUpdatedAt,
      },
    };
    view.rerender(<TabProtocolosEntregas company={company} />);

    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: /dctfweb/i }) as HTMLInputElement).checked).toBe(true);
      expect(screen.getByRole('checkbox', { name: /sped fiscal/i })).toBeTruthy();
    });

    hookMock.value = {
      ...hookMock.value,
      data: {
        catalogo: [novaObrigacao],
        configs: [{ entregaId: 'sped-fiscal', ativo: false, periodicidade: 'mensal' }],
        updatedAt: initialUpdatedAt,
      },
    };
    view.rerender(<TabProtocolosEntregas company={company} />);

    await waitFor(() => expect(screen.queryByText('DCTFWeb')).toBeNull());
  });
});
