import { tarefasOperacionaisService } from '../services/tarefasOperacionaisService';
import { useQueryClient } from '@tanstack/react-query';
import { atividadesKeys } from './useAtividadesWorkspace';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { atividadesService } from '../services/atividadesService';
import type { ClienteEmpresa, ModeloAtividade, AtividadeInstancia, ValoresCompetenciaAtividade } from '../services/atividadesService';

export interface CompanyActivity {
  instanciaId: string;
  modeloId: string;
  modeloNome: string;
  status: AtividadeInstancia['status'];
  progresso: number;
  checklists: { [etapa: string]: boolean };
  checklistDates?: { [etapa: string]: string };
  checklistUsers?: { [etapa: string]: string };
  valores?: any;
}

export interface CompanyActivityGroup {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  regime: string;
  tipoEstabelecimento: string;
  competencia: string;
  responsavel: string;
  atividades: CompanyActivity[];
  progressoGeral: number;
  statusGeral: 'Pendente' | 'Em andamento' | 'Concluída';
  logo?: string;
}

const formatCompetencia = (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

const getPreviousMonthCompetencia = () => {
  const today = new Date();
  return formatCompetencia(new Date(today.getFullYear(), today.getMonth() - 1, 1));
};

const parseCompetenciaDate = (competencia: string) => {
  const [month, year] = competencia.split('/').map(Number);
  return new Date(year, month - 1, 1).getTime();
};

export interface UseAtividadesOptions {
  initialCompanyId?: string;
  initialCompetencia?: string;
}

const normalizeCompetencia = (value?: string) => {
  if (!value) return '';
  if (/^\d{2}\/\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-');
    return `${month}/${year}`;
  }
  return value;
};

export const useAtividades = (options: UseAtividadesOptions = {}) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [competencia] = useState(getPreviousMonthCompetencia);
  const [globalFilter, setGlobalFilter] = useState<'todas' | 'pendentes' | 'andamento' | 'concluidas'>('todas');
  
  const [clientes, setClientes] = useState<ClienteEmpresa[]>([]);
  const [modelos, setModelos] = useState<ModeloAtividade[]>([]);
  const [instancias, setInstancias] = useState<AtividadeInstancia[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState<CompanyActivityGroup | null>(null);
  const [fechamentoMeta, setFechamentoMeta] = useState<{ finalizado: boolean; dataHora: string; usuario: string }>({
    finalizado: false,
    dataHora: '',
    usuario: '',
  });

  useEffect(() => {
    if (!selectedGroup) return;
    let cancelled = false;
    const loadFechamentoMeta = async () => {
      const meta = await atividadesService.getFechamentoMeta(
        selectedGroup.clienteId,
        selectedGroup.competencia,
      );
      if (!cancelled) setFechamentoMeta(meta);
    };
    void loadFechamentoMeta().catch((error) => {
      setError(error instanceof Error ? error : new Error(String(error?.message || error)));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  const handleSaveFechamentoMeta = async (meta: { finalizado: boolean; dataHora: string; usuario: string; justificativa?: string }) => {
    if (!selectedGroup) return;
    try {
      const saved = await atividadesService.saveFechamentoMeta(selectedGroup.clienteId, selectedGroup.competencia, meta);
      setFechamentoMeta(saved);
      await queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String((cause as { message?: string })?.message || cause));
      setError(failure);
      throw failure;
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mod, cli, instances] = await Promise.all([
        atividadesService.getModelos(), atividadesService.getClientes(), atividadesService.getInstancias(),
      ]);
      setClientes(cli);
      setModelos(mod);
      setInstancias(instances);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String((err as { message?: string })?.message || err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allGroups = useMemo<CompanyActivityGroup[]>(() => (
    clientes.flatMap((cliente) => {
      const clientCompetencias = Array.from(new Set(
        instancias
          .filter((inst) => inst.clienteId === cliente.id)
          .map((inst) => inst.competencia)
      )).sort((a, b) => parseCompetenciaDate(a) - parseCompetenciaDate(b));

      return clientCompetencias.map((groupCompetencia) => {
        const clientInstances = instancias.filter((inst) => (
          inst.clienteId === cliente.id && inst.competencia === groupCompetencia
        ));
      
      let totalSteps = 0;
      let completedSteps = 0;

      const mappedAtividades: CompanyActivity[] = clientInstances.map((inst) => {
        const model = modelos.find((m) => m.id === inst.modeloId);
        const steps = Object.keys(inst.checklists);
        const doneSteps = steps.filter((s) => inst.checklists[s]).length;
        
        totalSteps += steps.length;
        completedSteps += doneSteps;

        const subProgress = steps.length > 0 ? Math.round((doneSteps / steps.length) * 100) : 0;

        return {
          instanciaId: inst.id,
          modeloId: inst.modeloId,
          modeloNome: inst.modeloNome || model?.nome || inst.modeloId,
          status: inst.status,
          progresso: subProgress,
          checklists: inst.checklists,
          checklistDates: inst.checklistDates,
          checklistUsers: inst.checklistUsers,
          valores: inst.valores,
        };
      });

      const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      let overallStatus: CompanyActivityGroup['statusGeral'] = 'Pendente';
      if (mappedAtividades.length > 0 && mappedAtividades.every((atividade) => atividade.status === 'Concluída')) {
        overallStatus = 'Concluída';
      } else if (overallProgress > 0) {
        overallStatus = 'Em andamento';
      }

      return {
        id: `${cliente.id}-${groupCompetencia.replace('/', '-')}`,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        cnpj: cliente.cnpj,
        regime: cliente.regime,
        tipoEstabelecimento: cliente.tipoEstabelecimento,
        competencia: groupCompetencia,
        responsavel: '',
        atividades: mappedAtividades,
        progressoGeral: overallProgress,
        statusGeral: overallStatus,
        logo: cliente.logo,
      };
    });
    }).sort((a, b) => (
      a.clienteNome.localeCompare(b.clienteNome) ||
      parseCompetenciaDate(a.competencia) - parseCompetenciaDate(b.competencia)
    ))
  ), [clientes, instancias, modelos]);

  // Filter groups
  const filteredGroups = allGroups.filter((group) => {
    if (globalFilter === 'pendentes') return group.progressoGeral === 0;
    if (globalFilter === 'andamento') return group.statusGeral === 'Em andamento';
    if (globalFilter === 'concluidas') return group.statusGeral === 'Concluída';
    return true;
  });

  useEffect(() => {
    if (!options.initialCompanyId || !options.initialCompetencia) return;
    const selectedCompetencia = normalizeCompetencia(options.initialCompetencia);
    if (!selectedCompetencia) return;

    const matched = allGroups.find((group) => (
      group.clienteId === options.initialCompanyId && group.competencia === selectedCompetencia
    ));
    if (matched) setSelectedGroup((current) => current?.id === matched.id ? current : matched);
  }, [allGroups, options.initialCompanyId, options.initialCompetencia]);

  // Keep selectedGroup updated on refetch
  useEffect(() => {
    setSelectedGroup((current) => {
      if (!current) return current;
      return allGroups.find((group) => group.id === current.id) || current;
    });
  }, [allGroups]);

  // Toggle checklist step
  const handleToggleStep = async (instanciaId: string, etapa: string, value: boolean) => {
    const target = instancias.find((i) => i.id === instanciaId);
    if (!target) return;

    if (target.fonte === 'tarefa') {
      try {
        await tarefasOperacionaisService.updateChecklist(instanciaId, target.checklistIndices?.[etapa] ?? -1, value);
        await queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
        await loadData();
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String((cause as { message?: string })?.message || cause)));
      }
      return;
    }
    setError(new Error('Esta atividade pertence ao histórico antigo. A migração para edição está pendente de definição; nenhum dado foi alterado.'));
  };

  // Save checklist step custom completion date/time
  const handleSaveStepDate = async (_instanciaId: string, _etapa: string, _dateStr: string) => {
    setError(new Error('A data de execução é registrada automaticamente pelo servidor e não pode ser alterada.'));
  };

  // Save values (specifically for DCTFWeb)
  const handleSaveTaxValores = async (
    instanciaId: string,
    valores: ValoresCompetenciaAtividade
  ) => {
    const target = instancias.find((i) => i.id === instanciaId);
    if (!target) return;

    if (target.fonte !== 'tarefa') {
      const failure = new Error('Esta atividade pertence ao histórico antigo. A migração para edição está pendente de definição; nenhum dado foi alterado.');
      setError(failure);
      throw failure;
    }

    try {
      await atividadesService.saveValoresTarefa(instanciaId, valores);
      await queryClient.invalidateQueries({ queryKey: atividadesKeys.all });
      await loadData();
    } catch (err) {
      const failure = err instanceof Error ? err : new Error(String((err as { message?: string })?.message || err));
      setError(failure);
      throw failure;
    }
  };

  // Compute metrics for the active competency
  const totalCount = allGroups.length;
  const completedCount = allGroups.filter((g) => g.statusGeral === 'Concluída').length;
  const andamentoCount = allGroups.filter((g) => g.statusGeral === 'Em andamento').length;
  const pendingCount = allGroups.filter((g) => g.statusGeral === 'Pendente').length;

  return {
    error,
    competencia,
    globalFilter,
    setGlobalFilter,
    companyGroups: filteredGroups,
    isLoading,
    selectedGroup,
    setSelectedGroup,
    fechamentoMeta,
    handleSaveFechamentoMeta,
    handleToggleStep,
    handleSaveStepDate,
    handleSaveTaxValores,
    metrics: {
      total: totalCount,
      completed: completedCount,
      inProgress: andamentoCount,
      pending: pendingCount,
    },
    refresh: loadData,
  };
};
