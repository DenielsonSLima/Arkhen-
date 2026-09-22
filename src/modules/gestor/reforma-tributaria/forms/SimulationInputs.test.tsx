/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ ibs: vi.fn(), split: vi.fn() }));
vi.mock('../services/reformaTributariaService', () => ({
  reformaTributariaService: { simulateIbsCbs: mocks.ibs, simulateSplitPayment: mocks.split },
}));
import { SimulacaoIbsCbsForm } from './SimulacaoIbsCbsForm';
import { SplitPaymentForm } from './SplitPaymentForm';

const result = { id: 'simulacao', versaoRegra: '1', resultado: { aviso: 'Resultado das premissas anteriores' } };
const cases = [
  { name: 'IBS/CBS', Form: SimulacaoIbsCbsForm, mock: mocks.ibs, field: 'Receita mensal (R$)', button: 'Gerar cenário' },
  { name: 'split', Form: SplitPaymentForm, mock: mocks.split, field: 'Receitas via Pix (R$)', button: 'Projetar impacto no caixa' },
];

describe.each(cases)('simulação $name', ({ Form, mock, field, button }) => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);
  const mount = () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Form clienteId="cliente-a" /></QueryClientProvider>);
    return client;
  };

  it('retira o resultado quando as premissas são editadas', async () => {
    mock.mockResolvedValue(result);
    mount();
    fireEvent.submit(screen.getByRole('button', { name: button }).closest('form')!);
    expect(await screen.findByText(result.resultado.aviso)).toBeDefined();
    fireEvent.change(screen.getByLabelText(field), { target: { value: '500000' } });
    expect(screen.queryByText(result.resultado.aviso)).toBeNull();
  });

  it('não restaura o resultado antigo se as premissas mudam durante a consulta', async () => {
    let resolve!: (value: typeof result) => void;
    mock.mockReturnValue(new Promise((done) => { resolve = done; }));
    const client = mount();
    fireEvent.submit(screen.getByRole('button', { name: button }).closest('form')!);
    await waitFor(() => expect(mock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(field), { target: { value: '500000' } });
    await act(async () => resolve(result));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(screen.queryByText(result.resultado.aviso)).toBeNull();
  });
});
