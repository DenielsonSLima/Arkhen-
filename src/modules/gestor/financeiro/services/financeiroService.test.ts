import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: supabaseMock,
  supabaseProjectUrl: 'https://example.supabase.co',
}));

import { financeiroService, normalizeFinanceiroStats } from './financeiroService';

describe('normalizeFinanceiroStats', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('normalizes malformed RPC values before they reach the dashboard', () => {
    const result = normalizeFinanceiroStats({
      taxaInadimplencia: Number.NaN,
      saldoDisponivel: '1250.45' as unknown as number,
      contas: [{
        id: 'conta-1',
        banco: null as unknown as string,
        agencia: null as unknown as string,
        conta: null as unknown as string,
        saldo: 'inválido' as unknown as number,
      }],
      desempenho: [{
        name: null as unknown as string,
        receita: '100' as unknown as number,
        despesas: Number.POSITIVE_INFINITY,
        lucro: '50' as unknown as number,
      }],
    });

    expect(result.taxaInadimplencia).toBe(0);
    expect(result.saldoDisponivel).toBe(1250.45);
    expect(result.contas[0]).toEqual({
      id: 'conta-1',
      banco: 'Banco não informado',
      agencia: '-',
      conta: '-',
      saldo: 0,
    });
    expect(result.desempenho[0]).toEqual({ name: '-', receita: 100, despesas: 0, lucro: 50 });
    expect(result.receitasPorParceiro).toEqual([]);
  });

  it('uses one transactional RPC for a bank transfer', async () => {
    await financeiroService.transferirEntreContas({
      idempotencyKey: 'transfer-test-1',
      contaOrigemId: 'origem',
      contaDestinoId: 'destino',
      valor: 150.5,
      data: '2026-07-18',
      descricao: 'Reserva',
    });

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('transferir_entre_contas_financeiro', {
      p_payload: {
        conta_origem_id: 'origem',
        conta_destino_id: 'destino',
        valor: 150.5,
        data: '2026-07-18',
        descricao: 'Reserva',
        idempotency_key: 'transfer-test-1',
      },
    });
  });

  it('uses one transactional RPC for all installments', async () => {
    await financeiroService.criarContasPagarParceladas({
      idempotencyKey: 'installments-test-1',
      tipoDespesa: 'fixa',
      descricao: 'Licença anual',
      categoria: 'Software',
      valorTotal: 1200,
      dataCompetencia: '2026-07-01',
      dataVencimento: '2026-07-20',
      status: 'Pendente',
      numeroParcelas: 12,
    });

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('criar_contas_pagar_parceladas', {
      p_payload: {
        tipo_despesa: 'fixa',
        descricao: 'Licença anual',
        categoria: 'Software',
        valor_total: 1200,
        data_competencia: '2026-07-01',
        data_vencimento: '2026-07-20',
        status: 'Pendente',
        conta_bancaria_id: null,
        numero_parcelas: 12,
        idempotency_key: 'installments-test-1',
      },
    });
  });
});
