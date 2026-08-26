import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  invalidateAfterMutation,
  mutationInvalidationKeys,
  type GestorMutationScope,
} from './mutationInvalidation';

const expectedKeys = {
  atividades: [['atividades'], ['inicio'], ['agenda'], ['conformidade']],
  agenda: [['agenda'], ['inicio']],
  documentos: [['documentos'], ['inicio']],
  usuarios: [['configuracoes', 'usuarios'], ['inicio']],
} as const;

describe('invalidateAfterMutation', () => {
  it('mantém o mapa de dependências alinhado às chaves dos módulos', () => {
    expect(mutationInvalidationKeys).toEqual(expectedKeys);
  });

  it.each(Object.keys(expectedKeys) as GestorMutationScope[])(
    'invalida todos os grupos relacionados a %s',
    async (scope) => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);
      const queryClient = { invalidateQueries } as unknown as Pick<QueryClient, 'invalidateQueries'>;

      await invalidateAfterMutation(queryClient, scope);

      expect(invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)).toEqual(expectedKeys[scope]);
    },
  );
});
