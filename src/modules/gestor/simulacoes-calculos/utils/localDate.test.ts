import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toLocalDateInputValue } from './localDate';

describe('toLocalDateInputValue', () => {
  const previousTimezone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Maceio';
  });

  afterAll(() => {
    process.env.TZ = previousTimezone;
  });

  it('mantém o dia civil local quando o UTC já avançou', () => {
    const date = new Date('2026-08-26T01:30:00.000Z');
    expect(toLocalDateInputValue(date)).toBe('2026-08-25');
  });
});
