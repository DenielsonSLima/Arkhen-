import type { ProtocoloEntrega, ProtocoloUpdate } from '../services/protocolosService';
import { protocolosService } from '../services/protocolosService';

export const protocolosKeys = {
  all: ['protocolos'] as const,
  list: () => [...protocolosKeys.all, 'list'] as const,
};

export const protocolosQueries = {
  list: () => ({
    queryKey: protocolosKeys.list(),
    queryFn: () => protocolosService.getProtocolos(),
    staleTime: 30_000,
  }),
  update: ({ id, updates }: { id: string; updates: ProtocoloUpdate }) => (
    protocolosService.updateProtocolo(id, updates)
  ),
  saveEntregasEmpresa: ({ empresaId, entregaIds }: { empresaId: string; entregaIds: string[] }) => {
    protocolosService.saveEntregasEmpresa(empresaId, entregaIds);
    return protocolosService.getProtocolos();
  },
};

export type ProtocolosListData = ProtocoloEntrega[];
