/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCobranca: vi.fn(),
  emitNfse: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../financeiro/queries/useFinanceiroQueries', () => ({
  useCreateCobrancaFinanceiraMutation: () => ({
    mutateAsync: mocks.createCobranca,
    isPending: false,
  }),
  useEmitirNfseFinanceiraMutation: () => ({
    mutateAsync: mocks.emitNfse,
    isPending: false,
  }),
}));

import { ModalNovoLancamentoAvulso } from './ModalNovoLancamentoAvulso';
import { executeNovoLancamento } from './novoLancamentoAvulsoModel';

describe('ModalNovoLancamentoAvulso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('expõe honestamente que NFS-e direta está indisponível', () => {
    render(<ModalNovoLancamentoAvulso isOpen onClose={vi.fn()} />);

    const nfseOnlyButton = screen.getByRole('button', { name: /Somente NFS-e/i });
    expect((nfseOnlyButton as HTMLButtonElement).disabled).toBe(true);
    expect(nfseOnlyButton.textContent).toContain('Indisponível');
    expect(nfseOnlyButton.getAttribute('title')).toContain('sem uma cobrança vinculada');
  });

  it('bloqueia a mutação financeira mesmo se o tipo NFS-e for forçado fora da interface', async () => {
    await expect(executeNovoLancamento({
      tipo: 'nfse',
      createCobranca: mocks.createCobranca,
      emitNfse: mocks.emitNfse,
    })).rejects.toThrow(/não possui backend fiscal direto/i);

    expect(mocks.createCobranca).not.toHaveBeenCalled();
    expect(mocks.emitNfse).not.toHaveBeenCalled();
  });
});
