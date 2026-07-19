import { describe, expect, it } from 'vitest';
import { resolveFinanceiroInitialTab } from './gestorModuleContext';

describe('resolveFinanceiroInitialTab', () => {
  it('derives a finance subtab from the module instance instead of the globally active module', () => {
    expect(resolveFinanceiroInitialTab('financeiro-pagar')).toBe('pagar');
    expect(resolveFinanceiroInitialTab('financeiro-receber')).toBe('receber');
    expect(resolveFinanceiroInitialTab('financeiro', { data: { activeTab: 'lancamentos-creditos' } }))
      .toBe('lancamentos-creditos');
  });
});
