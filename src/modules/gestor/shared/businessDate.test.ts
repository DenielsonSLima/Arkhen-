import { describe, expect, it } from 'vitest';
import {
  businessDateTimeIso,
  toBusinessDateKey,
  toBusinessTimeKey,
  toCalendarDateKey,
} from './businessDate';

describe('businessDate', () => {
  it('mantem o dia operacional de Sao Paulo quando UTC ja virou o dia', () => {
    const instant = new Date('2026-08-26T01:30:00.000Z');

    expect(toBusinessDateKey(instant)).toBe('2026-08-25');
    expect(toBusinessTimeKey(instant)).toBe('22:30');
  });

  it('formata datas de calendario sem conversao UTC', () => {
    expect(toCalendarDateKey(new Date(2026, 7, 25, 23, 30))).toBe('2026-08-25');
  });

  it('salva o horario informado com o offset operacional', () => {
    expect(businessDateTimeIso('2026-08-25', '09:15')).toBe('2026-08-25T09:15:00-03:00');
  });
});
