import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMensagemInspiradoraDoDia, type FraseMotivacional } from '../services/motivationalPhrases';
import { inicioKeys } from '../queries/inicioKeys';

type UseInicioBootstrapOptions = {
  hoje: string;
  fraseFallback: FraseMotivacional;
  dashboardReady: boolean;
  onReady?: () => void;
};

export const useInicioBootstrap = ({
  hoje,
  fraseFallback,
  dashboardReady,
  onReady,
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

  useEffect(() => {
    if (dashboardReady) onReady?.();
  }, [dashboardReady, onReady]);

  return {
    fraseMotivacional: messageQuery.data ?? fraseFallback,
  };
};
