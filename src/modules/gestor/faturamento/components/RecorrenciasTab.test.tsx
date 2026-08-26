/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../queries/useFaturamentoQueries', () => ({
  useFaturamentoRecorrenciasQuery: () => ({
    data: [{
      id: 'contrato-real',
      cliente: 'Cliente Real',
      servico: 'Honorários contábeis',
      valor: 500,
      dia: '10',
      status: 'Ativo',
      emissaoNfse: true,
      cobranca: true,
      situacao: 'em_dia',
      historico: [],
    }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./ModalNovaRecorrencia', () => ({
  ModalNovaRecorrencia: () => null,
}));

import { RecorrenciasTab } from './RecorrenciasTab';

describe('RecorrenciasTab', () => {
  afterEach(cleanup);

  it('não promete automação e esclarece o fluxo manual na lista e no detalhe', () => {
    render(<RecorrenciasTab />);

    expect(screen.getByText('Contratos e modelos mensais')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('não geram cobranças nem NFS-e automaticamente');
    expect(screen.getByText('Referência: dia 10')).toBeTruthy();
    expect(screen.getByText('Cob. manual')).toBeTruthy();

    fireEvent.click(screen.getByText('Cliente Real'));
    expect(screen.getByRole('note').textContent).toContain('próximas competências não são geradas automaticamente');

    fireEvent.click(screen.getByRole('button', { name: 'Modelo mensal' }));
    expect(screen.getByText(/cada emissão depende de uma cobrança criada manualmente/i)).toBeTruthy();
    expect(screen.getByText(/cada cobrança futura deve ser criada manualmente/i)).toBeTruthy();
    expect(screen.queryByText(/Gerar Cobrança Automaticamente/i)).toBeNull();
    expect(screen.queryByText(/Emitir NFS-e Automaticamente/i)).toBeNull();
  });
});
