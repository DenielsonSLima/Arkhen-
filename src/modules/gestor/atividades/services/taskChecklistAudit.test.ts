import { describe, expect, it } from 'vitest';
import { buildTaskAuditSummaries, type TarefaChecklistEventRow } from './taskChecklistAudit';

const event = (patch: Partial<TarefaChecklistEventRow> = {}): TarefaChecklistEventRow => ({
  tarefa_id: 'task-1',
  tipo: 'checklist',
  ator_nome: 'Denielson',
  motivo: null,
  dados: { indice: 0, concluida: true },
  criado_em: '2026-08-29T18:30:00.000Z',
  ...patch,
});

describe('histórico auditável do checklist', () => {
  it('mantém somente a última alteração de cada etapa', () => {
    const summaries = buildTaskAuditSummaries([
      event({ dados: { indice: 0, concluida: false }, criado_em: '2026-08-29T19:00:00.000Z' }),
      event({ dados: { indice: 0, concluida: true } }),
    ]);

    expect(summaries.get('task-1')?.checklistByIndex.get(0)).toBeNull();
  });

  it('projeta data, usuário e relato da conclusão', () => {
    const summaries = buildTaskAuditSummaries([
      event({
        tipo: 'concluida',
        ator_nome: 'Maria Souza',
        motivo: 'DCTFWeb transmitida e recibo anexado.',
        dados: { evidenciaInformada: true },
        criado_em: '2026-08-29T19:10:00.000Z',
      }),
      event(),
    ]);

    const summary = summaries.get('task-1');
    expect(summary?.checklistByIndex.get(0)).toEqual({
      concluidoEm: '2026-08-29T18:30:00.000Z',
      concluidoPor: 'Denielson',
    });
    expect(summary?.concluidoPor).toBe('Maria Souza');
    expect(summary?.relatoConclusao).toMatch(/recibo/i);
  });
});
