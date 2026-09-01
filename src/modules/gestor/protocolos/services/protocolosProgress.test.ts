import { describe, expect, it } from 'vitest';
import { normalizeFluxosOperacionais } from './protocolosProgress';

const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';

describe('normalizeFluxosOperacionais', () => {
  it('aceita somente UUID e competência mensal válidos', () => {
    const progresso = normalizeFluxosOperacionais([{
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      tarefasTotal: 1,
      tarefasConcluidas: 0,
      etapasTotal: 12,
      etapasConcluidas: 9,
      percentual: 75,
    }, {
      clienteId: 'cliente-1',
      competencia: '2026-08',
      etapasTotal: 999,
    }, {
      clienteId: CLIENTE_ID,
      competencia: '2026-13',
      etapasTotal: 999,
    }]);

    expect([...progresso.values()]).toEqual([{
      clienteId: CLIENTE_ID,
      competencia: '2026-08',
      tarefasTotal: 1,
      tarefasConcluidas: 0,
      etapasTotal: 12,
      etapasConcluidas: 9,
      percentual: 75,
    }]);
  });

  it('limita contagens concluídas e percentual recebidos da RPC', () => {
    const progresso = normalizeFluxosOperacionais([{
      clienteId: CLIENTE_ID,
      competencia: '2026-09',
      tarefasTotal: 1,
      tarefasConcluidas: 3,
      etapasTotal: 2,
      etapasConcluidas: 8,
      percentual: 500,
    }]).get(`${CLIENTE_ID}::2026-09`);

    expect(progresso).toMatchObject({
      tarefasConcluidas: 1,
      etapasConcluidas: 2,
      percentual: 100,
    });
  });
});
