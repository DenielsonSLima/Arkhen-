import { describe, expect, it } from 'vitest';
import { nextMonthlyDueDate } from './dateUtils';
describe('vencimento civil da primeira cobrança', () => {
  it('mantém o dia atual mesmo depois da meia-noite', () => {
    expect(nextMonthlyDueDate(10, new Date(2026, 8, 10, 11, 30))).toBe('2026-09-10');
  });
  it('avança somente dia já passado, inclusive na virada do ano', () => {
    expect(nextMonthlyDueDate(9, new Date(2026, 8, 10, 11))).toBe('2026-10-09');
    expect(nextMonthlyDueDate(10, new Date(2026, 11, 11))).toBe('2027-01-10');
    expect(nextMonthlyDueDate(11, new Date(2026, 8, 10))).toBe('2026-09-11');
  });
});
