import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fechamentosOperacionaisService,
  type FechamentoOperacionalGrupo,
} from '../services/fechamentosOperacionaisService';

export type FechamentosFiltro = 'todas' | 'pendentes' | 'andamento' | 'concluidas';

export const fechamentosOperacionaisKey = ['atividades', 'fechamentos-operacionais'] as const;
const EMPTY_GRUPOS: FechamentoOperacionalGrupo[] = [];

export const useFechamentosOperacionais = (enabled: boolean, initialCompanyId?: string) => {
  const [globalFilter, setGlobalFilter] = useState<FechamentosFiltro>('todas');
  const [selectedGroup, setSelectedGroup] = useState<FechamentoOperacionalGrupo | null>(null);
  const query = useQuery({
    queryKey: fechamentosOperacionaisKey,
    queryFn: fechamentosOperacionaisService.listar,
    enabled,
    staleTime: 30_000,
  });
  const grupos = query.data?.grupos ?? EMPTY_GRUPOS;
  const companyGroups = useMemo(() => grupos.filter((group) => {
    if (initialCompanyId && group.clienteId !== initialCompanyId) return false;
    if (globalFilter === 'pendentes') return group.statusGeral === 'Pendente';
    if (globalFilter === 'andamento') return group.statusGeral === 'Em andamento';
    if (globalFilter === 'concluidas') return group.statusGeral === 'Concluída';
    return true;
  }), [globalFilter, grupos, initialCompanyId]);

  return {
    ...query,
    globalFilter,
    setGlobalFilter,
    companyGroups,
    selectedGroup,
    setSelectedGroup,
    metrics: query.data?.metricas || { total: 0, completed: 0, inProgress: 0, pending: 0 },
  };
};
