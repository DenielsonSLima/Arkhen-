import type { QueryClient } from '@tanstack/react-query';

export type GestorMutationScope = 'atividades' | 'agenda' | 'documentos' | 'usuarios' | 'protocolos';

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
  protocolos: [
    ['protocolos'],
    ['atividades'],
    ['inicio'],
    ['agenda'],
    ['conformidade'],
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
