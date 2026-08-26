import { describe, expect, it } from 'vitest';
import { dateRange, toEvento } from './agenda.mappers';

describe('agenda mappers timezone', () => {
  it('consulta meses a partir da meia-noite operacional', () => {
    expect(dateRange(2026, 7, 1)).toEqual({
      inicio: '2026-08-01T00:00:00-03:00',
      fim: '2026-09-01T00:00:00-03:00',
      inicioDia: '2026-08-01',
      fimDia: '2026-09-01',
    });
  });

  it('converte o timestamp persistido para data e hora do escritorio', () => {
    const evento = toEvento({
      id: 'evento-1',
      titulo: 'Fechamento',
      descricao: null,
      tipo: 'tarefa',
      categoria: 'operacional',
      origem: 'manual',
      status: 'agendado',
      data_inicio: '2026-08-26T01:30:00.000Z',
      responsavel_id: null,
      cliente_id: null,
      metadados: null,
    });

    expect(evento.data).toBe('2026-08-25');
    expect(evento.hora).toBe('22:30');
  });
});
