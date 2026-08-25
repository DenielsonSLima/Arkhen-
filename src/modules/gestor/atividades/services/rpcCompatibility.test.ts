import { describe, expect, it } from 'vitest';
import { activityWriteError, isMissingRpcFunctionError } from './rpcCompatibility';

describe('isMissingRpcFunctionError', () => {
  it('aceita fallback somente quando a RPC ainda não existe', () => {
    expect(isMissingRpcFunctionError({ code: 'PGRST202', message: 'schema cache' })).toBe(true);
    expect(isMissingRpcFunctionError({ code: '42883', message: 'undefined function' })).toBe(true);
    expect(isMissingRpcFunctionError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingRpcFunctionError({ code: '23514', message: 'check violation' })).toBe(false);
  });

  it('mantém uma mensagem operacional clara', () => {
    expect(activityWriteError('Não foi possível salvar', { message: 'permission denied' }).message)
      .toBe('Não foi possível salvar: permission denied');
  });
});
