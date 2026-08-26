import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEventosPorIntervalo } from '../../agenda/services/agenda.service';
import { rotinasAtividadesService } from '../../atividades/services/rotinasAtividadesService';
import { getMensagemInspiradoraDoDia, type FraseMotivacional } from '../services/motivationalPhrases';
import { inicioKeys } from '../queries/inicioKeys';
import { atividadesKeys } from '../../atividades/hooks/useAtividadesWorkspace';
import { agendaKeys } from '../../agenda/hooks/useAgenda';

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
  const now = useMemo(() => new Date(), []);
  const ano = now.getFullYear();
  const mes = now.getMonth();

  const messageQuery = useQuery({
    queryKey: inicioKeys.mensagemInspiradora(hoje),
    queryFn: async () => {
      const frase = await getMensagemInspiradoraDoDia(hoje);
      return frase || fraseFallback;
    },
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

  const workspaceQuery = useQuery({
    queryKey: atividadesKeys.workspace(),
    queryFn: () => rotinasAtividadesService.getWorkspace(),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
  });

  const agendaQuery = useQuery({
    queryKey: agendaKeys.eventos(ano, mes, 2),
    queryFn: () => getEventosPorIntervalo(ano, mes, 2),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    if (dashboardReady) onReady?.();
  }, [dashboardReady, onReady]);

  return {
    tarefasWorkspace: workspaceQuery.data?.tarefas ?? [],
    eventosAgenda: agendaQuery.data ?? [],
    fraseMotivacional: messageQuery.data ?? fraseFallback,
  };
};
