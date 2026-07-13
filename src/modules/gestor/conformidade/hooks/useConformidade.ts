import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsuarioLogado } from '../../atividades/utils/periodoAtividades';
import {
  type ConformidadeEtapa,
  type ConformidadePrioridade,
  type ConformidadeTipo,
} from '../services/conformidadeService';
import { conformidadeKeys, conformidadeQueries } from '../queries/conformidadeQueries';

type TimeWindow = 'hoje' | 'semana' | 'atrasados';

interface UseConformidadeOptions {
  initialCompanyId?: string;
}

export interface ConformidadeMetricItem {
  label: string;
  quantidade: number;
}

export interface ConformidadeMetricas {
  total: number;
  pendente: number;
  andamento: number;
  concluidas: number;
  atrasadas: number;
  vencendoHoje: number;
  taxaPrazo: number;
  atrasadasPorResponsavel: ConformidadeMetricItem[];
  atrasadasPorCliente: ConformidadeMetricItem[];
  atrasadasPorRotina: ConformidadeMetricItem[];
}

const getDateOnly = (value: string) => value.split('T')[0];
const getDaysTo = (dueDate: string, reference = new Date()) => {
  const due = new Date(`${dueDate}T00:00:00`);
  const base = new Date(getDateOnly(reference.toISOString()));
  return Math.floor((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const priorityWeight: Record<ConformidadePrioridade, number> = {
  verde: 1,
  amarelo: 2,
  vermelho: 3,
};

const buildTopList = (items: [string, number][]) => (
  items
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label, quantidade]) => ({ label, quantidade }))
);

export const useConformidade = ({ initialCompanyId }: UseConformidadeOptions = {}) => {
  const queryClient = useQueryClient();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('semana');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | ConformidadeTipo>('todos');
  const [responsavelFiltro, setResponsavelFiltro] = useState<'todos' | string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const obrigacoesQuery = useQuery(conformidadeQueries.obrigacoes(initialCompanyId));
  const referenceStepsQuery = useQuery(conformidadeQueries.referenceSteps());
  const obrigacoes = obrigacoesQuery.data || [];
  const referenceSteps = referenceStepsQuery.data || [];

  const toggleEtapaMutation = useMutation({
    mutationFn: ({
      obrigacaoId,
      etapaId,
      checked,
      responsavel,
    }: {
      obrigacaoId: string;
      etapaId: ConformidadeEtapa['id'];
      checked: boolean;
      responsavel: string;
    }) => conformidadeQueries.toggleEtapa(obrigacaoId, etapaId, checked, responsavel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conformidadeKeys.all });
    },
  });

  const filteredByContext = useMemo(() => {
    const now = new Date();
    const hoje = getDateOnly(now.toISOString());
    const semanaEnd = getDateOnly(addDays(now, 7).toISOString());

    return obrigacoes.filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch = !term
        || item.clienteNome.toLowerCase().includes(term)
        || item.rotina.toLowerCase().includes(term)
        || item.cnpj.includes(term)
        || item.responsavel.toLowerCase().includes(term);

      const matchTipo = tipoFiltro === 'todos' || item.tipo === tipoFiltro;
      const matchResponsavel = responsavelFiltro === 'todos' || item.responsavel === responsavelFiltro;

      const diasParaVencimento = getDaysTo(item.vencimento);
      const matchJanela = timeWindow === 'hoje'
        ? item.vencimento === hoje
        : timeWindow === 'semana'
          ? item.vencimento >= hoje && item.vencimento <= semanaEnd
          : diasParaVencimento < 0;

      return matchSearch && matchTipo && matchResponsavel && matchJanela;
    });
  }, [obrigacoes, searchTerm, tipoFiltro, timeWindow, responsavelFiltro]);

  const obrSorted = useMemo(() => {
    return [...filteredByContext].sort((a, b) => {
      const prioritySort = priorityWeight[b.prioridade] - priorityWeight[a.prioridade];
      if (prioritySort !== 0) return prioritySort;
      return getDaysTo(a.vencimento) - getDaysTo(b.vencimento);
    });
  }, [filteredByContext]);

  const metricas = useMemo<ConformidadeMetricas>(() => {
    const baseItems = obrSorted;
    const total = baseItems.length;
    const pendente = baseItems.filter((item) => item.status === 'Pendente').length;
    const andamento = baseItems.filter((item) => item.status === 'Em andamento').length;
    const concluidas = baseItems.filter((item) => item.status === 'Concluído').length;
    const atrasadas = baseItems.filter((item) => item.atrasoDias > 0).length;
    const vencendoHoje = baseItems.filter((item) => getDaysTo(item.vencimento) === 0).length;
    const concluidasEmDia = baseItems.filter((item) => item.status === 'Concluído' && item.atrasoDias === 0).length;
    const taxaPrazo = concluidas > 0 ? Math.round((concluidasEmDia / concluidas) * 100) : 0;

    const responsaveis = new Map<string, number>();
    const clientes = new Map<string, number>();
    const rotinas = new Map<string, number>();

    baseItems
      .filter((item) => item.atrasoDias > 0)
      .forEach((item) => {
        responsaveis.set(item.responsavel, (responsaveis.get(item.responsavel) || 0) + 1);
        clientes.set(item.clienteNome, (clientes.get(item.clienteNome) || 0) + 1);
        rotinas.set(item.rotina, (rotinas.get(item.rotina) || 0) + 1);
      });

    return {
      total,
      pendente,
      andamento,
      concluidas,
      atrasadas,
      vencendoHoje,
      taxaPrazo,
      atrasadasPorResponsavel: buildTopList(Array.from(responsaveis.entries())),
      atrasadasPorCliente: buildTopList(Array.from(clientes.entries())),
      atrasadasPorRotina: buildTopList(Array.from(rotinas.entries())),
    };
  }, [obrSorted]);

  const handleToggleStep = async (obrigacaoId: string, etapaId: string, checked: boolean) => {
    const responsavel = getUsuarioLogado('João Silva');
    await toggleEtapaMutation.mutateAsync({
      obrigacaoId,
      etapaId: etapaId as ConformidadeEtapa['id'],
      checked,
      responsavel,
    });
  };

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
    isLoading: obrigacoesQuery.isLoading || referenceStepsQuery.isLoading,
    obrSorted,
    metricas,
    referenceSteps,
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
