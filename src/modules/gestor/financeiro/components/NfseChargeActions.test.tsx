/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CobrancaFinanceira } from '../services/financeiroService';

const mocks = vi.hoisted(() => ({ emit: vi.fn(), consult: vi.fn(), pending: false, draft: vi.fn(), lookup: vi.fn() }));
vi.mock('../queries/useFinanceiroQueries', () => ({
  useEmitirNfseFinanceiraMutation: () => ({ mutateAsync: mocks.emit, isPending: mocks.pending }),
  useConsultarNfseFinanceiraMutation: () => ({ mutateAsync: mocks.consult, isPending: mocks.pending }),
}));
vi.mock('../../faturamento/queries/useFaturamentoFiscalQueries', () => ({
  useFiscalChargeDraftLookup: () => ({ mutateAsync: mocks.lookup, isPending: false }),
}));
vi.mock('../../faturamento/forms/nfse/NfseDraftForm', () => ({
  NfseDraftForm: (props: { onClose: () => void }) => {
    mocks.draft(props);
    return <div role="dialog" aria-label="Preparar NFS-e"><button onClick={props.onClose}>Fechar rascunho</button></div>;
  },
}));
import { NfseChargeActions } from './NfseChargeActions';

const charge = { id: 'charge-1', clienteEmpresaId: 'client-1', valor: 405,
  descricao: 'Serviços de agosto', status: 'Pendente' } as CobrancaFinanceira;
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.consult.mockReset(); mocks.pending = false; mocks.lookup.mockResolvedValue(null); });

describe('Ações WebISS em Contas a Receber', () => {
  it('descarta lookup atrasado após trocar de empresa e voltar à mesma cobrança', async () => {
    let resolve!: (value: unknown) => void;
    mocks.lookup.mockImplementation(() => new Promise(done => { resolve = done; }));
    const original = { ...charge, empresaId: 'tenant-a' };
    const { rerender } = render(<NfseChargeActions charge={original} />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
    rerender(<NfseChargeActions charge={{ ...original, empresaId: 'tenant-b' }} />);
    rerender(<NfseChargeActions charge={original} />);
    await act(async () => { resolve(null); });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.draft).not.toHaveBeenCalled();
  });
  it('limpa rascunho e erro ao mudar tomador no mesmo componente', async () => {
    const { rerender } = render(<NfseChargeActions charge={charge} />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
    await screen.findByRole('dialog');
    rerender(<NfseChargeActions charge={{ ...charge, clienteEmpresaId: 'client-b' }} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    mocks.lookup.mockRejectedValue(new Error('Falha contextual'));
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
    await screen.findByRole('alert');
    rerender(<NfseChargeActions charge={charge} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('retoma o rascunho salvo a cada abertura sem criar outra identidade', async () => {
    const existing = { id: 'draft-1', cobrancaId: charge.id, ambiente: 'producao', dados: { competencia: '2026-08-01' } };
    mocks.lookup.mockResolvedValue(existing);
    render(<NfseChargeActions charge={charge} />);
    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
      await screen.findByRole('dialog');
      expect(mocks.draft).toHaveBeenLastCalledWith(expect.objectContaining({ initial: existing, cobrancaId: charge.id }));
      fireEvent.click(screen.getByRole('button', { name: 'Fechar rascunho' }));
    }
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.consult).not.toHaveBeenCalled();
  });
  it('não abre rascunho novo se não conseguir conferir o vínculo existente', async () => {
    mocks.lookup.mockRejectedValue(new Error('Falha ao consultar o rascunho.'));
    render(<NfseChargeActions charge={charge} />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao consultar');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.draft).not.toHaveBeenCalled();
  });
  it('abre o formulário fiscal com a cobrança sem emissão, consulta ou competência presumida', async () => {
    render(<NfseChargeActions charge={charge} />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e da cobrança/ }));
    expect(await screen.findByRole('dialog', { name: 'Preparar NFS-e' })).toBeTruthy();
    expect(mocks.draft).toHaveBeenLastCalledWith(expect.objectContaining({
      cobrancaId: 'charge-1', clienteId: 'client-1', valor: 405, descricao: 'Serviços de agosto',
    }));
    expect(mocks.draft.mock.calls.at(-1)?.[0].initial).toBeUndefined();
    expect(mocks.lookup).toHaveBeenCalledWith({ cobrancaId: 'charge-1' });
    expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.consult).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar rascunho' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('não oferece preparação para cobrança cancelada ou já vinculada à NFS-e', () => {
    const { rerender } = render(<NfseChargeActions charge={{ ...charge, status: 'Cancelado' }} />);
    expect(screen.queryByRole('button', { name: /Preparar NFS-e/ })).toBeNull();
    rerender(<NfseChargeActions charge={{ ...charge, nfseId: '123', nfseRpsNumero: '10' }} />);
    expect(screen.queryByRole('button', { name: /Preparar NFS-e/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Consultar ou reconciliar/ })).toBeTruthy();
  });

  it.each(['falha_pre_envio', 'incerta', 'rejeitada', 'processando', 'pendente'])(
    'reconcilia o RPS legado em %s sem abrir outro rascunho ou emitir', async nfseStatus => {
      mocks.consult.mockRejectedValue(new Error('RPS ainda não localizado no WebISS.'));
      render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10', nfseStatus }} />);
      expect(screen.queryByRole('button', { name: /Preparar NFS-e/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Consultar ou reconciliar/ }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('RPS ainda não localizado'));
      expect(mocks.consult).toHaveBeenCalledWith('charge-1');
      expect(mocks.draft).not.toHaveBeenCalled(); expect(mocks.emit).not.toHaveBeenCalled();
    },
  );

  it.each(['processando', 'pendente', 'incerta', 'rejeitada', 'falha_pre_envio', 'emitida', 'cancelada', 'substituida'])('não prepara nova nota enquanto a cobrança está %s mesmo sem número local', nfseStatus => {
    render(<NfseChargeActions charge={{ ...charge, nfseStatus }} />);
    expect(screen.queryByRole('button', { name: /Preparar NFS-e/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Consultar ou reconciliar/ })).toBeTruthy();
  });

  it.each(['cancelada', 'substituida'] as const)('apresenta a situação %s recebida na consulta', async situacao => {
    mocks.consult.mockResolvedValue({ nfseId: '123', ambiente: 'producao', situacao });
    render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Consultar ou reconciliar/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(situacao === 'substituida' ? /substituída/i : /cancelada/i));
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('informa resultado de consulta em homologação sem valor fiscal', async () => {
    mocks.consult.mockResolvedValue({ nfseId: '123', ambiente: 'homologacao', situacao: 'confirmada' });
    render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Consultar ou reconciliar/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('sem valor fiscal'));
  });

  it('fecha a preparação se a cobrança passar a ter RPS reservado', async () => {
    const { rerender } = render(<NfseChargeActions charge={charge} />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar NFS-e/ }));
    await screen.findByRole('dialog');
    rerender(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('desabilita as ações durante a operação', () => {
    mocks.pending = true;
    render(<NfseChargeActions charge={{ ...charge, nfseRpsNumero: '10' }} />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
