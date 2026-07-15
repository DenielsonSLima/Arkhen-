import { reformaTributariaService } from '../services/reformaTributariaService';

export const reformaTributariaKeys = {
  all: ['reforma-tributaria'] as const,
  painel: () => [...reformaTributariaKeys.all, 'painel'] as const,
  historico: (clienteId?: string | null) => [...reformaTributariaKeys.all, 'historico', clienteId || 'todos'] as const,
};

export const reformaTributariaQueries = {
  painel: () => ({
    queryKey: reformaTributariaKeys.painel(),
    queryFn: reformaTributariaService.getPainel,
    staleTime: 30_000,
  }),
  historico: (clienteId?: string | null) => ({
    queryKey: reformaTributariaKeys.historico(clienteId),
    queryFn: () => reformaTributariaService.getHistorico(clienteId),
    staleTime: 30_000,
  }),
};
