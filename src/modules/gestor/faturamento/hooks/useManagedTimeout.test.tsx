/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useManagedTimeout } from './useManagedTimeout';

describe('useManagedTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancela callbacks pendentes ao ocultar ou desmontar a subaba', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const hook = renderHook(() => useManagedTimeout());

    act(() => hook.result.current(callback, 2_000));
    hook.unmount();
    act(() => vi.runAllTimers());

    expect(callback).not.toHaveBeenCalled();
  });
});
