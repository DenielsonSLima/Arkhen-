import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn(),
    },
  },
}));

import { supabase } from '../../../../lib/supabase';
import { inicioService } from './inicioService';
import { EMPTY_INICIO_DASHBOARD_SUMMARY } from './inicioDashboardSummary';

describe('inicioService.getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca o resumo pronto somente pela RPC tenant-safe', async () => {
    const dashboard = {
      stats: { clientesAtivos: 3 },
      summary: {
        ...EMPTY_INICIO_DASHBOARD_SUMMARY,
        alertas: {
          ...EMPTY_INICIO_DASHBOARD_SUMMARY.alertas,
          itens: [{
            id: 'doc-1',
            empresaNome: 'Cliente A',
            tipo: 'documento' as const,
            nome: 'Contrato',
            dataValidade: '30/08/2026',
            diasRestantes: 4,
          }],
        },
      },
    };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: dashboard, error: null } as never);

    await expect(inicioService.getDashboardData()).resolves.toEqual(dashboard);
    expect(supabase.rpc).toHaveBeenCalledWith('obter_resumo_inicio');
    expect(supabase.from).not.toHaveBeenCalled();
    await expect(inicioService.getVencimentosProximos()).resolves.toEqual(
      dashboard.summary.alertas.itens,
    );
  });

  it('não mascara falhas da RPC como um resumo vazio', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'acesso negado' },
    } as never);

    await expect(inicioService.getDashboardData()).rejects.toThrow('acesso negado');
  });
});
