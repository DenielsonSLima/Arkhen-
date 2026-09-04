import { useQuery } from '@tanstack/react-query';
import {
  painelOperacionalService,
  type PainelPeriodo,
} from '../services/painelOperacionalService';
import { atividadesKeys } from '../hooks/useAtividadesWorkspace';

export const painelOperacionalKeys = {
  all: () => [...atividadesKeys.all, 'painel-operacional'] as const,
  detail: (periodo: PainelPeriodo, dataReferencia: string, clienteId?: string) => [
    ...painelOperacionalKeys.all(),
    periodo,
    dataReferencia,
    clienteId || 'todos-clientes',
  ] as const,
};

export const usePainelOperacional = (
  periodo: PainelPeriodo,
  dataReferencia: string,
  clienteId?: string,
  enabled = true,
) => useQuery({
  queryKey: painelOperacionalKeys.detail(periodo, dataReferencia, clienteId),
  queryFn: () => painelOperacionalService.get(periodo, dataReferencia, clienteId),
  enabled,
  staleTime: 30_000,
});
