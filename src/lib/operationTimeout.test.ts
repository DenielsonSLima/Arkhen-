import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OperationTimeoutError,
  isOperationTimeoutError,
  withOperationTimeout,
} from './operationTimeout';

describe('withOperationTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolve normalmente e limpa o temporizador', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    await expect(withOperationTimeout(Promise.resolve('ok'), 15_000, 'tempo esgotado', onTimeout))
      .resolves.toBe('ok');
    await vi.runAllTimersAsync();

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('rejeita uma operação pendente com erro identificável', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const pending = withOperationTimeout(
      new Promise<never>(() => undefined),
      15_000,
      'tempo esgotado',
      onTimeout,
    );
    const rejection = expect(pending).rejects.toBeInstanceOf(OperationTimeoutError);

    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
    expect(onTimeout).toHaveBeenCalledOnce();
    await expect(pending).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT' });
  });

  it('reconhece o erro de timeout sem depender apenas de instanceof', () => {
    expect(isOperationTimeoutError({ code: 'OPERATION_TIMEOUT' })).toBe(true);
    expect(isOperationTimeoutError(new Error('falha comum'))).toBe(false);
  });
});
