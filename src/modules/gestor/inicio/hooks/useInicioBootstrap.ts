import { useQuery } from '@tanstack/react-query';
import { getMensagemInspiradoraDoDia, type FraseMotivacional } from '../services/motivationalPhrases';
import { inicioKeys } from '../queries/inicioKeys';

type UseInicioBootstrapOptions = {
  hoje: string;
  fraseFallback: FraseMotivacional;
};

export const useInicioBootstrap = ({
  hoje,
  fraseFallback,
}: UseInicioBootstrapOptions) => {
  const messageQuery = useQuery({
    queryKey: inicioKeys.mensagemInspiradora(hoje),
    queryFn: async () => {
      const frase = await getMensagemInspiradoraDoDia(hoje);
      return frase || fraseFallback;
    },
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

  return {
    fraseMotivacional: messageQuery.data ?? fraseFallback,
  };
};
