import { describe, expect, it } from 'vitest';
import { getEffectiveTaxRegime } from './taxRegime';

describe('getEffectiveTaxRegime', () => {
  it('treats legacy MEI records as Simples Nacional', () => {
    expect(getEffectiveTaxRegime('MEI')).toBe('Simples Nacional');
  });

  it('preserves current tax regimes', () => {
    expect(getEffectiveTaxRegime('Lucro Real')).toBe('Lucro Real');
  });
});
