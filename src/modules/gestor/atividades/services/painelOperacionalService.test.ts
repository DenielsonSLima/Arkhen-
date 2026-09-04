import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({ supabase: supabaseMock }));

import {
  normalizePainelOperacional,
  painelOperacionalService,
} from './painelOperacionalService';

beforeEach(() => supabaseMock.rpc.mockReset());

describe('painelOperacionalService', () => {
  it('usa a RPC canônica com período, data e cliente', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        periodo: 'mes',
        dataReferencia: '2026-09-04',
        metricas: { total: 2, emRisco: 1, taxaNoPrazo: 80 },
        colaboradores: [],
        rankings: { clientes: [], rotinas: [] },
        riscos: [],
      },
      error: null,
    });

    const result = await painelOperacionalService.get(
      'mes',
      '2026-09-04',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(supabaseMock.rpc).toHaveBeenCalledWith('obter_painel_operacional', {
      p_periodo: 'mes',
      p_data_referencia: '2026-09-04',
      p_cliente_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.metricas).toMatchObject({
      total: 2,
      emRisco: 1,
      taxaNoPrazo: 80,
    });
  });

  it('descarta itens inválidos e limita percentuais vindos do banco', () => {
    const result = normalizePainelOperacional({
      metricas: { taxaNoPrazo: 145, atrasadas: -1 },
      colaboradores: [{
        responsavel: 'Fernanda',
        taxaNoPrazo: 105,
        percentualConcluido: 130,
      }],
      rankings: { clientes: [{ nome: '' }], rotinas: 'inválido' },
      riscos: [{
        tarefaId: 'task-1',
        titulo: 'Folha',
        nivelRisco: 'forjado',
      }],
    }, 'semana', '2026-09-04');

    expect(result.periodo).toBe('semana');
    expect(result.metricas.taxaNoPrazo).toBe(100);
    expect(result.metricas.atrasadas).toBe(0);
    expect(result.colaboradores[0]).toMatchObject({
      responsavel: 'Fernanda',
      taxaNoPrazo: 100,
      percentualConcluido: 100,
    });
    expect(result.rankings.clientes).toEqual([]);
    expect(result.riscos).toEqual([]);
  });
});
