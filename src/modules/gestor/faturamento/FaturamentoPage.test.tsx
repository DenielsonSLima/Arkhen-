/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternalTabContext } from '../../../stores/internalTabsStore';

vi.mock('./hooks/useFaturamentoRealtime', () => ({
  useFaturamentoRealtime: vi.fn(),
}));

vi.mock('./components/NationalReviewsTab', () => ({ NationalReviewsTab: () => <div>national-reviews-content</div> }));
vi.mock('./components/DashboardMesTab', () => ({ DashboardMesTab: () => <div>dashboard-content</div> }));
vi.mock('./components/RecorrenciasTab', () => ({ RecorrenciasTab: () => <div>recorrencias-content</div> }));
vi.mock('./components/HistoricoNfseTab', () => ({ HistoricoNfseTab: () => <div>nfse-content</div> }));
vi.mock('./components/InadimplenciaTab', () => ({ InadimplenciaTab: () => <div>inadimplencia-content</div> }));
vi.mock('./components/HistoricoFinanceiroTab', () => ({ HistoricoFinanceiroTab: () => <div>financeiro-content</div> }));
vi.mock('./components/ModelosTab', () => ({ ModelosTab: ({ onOpenSettings }: { onOpenSettings: () => void }) => <button onClick={onOpenSettings}>Configurar padrões do modelo</button> }));
vi.mock('./components/ConfiguracoesTab', () => ({ ConfiguracoesTab: () => <div>configuracoes-content</div> }));
vi.mock('./components/ModalNovoLancamentoAvulso', () => ({ ModalNovoLancamentoAvulso: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => isOpen ? <div role="dialog"><button onClick={onClose}>Fechar lançamento</button></div> : null }));

import { FaturamentoPage } from './FaturamentoPage';

afterEach(cleanup);

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


describe('Faturamento compacto', () => {
  it('mantém lançamento na barra das abas e remove descrição redundante', () => {
    render(<FaturamentoPage />);
    const nav = screen.getByRole('navigation', { name: 'Seções de faturamento' });
    expect(within(nav.parentElement!).getByRole('button', { name: /Novo Lançamento/ })).toBeTruthy();
    expect(screen.queryByText('Gestão de notas fiscais, contratos e inadimplência')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Novo Lançamento/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar lançamento' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Novo Lançamento/ }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('abre Modelos e mantém o contexto de navegação', async () => {
    const onChange = vi.fn();
    render(<FaturamentoPage onViewContextChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modelos' }));
    expect(screen.getByRole('button', { name: 'Modelos' }).getAttribute('aria-current')).toBe('page');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ data: { activeTab: 'modelos' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar padrões do modelo' }));
    expect(screen.getByText('configuracoes-content')).toBeTruthy();
  });

  it('restaura a aba Modelos sem acionar emissão ou lançamento', () => {
    render(<FaturamentoPage initialActiveTab="modelos" />);
    expect(screen.getByRole('button', { name: 'Configurar padrões do modelo' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
