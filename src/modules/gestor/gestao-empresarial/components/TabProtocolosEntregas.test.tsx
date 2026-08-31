/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  value: null as any,
}));

vi.mock('../../../../hooks/useInternalTabs', () => ({
  useInternalTabs: () => ({ openTab: vi.fn() }),
}));

vi.mock('../../protocolos/hooks/useEmpresaProtocolosConfiguracao', () => ({
  useEmpresaProtocolosConfiguracao: () => hookMock.value,
}));

import { TabProtocolosEntregas } from './TabProtocolosEntregas';

const company = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Cliente Real',
  tipo: 'Simples Nacional',
} as any;

const catalogo = [{
  id: 'xml-nfe',
  nome: 'XML de NF-e',
  categoria: 'Fiscal',
  origemPadrao: 'Cliente envia',
  periodicidadePadrao: 'mensal',
  diaLimite: 10,
  status: 'Ativo',
  regimes: ['Simples Nacional'],
}];

const inactiveConfig = [{ entregaId: 'xml-nfe', ativo: false, periodicidade: 'mensal' as const }];
const activeConfig = [{ entregaId: 'xml-nfe', ativo: true, periodicidade: 'quinzenal' as const }];
const submittedConfig = [{ entregaId: 'xml-nfe', ativo: true, periodicidade: 'mensal' as const }];

describe('TabProtocolosEntregas', () => {
  beforeEach(() => {
    hookMock.value = {
      data: { catalogo, configs: inactiveConfig },
      error: null,
      isLoading: false,
      isSaving: false,
      saveError: null,
      saveConfiguracao: vi.fn().mockResolvedValue({ catalogo, configs: activeConfig }),
      resetSaveError: vi.fn(),
    };
  });

  it('preserva alterações locais diante de uma atualização remota e adota a resposta canônica ao salvar', async () => {
    const view = render(<TabProtocolosEntregas company={company} />);
    const checkbox = screen.getByRole('checkbox', { name: /xml de nf-e/i }) as HTMLInputElement;

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    hookMock.value = {
      ...hookMock.value,
      data: { catalogo, configs: inactiveConfig },
    };
    view.rerender(<TabProtocolosEntregas company={company} />);
    expect(checkbox.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /salvar e sincronizar/i }));
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('quinzenal'));
    expect(hookMock.value.saveConfiguracao).toHaveBeenCalledWith(submittedConfig);
    expect(hookMock.value.resetSaveError).toHaveBeenCalledTimes(1);
  });
});
