import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import officeBackground from '../../../../assets/office-scene-meeting.png';
import { getEventosPorIntervalo, type Evento } from '../../agenda/services/agenda.service';
import { rotinasAtividadesService, type TarefaGestor } from '../../atividades/services/rotinasAtividadesService';
import { getMensagemInspiradoraDoDia, type FraseMotivacional } from '../services/motivationalPhrases';

type ConfigNoticeType = 'address' | 'watermark' | null;
type ReadyKey = 'company' | 'message' | 'workspace' | 'agenda' | 'media';

const INITIAL_READINESS: Record<ReadyKey, boolean> = {
  company: false,
  message: false,
  workspace: false,
  agenda: false,
  media: false,
};

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
  const [tarefasWorkspace, setTarefasWorkspace] = useState<TarefaGestor[]>([]);
  const [eventosAgenda, setEventosAgenda] = useState<Evento[]>([]);
  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const [noticeType, setNoticeType] = useState<ConfigNoticeType>(null);
  const [fraseMotivacional, setFraseMotivacional] = useState(fraseFallback);
  const [readiness, setReadiness] = useState(INITIAL_READINESS);

  const markReady = useCallback((key: ReadyKey) => {
    setReadiness((current) => current[key] ? current : { ...current, [key]: true });
  }, []);

  useEffect(() => {
    let active = true;

    const checkCompanyDetails = async () => {
      try {
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
          if (active) {
            setNoticeType('address');
            setShowConfigNotice(true);
          }
          return;
        }

        const { data: watermarkData } = await supabase
          .from('configuracoes_marca_dagua')
          .select('file_url_paisagem, file_url_retrato')
          .maybeSingle();
        const watermarksIncomplete = !watermarkData?.file_url_paisagem || !watermarkData?.file_url_retrato;

        if (active) {
          setNoticeType(watermarksIncomplete ? 'watermark' : null);
          setShowConfigNotice(watermarksIncomplete);
        }
      } catch (error) {
        console.error('Erro ao verificar dados da empresa e marca dágua:', error);
      } finally {
        if (active) markReady('company');
      }
    };

    void checkCompanyDetails();
    return () => { active = false; };
  }, [markReady]);

  useEffect(() => {
    let active = true;
    const image = new Image();
    const settle = () => {
      if (active) markReady('media');
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
  }, [markReady]);

  useEffect(() => {
    let active = true;
    setFraseMotivacional(fraseFallback);
    void getMensagemInspiradoraDoDia(hoje)
      .then((frase) => {
        if (active && frase) setFraseMotivacional(frase);
      })
      .catch((error) => console.error('Erro ao carregar mensagem inspiradora:', error))
      .finally(() => {
        if (active) markReady('message');
      });
    return () => { active = false; };
  }, [fraseFallback, hoje, markReady]);

  useEffect(() => {
    let active = true;
    void rotinasAtividadesService.getWorkspace()
      .then((workspace) => {
        if (active) setTarefasWorkspace(workspace.tarefas);
      })
      .catch((error) => console.error('Erro ao carregar atividades do início:', error))
      .finally(() => {
        if (active) markReady('workspace');
      });
    return () => { active = false; };
  }, [markReady]);

  useEffect(() => {
    let active = true;
    const now = new Date();
    void getEventosPorIntervalo(now.getFullYear(), now.getMonth(), 2)
      .then((eventos) => {
        if (active) setEventosAgenda(eventos);
      })
      .catch((error) => console.error('Erro ao carregar agenda do início:', error))
      .finally(() => {
        if (active) markReady('agenda');
      });
    return () => { active = false; };
  }, [markReady]);

  const isReady = dashboardReady && Object.values(readiness).every(Boolean);

  useEffect(() => {
    if (isReady) onReady?.();
  }, [isReady, onReady]);

  useEffect(() => {
    if (!onReady || isReady) return undefined;
    const timer = window.setTimeout(onReady, 15_000);
    return () => window.clearTimeout(timer);
  }, [isReady, onReady]);

  return {
    tarefasWorkspace,
    eventosAgenda,
    showConfigNotice,
    noticeType,
    fraseMotivacional,
  };
};
