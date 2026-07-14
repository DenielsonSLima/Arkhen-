import { useQuery } from '@tanstack/react-query';
import { tabelasTributariasService } from '../services/tabelasTributariasService';

export function useTabelasTributarias(tipo?: string, competencia?: string) {
  return useQuery({
    queryKey: ['parametros-tributarios', tipo || 'todos', competencia || 'atual'],
    queryFn: () => tabelasTributariasService.listar(tipo, competencia),
    staleTime: 5 * 60 * 1000,
  });
}
