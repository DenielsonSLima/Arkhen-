import { useCallback, useEffect, useMemo, useState } from 'react';
import { atividadesService } from '../services/atividadesService';
import type { ClienteEmpresa, ModeloAtividade, AtividadeInstancia, ValoresCompetenciaAtividade } from '../services/atividadesService';
import { getResponsavelDoGrupo } from '../utils/responsaveisPorGrupo';

export interface CompanyActivity {
  instanciaId: string;
  modeloId: string;
  modeloNome: string;
  status: 'Pendente' | 'Em andamento' | 'Concluída';
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
  canMaterialize?: boolean;
  responsaveisPorGrupo?: Record<string, string>;
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
  const [competencia] = useState(() => (
    normalizeCompetencia(options.initialCompetencia) || getPreviousMonthCompetencia()
  ));
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
      console.error('Erro ao carregar metadados do fechamento:', error);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  const handleSaveFechamentoMeta = async (meta: { finalizado: boolean; dataHora: string; usuario: string }) => {
    if (!selectedGroup) return;
    const savedMeta = await atividadesService.saveFechamentoMeta(
      selectedGroup.clienteId,
      selectedGroup.competencia,
      meta,
    );
    setFechamentoMeta(savedMeta);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mod, loadedClientes] = await Promise.all([
        atividadesService.getModelos(),
        atividadesService.getClientes(),
      ]);
      if (options.canMaterialize) {
        try {
          await atividadesService.ensureInstancias(competencia);
        } catch (materializeError) {
          console.warn('Não foi possível materializar novas atividades nesta carga:', materializeError);
        }
      }
      const competenciaInstancias = await atividadesService.getInstancias(competencia);
      
      setClientes(loadedClientes);
      setModelos(mod);
      setInstancias(competenciaInstancias);
    } catch (err) {
      console.error('Erro ao carregar dados de atividades:', err);
    } finally {
      setIsLoading(false);
    }
  }, [competencia, options.canMaterialize]);

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
          modeloNome: model?.nome || inst.modeloId,
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
      if (overallProgress === 100) {
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
        responsavel: getResponsavelDoGrupo(
          options.responsaveisPorGrupo,
          cliente.id,
          groupCompetencia,
        ),
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
  ), [clientes, instancias, modelos, options.responsaveisPorGrupo]);

  // Filter groups
  const filteredGroups = allGroups.filter((group) => {
    if (globalFilter === 'pendentes') return group.progressoGeral === 0;
    if (globalFilter === 'andamento') return group.progressoGeral > 0 && group.progressoGeral < 100;
    if (globalFilter === 'concluidas') return group.progressoGeral === 100;
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

    const optimistic = {
      ...target,
      checklists: { ...target.checklists, [etapa]: value },
    };
    setInstancias((current) => current.map((item) => (
      item.id === instanciaId ? optimistic : item
    )));

    try {
      const updatedInstancia = await atividadesService.atualizarChecklist(
        instanciaId,
        etapa,
        value,
      );
      setInstancias((current) => current.map((item) => (
        item.id === instanciaId ? updatedInstancia : item
      )));
    } catch (err) {
      console.error(err);
      setInstancias((current) => current.map((item) => (
        item.id === instanciaId ? target : item
      )));
      throw err;
    }
  };

  // Save values (specifically for DCTFWeb)
  const handleSaveTaxValores = async (
    instanciaId: string,
    valores: ValoresCompetenciaAtividade
  ) => {
    const target = instancias.find((i) => i.id === instanciaId);
    if (!target) return;

    const updatedInstancia: AtividadeInstancia = {
      ...target,
      valores: {
        ...target.valores,
        ...valores,
      },
    };

    setInstancias((current) => current.map((item) => (
      item.id === instanciaId ? updatedInstancia : item
    )));

    try {
      const savedInstancia = await atividadesService.atualizarValores(instanciaId, valores);
      setInstancias((current) => current.map((item) => (
        item.id === instanciaId ? savedInstancia : item
      )));
    } catch (err) {
      console.error(err);
      setInstancias((current) => current.map((item) => (
        item.id === instanciaId ? target : item
      )));
      throw err;
    }
  };

  // Compute metrics for the active competency
  const totalCount = allGroups.length;
  const completedCount = allGroups.filter((g) => g.statusGeral === 'Concluída').length;
  const andamentoCount = allGroups.filter((g) => g.statusGeral === 'Em andamento').length;
  const pendingCount = allGroups.filter((g) => g.statusGeral === 'Pendente').length;

  return {
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
