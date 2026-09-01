import { describe, expect, it } from 'vitest';
import {
  addMonthsKey,
  formatPersistedCompletionDateTime,
  getTarefaChecklistProgress,
  isTarefaAtrasada,
  isTarefaReadOnly,
} from './minhaFilaPresentation';

describe('addMonthsKey', () => {
  it('limita o dia ao último dia do mês de destino sem pular fevereiro', () => {
    expect(addMonthsKey('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsKey('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsKey('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('getTarefaChecklistProgress', () => {
  it('expõe somente o progresso calculado e persistido pelo banco', () => {
    expect(getTarefaChecklistProgress({
      etapasConcluidas: 9,
      etapasTotal: 12,
      percentual: 75,
    })).toEqual({ completed: 9, total: 12, percentage: 75 });
  });

  it('mantém zero enquanto o serviço ainda não anexou progresso', () => {
    expect(getTarefaChecklistProgress({})).toEqual({
      completed: 0,
      total: 0,
      percentage: 0,
    });
  });
});

describe('formatPersistedCompletionDateTime', () => {
  it('formata a data persistida com hora, minuto e segundo', () => {
    expect(formatPersistedCompletionDateTime('2026-09-01T12:53:05')).toBe(
      '01/09/2026 às 12:53:05',
    );
  });

  it('não inventa horário quando o valor persistido não existe ou é inválido', () => {
    expect(formatPersistedCompletionDateTime()).toBeNull();
    expect(formatPersistedCompletionDateTime('data-inválida')).toBeNull();
  });
});

describe('estado operacional da tarefa', () => {
  it('não classifica tarefa cancelada ou concluída como atrasada', () => {
    expect(isTarefaAtrasada({ status: 'Cancelada', vencimento: '2026-08-01' }, '2026-09-01'))
      .toBe(false);
    expect(isTarefaAtrasada({ status: 'Concluída', vencimento: '2026-08-01' }, '2026-09-01'))
      .toBe(false);
    expect(isTarefaAtrasada({ status: 'Aguardando revisão', vencimento: '2026-08-01' }, '2026-09-01'))
      .toBe(true);
  });

  it('espelha os estados bloqueados pelas RPCs de progresso', () => {
    expect(isTarefaReadOnly('Aguardando revisão')).toBe(true);
    expect(isTarefaReadOnly('Concluída')).toBe(true);
    expect(isTarefaReadOnly('Cancelada')).toBe(true);
    expect(isTarefaReadOnly('Em andamento')).toBe(false);
    expect(isTarefaReadOnly('Pendente')).toBe(false);
  });
});
