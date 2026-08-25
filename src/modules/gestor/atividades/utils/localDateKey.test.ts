import { describe, expect, it } from 'vitest';
import { toLocalDateKey } from './localDateKey';

describe('toLocalDateKey', () => {
  it('mantém a data civil local perto da virada do dia', () => {
    const localDate = new Date(2026, 7, 25, 23, 45, 0);

    expect(toLocalDateKey(localDate)).toBe('2026-08-25');
  });

  it('preenche mês e dia com zero', () => {
    expect(toLocalDateKey(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });
});
