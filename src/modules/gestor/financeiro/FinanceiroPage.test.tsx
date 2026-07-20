/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const financeiroHookMock = vi.hoisted(() => vi.fn());

vi.mock('./hooks/useFinanceiroRealtime', () => ({
  useFinanceiroRealtime: vi.fn(),
}));

vi.mock('./hooks/useFinanceiro', () => ({
  useFinanceiro: financeiroHookMock,
}));

import { FinanceiroPage } from './FinanceiroPage';

describe('FinanceiroPage internal tabs', () => {
  beforeEach(() => {
    financeiroHookMock.mockReset();
    financeiroHookMock.mockReturnValue({
      filteredCobranças: [],
      stats: {},
      companyMap: new Map(),
      isLoading: true,
      loadError: null,
      successMsg: null,
      errorMsg: null,
      retryLoad: vi.fn(),
      lancamentos: [],
      contasPagar: [],
      handleCreateLancamento: vi.fn(),
      handleTransferirEntreContas: vi.fn(),
      handleCriarContasPagarParceladas: vi.fn(),
      showManualSettlementModal: false,
      setShowManualSettlementModal: vi.fn(),
      settlementCobranca: null,
      setSettlementCobranca: vi.fn(),
      handleBaixarManualCobrancaCustom: vi.fn(),
      isCustomSettlementLoading: false,
    });
  });

  it.each([
    ['receber', 'receber'],
    ['pagar', 'pagar'],
    ['transferencias', 'lancamentos'],
    ['creditos', 'lancamentos'],
    [undefined, 'caixa'],
  ] as const)('opens %s directly without first mounting the caixa query', (initialTab, expectedView) => {
    render(<FinanceiroPage initialTab={initialTab} />);

    expect(financeiroHookMock.mock.calls[0]?.[0]).toBe(expectedView);
    expect(financeiroHookMock.mock.calls.some(([view]) => view !== expectedView)).toBe(false);
  });

  it('renders mutation feedback with accessible live roles', () => {
    const state = financeiroHookMock();
    financeiroHookMock.mockReturnValue({
      ...state,
      filteredCobranças: [],
      stats: {},
      companyMap: new Map(),
      isLoading: true,
      successMsg: 'Operação concluída.',
      errorMsg: 'Operação não concluída.',
    });

    render(<FinanceiroPage />);

    expect(screen.getByRole('status').textContent).toBe('Operação concluída.');
    expect(screen.getByRole('alert').textContent).toBe('Operação não concluída.');
  });
});
