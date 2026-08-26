import { describe, expect, it } from 'vitest';
import { getAccessClock, validateAccessWindow } from './accessWindowPolicy';

const config = {
  enabled: true,
  days: [1],
  intervals: [{ start: '08:00', end: '18:00' }],
  message: 'Fora da janela.',
};

describe('accessWindowPolicy', () => {
  it('avalia dia e horário em America/Sao_Paulo, independentemente do navegador', () => {
    const instant = new Date('2026-08-31T11:30:00.000Z');

    expect(getAccessClock(instant)).toEqual({ day: 1, minutes: 8 * 60 + 30 });
    expect(validateAccessWindow(config, instant)).toEqual({ allowed: true, message: '' });
  });

  it('usa a mesma virada de dia da política RLS', () => {
    const sundayNightInSaoPaulo = new Date('2026-08-31T02:30:00.000Z');

    expect(getAccessClock(sundayNightInSaoPaulo).day).toBe(0);
    expect(validateAccessWindow(config, sundayNightInSaoPaulo)).toEqual({
      allowed: false,
      message: 'Fora da janela.',
    });
  });
});
