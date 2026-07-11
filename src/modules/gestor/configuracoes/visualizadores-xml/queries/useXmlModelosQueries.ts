import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { xmlModelosService } from '../services/xmlModelosService';
import type { XmlModelo } from '../types';

export const useXmlModelosQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.xmlModelos(),
    queryFn: xmlModelosService.list,
  })
);

export const useSaveXmlModelosMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelos: XmlModelo[]) => xmlModelosService.save(modelos),
    onSuccess: (modelos) => {
      queryClient.setQueryData(configuracoesKeys.xmlModelos(), modelos);
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.xmlModelos() });
    },
  });
};
