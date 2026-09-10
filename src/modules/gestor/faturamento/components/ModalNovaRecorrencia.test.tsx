/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), charge: vi.fn(), companies: vi.fn() }));
vi.mock('../queries/useRecorrenciaQueries', () => ({ useRecorrenciaMutations: () => ({ save: { mutateAsync: mocks.save }, run: { mutateAsync: mocks.charge } }) }));
vi.mock('../queries/useFaturamentoFiscalQueries', () => ({ useFiscalBillingTenant: () => ({ data: 'tenant' }), useFiscalEmitters: () => ({ data: [] }) }));
vi.mock('../../gestao-empresarial/services/gestaoEmpresarialService', () => ({
  gestaoEmpresarialService: { getCompanies: mocks.companies },
}));
import { ModalNovaRecorrencia } from './ModalNovaRecorrencia';

function mount(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (open: boolean) => <QueryClientProvider client={client}><ModalNovaRecorrencia isOpen={open} onClose={onClose} /></QueryClientProvider>;
  const result = render(ui(true));
  return { ...result, onClose, toggle: (open: boolean) => result.rerender(ui(open)) };
}
async function fill() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Parceiro / cliente' }), { target: { value: 'Parceiro A' } });
  fireEvent.click(await screen.findByRole('option', { name: /Parceiro A/ }));
  fireEvent.change(screen.getByLabelText('Valor mensal'), { target: { value: '40500' } });
  fireEvent.change(screen.getByLabelText('Dia de vencimento'), { target: { value: '10' } });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.companies.mockResolvedValue([{ id: 'client-a', nome: 'Parceiro A', cnpj: '11111111111111' }]);
  mocks.save.mockResolvedValue({ contrato: { id: 'contract-one' }, execucao: { id: 'execution-one' } });
  mocks.charge.mockResolvedValue({ id: 'charge-one' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Primeira cobrança de recorrência', () => {
  it('retoma resposta incerta com mesmo contrato e payload, mesmo após fechar e reabrir', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 10, 11));
    mocks.charge.mockRejectedValueOnce(new Error('Retorno incerto do Inter'));
    const page = mount();
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Recorrência' }));
    await screen.findByRole('button', { name: 'Retomar primeira cobrança' });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect((screen.getByLabelText('Valor mensal').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    const original = mocks.charge.mock.calls[0][0];
    expect(original).toBe('execution-one');
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ valorMensal: 405, recorrenciaAtiva: false });
    vi.setSystemTime(new Date(2026, 8, 11, 11));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    page.toggle(false); page.toggle(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retomar primeira cobrança' }));
    await waitFor(() => expect(mocks.charge).toHaveBeenCalledTimes(2));
    expect(mocks.charge.mock.calls[1][0]).toEqual(original);
    expect(mocks.save).toHaveBeenCalledOnce();
    await waitFor(() => expect(page.onClose).toHaveBeenCalledTimes(2));
  });
  it('trava cliques concorrentes enquanto salva o contrato', async () => {
    let resolveSave!: (value: unknown) => void;
    mocks.save.mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    mount(); await fill();
    const button = screen.getByRole('button', { name: 'Salvar Recorrência' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.save).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Fechar' }) as HTMLButtonElement).disabled).toBe(true);
    resolveSave({ contrato: { id: 'contract-one' }, execucao: { id: 'execution-one' } });
    await waitFor(() => expect(mocks.charge).toHaveBeenCalledOnce());
  });
  it('permite corrigir termos quando o contrato não foi salvo', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Contrato não salvo'));
    mount(); await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Recorrência' }));
    await screen.findByText('Contrato não salvo');
    expect((screen.getByLabelText('Valor mensal').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(false);
    expect(mocks.charge).not.toHaveBeenCalled();
  });
});
