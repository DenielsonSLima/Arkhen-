import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({ supabase: supabaseMock }));

import {
  normalizeTarefasProgresso,
  tarefasProgressoService,
} from './tarefasProgressoService';

beforeEach(() => supabaseMock.rpc.mockReset());

describe('tarefasProgressoService', () => {
  it('carrega o progresso calculado no PostgreSQL pela RPC segura', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{
        tarefaId: '77777777-7777-4777-8777-777777777777',
        etapasTotal: 12,
        etapasConcluidas: 9,
        percentual: 75,
        prazoLegal: '2026-09-10',
        prazoInterno: '2026-09-08',
        diasEmAtraso: 0,
        diasParaVencimento: 4,
        nivelRisco: 'medio',
        pendenciaRegistrada: false,
        evidenciaRegistrada: true,
        revisaoPendente: false,
      }],
      error: null,
    });

    const result = await tarefasProgressoService.getAll();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('obter_progresso_tarefas_operacionais');
    expect(result.get('77777777-7777-4777-8777-777777777777')).toEqual({
      tarefaId: '77777777-7777-4777-8777-777777777777',
      etapasTotal: 12,
      etapasConcluidas: 9,
      percentual: 75,
      prazoLegal: '2026-09-10',
      prazoInterno: '2026-09-08',
      diasEmAtraso: 0,
      diasParaVencimento: 4,
      nivelRisco: 'medio',
      pendenciaRegistrada: false,
      evidenciaRegistrada: true,
      revisaoPendente: false,
    });
  });

  it('descarta linhas inválidas e limita números sem recalcular percentual', () => {
    const result = normalizeTarefasProgresso([{
      tarefaId: '77777777-7777-4777-8777-777777777777',
      etapasTotal: 2,
      etapasConcluidas: 9,
      percentual: 140,
      diasEmAtraso: -3,
      diasParaVencimento: -2,
      nivelRisco: 'forjado',
    }, {
      tarefaId: 'id-forjado',
      etapasTotal: 12,
      etapasConcluidas: 9,
      percentual: 75,
    }]);

    expect(result.size).toBe(1);
    expect(result.values().next().value).toMatchObject({
      etapasTotal: 2,
      etapasConcluidas: 2,
      percentual: 100,
      diasEmAtraso: 0,
      diasParaVencimento: -2,
      nivelRisco: undefined,
    });
  });
});
