/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const deleteQuery = {
    eq: vi.fn(),
  };
  deleteQuery.eq.mockReturnValue(deleteQuery);

  const upsert = vi.fn();
  const deleteRows = vi.fn(() => deleteQuery);

  return {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(() => ({
      upsert,
      delete: deleteRows,
    })),
    upsert,
    deleteRows,
    removeChannel: vi.fn(),
    channel: vi.fn(),
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    rpc: mocks.rpc,
    from: mocks.from,
    removeChannel: mocks.removeChannel,
    channel: mocks.channel,
  },
}));

vi.mock('./realtimeChannel', () => ({
  subscribeRealtimeChannel: vi.fn(),
}));

import { persistedStorage } from './persistedStorage';

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const flushAsyncWork = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

describe('persistedStorage context generation', () => {
  beforeEach(() => {
    persistedStorage.resetLocalContext();
    window.localStorage.clear();
    vi.clearAllMocks();

    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-old-context' } } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: 'empresa-old-context', error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it('does not reach RPC or a table write when reset happens while the session is pending', async () => {
    const sessionRequest = createDeferred<{
      data: { session: { user: { id: string } } };
      error: null;
    }>();
    mocks.getSession.mockReturnValueOnce(sessionRequest.promise);

    persistedStorage.setItem('pending-session-write', 'old-context-value');
    persistedStorage.resetLocalContext();
    sessionRequest.resolve({
      data: { session: { user: { id: 'user-old-context' } } },
      error: null,
    });
    await flushAsyncWork();

    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });

  it('does not upsert when reset happens while the tenant RPC is pending', async () => {
    const tenantRequest = createDeferred<{ data: string; error: null }>();
    mocks.rpc.mockReturnValueOnce(tenantRequest.promise);

    persistedStorage.setItem('pending-tenant-write', 'old-context-value');
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));

    persistedStorage.resetLocalContext();
    tenantRequest.resolve({ data: 'empresa-old-context', error: null });
    await flushAsyncWork();

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });

  it('does not delete when reset happens while the tenant RPC is pending', async () => {
    const tenantRequest = createDeferred<{ data: string; error: null }>();
    mocks.rpc.mockReturnValueOnce(tenantRequest.promise);

    persistedStorage.removeItem('pending-tenant-delete');
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));

    persistedStorage.resetLocalContext();
    tenantRequest.resolve({ data: 'empresa-old-context', error: null });
    await flushAsyncWork();

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });
});
