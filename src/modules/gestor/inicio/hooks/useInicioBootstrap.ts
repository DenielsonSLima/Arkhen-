import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import officeBackground from '../../../../assets/office-scene-meeting.png';
import { getEventosPorIntervalo } from '../../agenda/services/agenda.service';
import { rotinasAtividadesService } from '../../atividades/services/rotinasAtividadesService';
import { getMensagemInspiradoraDoDia, type FraseMotivacional } from '../services/motivationalPhrases';
import { inicioKeys } from '../queries/inicioKeys';
import { atividadesKeys } from '../../atividades/hooks/useAtividadesWorkspace';
import { agendaKeys } from '../../agenda/hooks/useAgenda';

type ConfigNoticeType = 'address' | 'watermark' | null;

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
  const [mediaReady, setMediaReady] = useState(false);

  const now = useMemo(() => new Date(), []);
  const ano = now.getFullYear();
  const mes = now.getMonth();

  const companyConfigQuery = useQuery({
    queryKey: inicioKeys.companyNotice(),
    queryFn: async () => {
      const { data: companyData } = await supabase
        .from('configuracoes_empresa')
        .select('endereco, cep')
        .maybeSingle();

      const lowerEndereco = (companyData?.endereco || '').toLowerCase();
      const addressIncomplete = !companyData?.endereco
        || lowerEndereco.includes('ficticia')
        || lowerEndereco.includes('fictícia')
        || !companyData?.cep
        || companyData.cep === '49000-000';

      if (addressIncomplete) {
        return { showConfigNotice: true, noticeType: 'address' as ConfigNoticeType };
      }

      const { data: watermarkData } = await supabase
        .from('configuracoes_marca_dagua')
        .select('file_url_paisagem, file_url_retrato')
        .maybeSingle();

      const watermarksIncomplete = !watermarkData?.file_url_paisagem || !watermarkData?.file_url_retrato;
      return {
        showConfigNotice: watermarksIncomplete,
        noticeType: watermarksIncomplete ? ('watermark' as ConfigNoticeType) : null,
      };
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

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
    let active = true;
    const image = new Image();
    const settle = () => {
      if (active) setMediaReady(true);
    };
    image.addEventListener('load', settle);
    image.addEventListener('error', settle);
    image.src = officeBackground;
    if (image.complete) settle();

    return () => {
      active = false;
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
    };
  }, []);

  const isReady = dashboardReady
    && companyConfigQuery.isSuccess
    && messageQuery.isSuccess
    && workspaceQuery.isSuccess
    && agendaQuery.isSuccess
    && mediaReady;

  useEffect(() => {
    if (isReady) onReady?.();
  }, [isReady, onReady]);

  useEffect(() => {
    if (!onReady || isReady) return undefined;
    const timer = window.setTimeout(onReady, 15_000);
    return () => window.clearTimeout(timer);
  }, [isReady, onReady]);

  return {
    tarefasWorkspace: workspaceQuery.data?.tarefas ?? [],
    eventosAgenda: agendaQuery.data ?? [],
    showConfigNotice: companyConfigQuery.data?.showConfigNotice ?? false,
    noticeType: companyConfigQuery.data?.noticeType ?? null,
    fraseMotivacional: messageQuery.data ?? fraseFallback,
  };
};
