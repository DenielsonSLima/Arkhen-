/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveContrato: vi.fn(),
  createCobranca: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [{
      id: 'cliente-real',
      nome: 'Cliente Real',
      razaoSocial: 'Cliente Real Ltda.',
      cnpj: '12345678000190',
      tipo: 'Simples Nacional',
      tipoEstabelecimento: 'Matriz',
    }],
    isLoading: false,
  }),
}));

vi.mock('../../financeiro/queries/useFinanceiroQueries', () => ({
  useSaveContratoFinanceiroMutation: () => ({
    mutateAsync: mocks.saveContrato,
    isPending: false,
  }),
  useCreateCobrancaFinanceiraMutation: () => ({
    mutateAsync: mocks.createCobranca,
    isPending: false,
  }),
}));

import { ModalNovaRecorrencia } from './ModalNovaRecorrencia';

describe('ModalNovaRecorrencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveContrato.mockResolvedValue({ id: 'contrato-real' });
  });

  afterEach(cleanup);

  it('descreve contrato mensal, primeira cobrança opcional e competências futuras manuais', () => {
    render(<ModalNovaRecorrencia isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Novo contrato mensal' })).toBeTruthy();
    expect(screen.getByText(/próximas competências devem ser lançadas manualmente/i)).toBeTruthy();
    expect(screen.getByText('Primeira cobrança opcional')).toBeTruthy();
    expect(screen.getByText(/não agenda cobranças futuras/i)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Gerar a primeira cobrança agora/i }) as HTMLInputElement).checked).toBe(false);
  });

  it('salva somente o modelo quando a primeira cobrança opcional é desmarcada', async () => {
    const onClose = vi.fn();
    render(<ModalNovaRecorrencia isOpen onClose={onClose} />);

    const clientSearch = screen.getByPlaceholderText('Pesquisar parceiro por nome ou CNPJ...');
    fireEvent.focus(clientSearch);
    fireEvent.click(screen.getByRole('option', { name: /Cliente Real Ltda/i }));
    fireEvent.change(screen.getByPlaceholderText('R$ 0,00'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar contrato mensal/i }));

    await waitFor(() => expect(mocks.saveContrato).toHaveBeenCalledTimes(1));
    expect(mocks.saveContrato).toHaveBeenCalledWith(expect.objectContaining({
      clienteEmpresaId: 'cliente-real',
      valorMensal: 100,
      gerarCobranca: false,
      emissaoAutomaticaNfse: false,
    }));
    expect(mocks.createCobranca).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('quando solicitada, cria exatamente uma primeira cobrança vinculada ao contrato', async () => {
    render(<ModalNovaRecorrencia isOpen onClose={vi.fn()} />);

    const clientSearch = screen.getByPlaceholderText('Pesquisar parceiro por nome ou CNPJ...');
    fireEvent.focus(clientSearch);
    fireEvent.click(screen.getByRole('option', { name: /Cliente Real Ltda/i }));
    fireEvent.change(screen.getByPlaceholderText('R$ 0,00'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Gerar a primeira cobrança agora/i }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar contrato mensal/i }));

    await waitFor(() => expect(mocks.createCobranca).toHaveBeenCalledTimes(1));
    expect(mocks.createCobranca).toHaveBeenCalledWith(expect.objectContaining({
      contratoId: 'contrato-real',
      clienteEmpresaId: 'cliente-real',
      valor: 100,
    }));
  });
});
