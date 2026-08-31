import { describe, expect, it } from 'vitest';
import { isNonRetryableQueryError, shouldRetryQuery } from './queryErrorPolicy';

describe('queryErrorPolicy', () => {
  it.each([
    { status: 401 },
    { statusCode: 403 },
    { status: 400 },
    { statusCode: 404 },
    { code: '22023' },
    { code: '42501' },
    { code: '42883' },
    { code: 'PGRST003' },
    { code: 'PGRST202' },
    { cause: { code: '42501' } },
  ])('não repete erro terminal %#', (error) => {
    expect(isNonRetryableQueryError(error)).toBe(true);
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it('repete uma falha transitória somente uma vez', () => {
    expect(shouldRetryQuery(0, new Error('Falha temporária'))).toBe(true);
    expect(shouldRetryQuery(1, new Error('Falha temporária'))).toBe(false);
  });
});
