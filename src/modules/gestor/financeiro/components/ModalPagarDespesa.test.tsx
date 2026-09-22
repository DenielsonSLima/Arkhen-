/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModalPagarDespesa } from './ModalPagarDespesa';
import type { LancamentoFinanceiro } from '../services/financeiroService';
import type { ContaBancaria } from '../../configuracoes/contas-bancarias/services/contasBancariasService';
const preview=vi.hoisted(()=>vi.fn());
vi.mock('../services/contasPagarService',()=>({contasPagarService:{preverPagamento:preview}}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const expense={id:'expense',descricao:'Aluguel',valor:100,dataCompetencia:'2026-09-01'} as LancamentoFinanceiro;
const accounts=[{id:'bank',banco:'A',agencia:'1',numeroConta:'2',saldoAtual:1000}] as ContaBancaria[];
function setup(){const submit=vi.fn().mockResolvedValue(undefined);render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ModalPagarDespesa isOpen despesa={expense} contasBancarias={accounts} onClose={vi.fn()} onSubmit={submit}/></QueryClientProvider>);return submit;}
it('uses the server preview after interest changes and submits its value',async()=>{
  preview.mockImplementation(async(_id,_discount,interest)=>interest===10?110:100);
  const submit=setup();
  await waitFor(()=>expect(preview).toHaveBeenCalledWith('expense',0,0,expect.any(AbortSignal)));
  const interest=screen.getByText('Juros / Multa (R$)').parentElement?.querySelector('input');
  expect(interest).toBeTruthy();fireEvent.change(interest!,{target:{value:'1000'}});
  await waitFor(()=>expect(screen.getByDisplayValue('110,00')).toBeTruthy());
  fireEvent.submit(document.querySelector('form')!);
  await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({valorPago:110,juros:10,desconto:0})));
});
it('keeps payment blocked when the server rejects adjustments',async()=>{
  preview.mockRejectedValue(new Error('Desconto inválido.'));
  const submit=setup();
  await screen.findByText('Desconto inválido.');
  fireEvent.submit(document.querySelector('form')!);
  expect(submit).not.toHaveBeenCalled();
});
