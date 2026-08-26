import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPTY_CONFORMIDADE_METRICAS,
  type ConformidadeEtapa,
  type ConformidadeObrigacao,
  type ConformidadePrioridade,
  type ConformidadeTipo,
} from '../services/conformidadeOperationalService';
import { conformidadeKeys, conformidadeQueries } from '../queries/conformidadeQueries';

type TimeWindow = 'todos' | 'hoje' | 'semana' | 'atrasados' | 'sem-prazo';

interface UseConformidadeOptions {
  initialCompanyId?: string;
}

const EMPTY_OBRIGACOES: ConformidadeObrigacao[] = [];

const priorityWeight: Record<ConformidadePrioridade, number> = {
  'sem-prazo': 0,
  verde: 1,
  amarelo: 2,
  vermelho: 3,
};

export const useConformidade = ({ initialCompanyId }: UseConformidadeOptions = {}) => {
  const queryClient = useQueryClient();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | ConformidadeTipo>('todos');
  const [responsavelFiltro, setResponsavelFiltro] = useState<'todos' | string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const obrigacoesQuery = useQuery(conformidadeQueries.obrigacoes(initialCompanyId));
  const obrigacoes = obrigacoesQuery.data?.obrigacoes || EMPTY_OBRIGACOES;
  const solicitacoesDocumentaisVisiveis =
    obrigacoesQuery.data?.solicitacoesDocumentaisVisiveis ?? false;
  const metricas = obrigacoesQuery.data?.metricas ?? EMPTY_CONFORMIDADE_METRICAS;

  const toggleEtapaMutation = useMutation({
    mutationFn: ({
      obrigacaoId,
      etapaId,
      checked,
    }: {
      obrigacaoId: string;
      etapaId: ConformidadeEtapa['id'];
      checked: boolean;
    }) => conformidadeQueries.toggleEtapa(obrigacaoId, etapaId, checked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conformidadeKeys.all });
    },
  });

  const filteredByContext = useMemo(() => {
    return obrigacoes.filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch = !term
        || item.clienteNome.toLowerCase().includes(term)
        || item.rotina.toLowerCase().includes(term)
        || item.cnpj.includes(term)
        || item.responsavel.toLowerCase().includes(term);

      const matchTipo = tipoFiltro === 'todos' || item.tipo === tipoFiltro;
      const matchResponsavel = responsavelFiltro === 'todos' || item.responsavel === responsavelFiltro;

      const matchJanela = timeWindow === 'todos'
        ? true
        : timeWindow === 'sem-prazo'
          ? item.diasParaVencimento === null
          : timeWindow === 'hoje'
        ? item.diasParaVencimento === 0
        : timeWindow === 'semana'
          ? item.diasParaVencimento !== null
            && item.diasParaVencimento >= 0
            && item.diasParaVencimento <= 7
          : item.atrasoDias > 0;

      return matchSearch && matchTipo && matchResponsavel && matchJanela;
    });
  }, [obrigacoes, searchTerm, tipoFiltro, timeWindow, responsavelFiltro]);

  const obrSorted = useMemo(() => {
    return [...filteredByContext].sort((a, b) => {
      const prioritySort = priorityWeight[b.prioridade] - priorityWeight[a.prioridade];
      if (prioritySort !== 0) return prioritySort;
      return (a.diasParaVencimento ?? Number.MAX_SAFE_INTEGER)
        - (b.diasParaVencimento ?? Number.MAX_SAFE_INTEGER);
    });
  }, [filteredByContext]);

  const handleToggleStep = async (obrigacaoId: string, etapaId: string, checked: boolean) => {
    try {
      await toggleEtapaMutation.mutateAsync({
        obrigacaoId,
        etapaId: etapaId as ConformidadeEtapa['id'],
        checked,
      });
    } catch {
      // O erro permanece no estado da mutation e é apresentado pela página.
    }
  };

  const updateErrorMessage = toggleEtapaMutation.error
    ? typeof toggleEtapaMutation.error === 'object'
      && 'message' in toggleEtapaMutation.error
      && typeof toggleEtapaMutation.error.message === 'string'
      ? toggleEtapaMutation.error.message
      : 'Não foi possível atualizar esta etapa. Recarregue e tente novamente.'
    : '';

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    return obrigacoes
      .map((item) => item.tipo)
      .filter((tipo) => {
        if (seen.has(tipo)) return false;
        seen.add(tipo);
        return true;
      }) as ConformidadeTipo[];
  }, [obrigacoes]);

  const responsavelOptions = useMemo(() => {
    const seen = new Set<string>();
    return obrigacoes
      .map((item) => item.responsavel)
      .filter((responsavel) => {
        const nome = responsavel.trim();
        if (!nome || seen.has(nome)) return false;
        seen.add(nome);
        return true;
      });
  }, [obrigacoes]);

  return {
    timeWindow,
    tipoFiltro,
    searchTerm,
    isLoading: obrigacoesQuery.isLoading,
    errorMessage: obrigacoesQuery.error instanceof Error ? obrigacoesQuery.error.message : '',
    updateErrorMessage,
    isUpdating: toggleEtapaMutation.isPending,
    obrSorted,
    totalDisponivel: obrigacoes.length,
    dataReferencia: obrigacoesQuery.data?.dataReferencia || '',
    solicitacoesDocumentaisVisiveis,
    metricas,
    typeOptions,
    responsavelOptions,
    responsavelFiltro,
    setTimeWindow,
    setTipoFiltro,
    setSearchTerm,
    setResponsavelFiltro,
    handleToggleStep,
  };
};
