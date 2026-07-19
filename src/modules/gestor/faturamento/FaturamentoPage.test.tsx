/** @vitest-environment jsdom */

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InternalTabContext } from '../../../stores/internalTabsStore';

vi.mock('./hooks/useFaturamentoRealtime', () => ({
  useFaturamentoRealtime: vi.fn(),
}));

vi.mock('./components/DashboardMesTab', () => ({ DashboardMesTab: () => <div>dashboard-content</div> }));
vi.mock('./components/RecorrenciasTab', () => ({ RecorrenciasTab: () => <div>recorrencias-content</div> }));
vi.mock('./components/HistoricoNfseTab', () => ({ HistoricoNfseTab: () => <div>nfse-content</div> }));
vi.mock('./components/InadimplenciaTab', () => ({ InadimplenciaTab: () => <div>inadimplencia-content</div> }));
vi.mock('./components/HistoricoFinanceiroTab', () => ({ HistoricoFinanceiroTab: () => <div>financeiro-content</div> }));
vi.mock('./components/ConfiguracoesTab', () => ({ ConfiguracoesTab: () => <div>configuracoes-content</div> }));
vi.mock('./components/ModalNovoLancamentoAvulso', () => ({ ModalNovoLancamentoAvulso: () => null }));

import { FaturamentoPage } from './FaturamentoPage';

describe('FaturamentoPage em aba interna', () => {
  it('não publica o mesmo contexto novamente quando o pai recria a callback', async () => {
    const contexts: InternalTabContext[] = [];

    const Host = () => {
      const [contextUpdates, setContextUpdates] = useState(0);
      const [unrelatedRenders, setUnrelatedRenders] = useState(0);
      const onViewContextChange = (context: InternalTabContext) => {
        contexts.push(context);
        setContextUpdates((value) => value + 1);
      };

      return (
        <>
          <output data-testid="context-updates">{contextUpdates}</output>
          <output data-testid="unrelated-renders">{unrelatedRenders}</output>
          <button onClick={() => setUnrelatedRenders((value) => value + 1)}>renderizar pai</button>
          <FaturamentoPage onViewContextChange={onViewContextChange} />
        </>
      );
    };

    render(<Host />);

    await waitFor(() => expect(screen.getByTestId('context-updates').textContent).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: 'renderizar pai' }));

    await waitFor(() => expect(screen.getByTestId('unrelated-renders').textContent).toBe('1'));
    expect(screen.getByTestId('context-updates').textContent).toBe('1');
    expect(contexts).toEqual([{ data: { activeTab: 'dashboard' } }]);

    fireEvent.click(screen.getByRole('button', { name: /Recorrências/i }));
    await waitFor(() => expect(screen.getByTestId('context-updates').textContent).toBe('2'));
    expect(contexts.at(-1)).toEqual({ data: { activeTab: 'recorrencias' } });
  });
});
