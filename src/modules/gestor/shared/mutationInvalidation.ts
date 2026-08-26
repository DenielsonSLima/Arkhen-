import type { QueryClient } from '@tanstack/react-query';

export type GestorMutationScope = 'atividades' | 'agenda' | 'documentos' | 'usuarios';

export const mutationInvalidationKeys = {
  atividades: [
    ['atividades'],
    ['inicio'],
    ['agenda'],
    ['conformidade'],
  ],
  agenda: [
    ['agenda'],
    ['inicio'],
  ],
  documentos: [
    ['documentos'],
    ['inicio'],
  ],
  usuarios: [
    ['configuracoes', 'usuarios'],
    ['inicio'],
  ],
} as const satisfies Record<GestorMutationScope, readonly (readonly unknown[])[]>;

type QueryInvalidationClient = Pick<QueryClient, 'invalidateQueries'>;

export const invalidateAfterMutation = (
  queryClient: QueryInvalidationClient,
  scope: GestorMutationScope,
) => Promise.all(
  mutationInvalidationKeys[scope].map((queryKey) => (
    queryClient.invalidateQueries({ queryKey })
  )),
);
