import { useState, useEffect } from 'react';
import { atividadesService } from '../services/atividadesService';
import type { ClienteEmpresa, ModeloAtividade, AtividadeInstancia } from '../services/atividadesService';

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

const addCompetenciaMonth = (competencia: string) => {
  const [month, year] = competencia.split('/').map(Number);
  return formatCompetencia(new Date(year, month, 1));
};

const parseCompetenciaDate = (competencia: string) => {
  const [month, year] = competencia.split('/').map(Number);
  return new Date(year, month - 1, 1).getTime();
};

const getInstanceProgress = (instancia: AtividadeInstancia) => {
  const steps = Object.keys(instancia.checklists);
  if (steps.length === 0) return 0;
  const completed = steps.filter((step) => instancia.checklists[step]).length;
  return Math.round((completed / steps.length) * 100);
};

const isModeloAplicavelAoCliente = (modelo: ModeloAtividade, cliente: ClienteEmpresa) => {
  if (!modelo.tipos || modelo.tipos.length === 0) return true;
  if (modelo.tipos.includes(cliente.regime)) return true;
  return (cliente.regime === 'Isenta' && modelo.tipos.includes('Isento')) ||
    (cliente.regime === 'Isento' && modelo.tipos.includes('Isenta'));
};

const getDefaultModelosForCliente = (
  cliente: ClienteEmpresa,
  modelos: ModeloAtividade[]
) => {
  const aplicaveis = modelos
    .filter((modelo) => isModeloAplicavelAoCliente(modelo, cliente))
    .map((modelo) => modelo.id);

  return aplicaveis.length > 0 ? aplicaveis : modelos.map((modelo) => modelo.id);
};

const clienteHasValidModelo = (cliente: ClienteEmpresa, modelos: ModeloAtividade[]) => (
  cliente.modelosAtivos.some((modeloAtivo) => (
    modelos.some((modelo) => modelo.id === modeloAtivo || modelo.codigo === modeloAtivo)
  ))
);

const isClientCompetenciaComplete = (
  cliente: ClienteEmpresa,
  modelos: ModeloAtividade[],
  instancias: AtividadeInstancia[]
) => {
  const activeModelos = cliente.modelosAtivos.filter((modeloId) => (
    modelos.some((modelo) => modelo.id === modeloId || modelo.codigo === modeloId)
  ));
  if (activeModelos.length === 0) return false;
  return activeModelos.every((modeloId) => {
    const modelo = modelos.find((item) => item.id === modeloId || item.codigo === modeloId);
    const instancia = instancias.find((item) => (
      item.clienteId === cliente.id &&
      (item.modeloId === modeloId || item.modeloId === modelo?.id || item.modeloId === modelo?.codigo)
    ));
    return !!instancia && getInstanceProgress(instancia) === 100;
  });
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

  const loadFechamentoMeta = async () => {
    if (selectedGroup) {
      const meta = await atividadesService.getFechamentoMeta(selectedGroup.clienteId, selectedGroup.competencia);
      setFechamentoMeta(meta);
    }
  };

  useEffect(() => {
    loadFechamentoMeta();
  }, [selectedGroup]);

  const handleSaveFechamentoMeta = async (meta: { finalizado: boolean; dataHora: string; usuario: string }) => {
    if (!selectedGroup) return;
    await atividadesService.saveFechamentoMeta(selectedGroup.clienteId, selectedGroup.competencia, meta);
    setFechamentoMeta(meta);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const mod = await atividadesService.getModelos();
      const loadedClientes = await atividadesService.getClientes();
      const cli = await Promise.all(loadedClientes.map(async (cliente) => {
        if (clienteHasValidModelo(cliente, mod)) return cliente;

        const modelosAtivos = getDefaultModelosForCliente(cliente, mod);
        if (modelosAtivos.length === 0) return cliente;

        const updatedCliente = { ...cliente, modelosAtivos };
        try {
          return await atividadesService.saveCliente(updatedCliente);
        } catch (err) {
          console.error('Erro ao vincular modelos padrao ao cliente:', err);
          return updatedCliente;
        }
      }));
      const visibleById = new Map<string, AtividadeInstancia>();
      const instanciasByCompetencia = new Map<string, AtividadeInstancia[]>();
      const baseCompetencia = getPreviousMonthCompetencia();
      const getInstanciasForCompetencia = async (targetCompetencia: string) => {
        const cached = instanciasByCompetencia.get(targetCompetencia);
        if (cached) return cached;

        await atividadesService.ensureInstancias(targetCompetencia);
        const competenciaInstancias = await atividadesService.getInstancias(targetCompetencia);
        instanciasByCompetencia.set(targetCompetencia, competenciaInstancias);
        return competenciaInstancias;
      };

      for (const cliente of cli) {
        let activeCompetencia = baseCompetencia;
        let safety = 0;

        while (safety < 12) {
          const competenciaInstancias = await getInstanciasForCompetencia(activeCompetencia);
          const clientInstancias = competenciaInstancias.filter((instancia) => instancia.clienteId === cliente.id);
          clientInstancias.forEach((instancia) => visibleById.set(instancia.id, instancia));

          if (!isClientCompetenciaComplete(cliente, mod, clientInstancias)) {
            break;
          }

        activeCompetencia = addCompetenciaMonth(activeCompetencia);
        safety += 1;
      }
      }
      
      setClientes(cli);
      setModelos(mod);
      setInstancias(Array.from(visibleById.values()));
    } catch (err) {
      console.error('Erro ao carregar dados de atividades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to map instances to Company Groups
  const getCompanyGroups = (): CompanyActivityGroup[] => {
    return clientes.flatMap((cliente) => {
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
        competencia: groupCompetencia,
        responsavel: '',
        atividades: mappedAtividades,
        progressoGeral: overallProgress,
        statusGeral: overallStatus,
        logo: '',
      };
    });
    }).sort((a, b) => (
      a.clienteNome.localeCompare(b.clienteNome) ||
      parseCompetenciaDate(a.competencia) - parseCompetenciaDate(b.competencia)
    ));
  };

  const allGroups = getCompanyGroups();

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
    if (matched) {
      setSelectedGroup(matched);
    }
  }, [allGroups, options.initialCompanyId, options.initialCompetencia]);

  // Keep selectedGroup updated on refetch
  useEffect(() => {
    if (selectedGroup) {
      const updated = allGroups.find((g) => g.id === selectedGroup.id);
      if (updated) {
        setSelectedGroup(updated);
      }
    }
  }, [instancias]);

  // Toggle checklist step
  const handleToggleStep = async (instanciaId: string, etapa: string, value: boolean) => {
    const target = instancias.find((i) => i.id === instanciaId);
    if (!target) return;

    const usuarioLogado = 'Sistema';

    const newChecklists = { ...target.checklists, [etapa]: value };
    const steps = Object.keys(newChecklists);
    const completed = steps.filter((s) => newChecklists[s]).length;
    const progress = steps.length > 0 ? (completed / steps.length) * 100 : 0;

    let newStatus: AtividadeInstancia['status'] = 'Pendente';
    if (progress === 100) {
      newStatus = 'Concluída';
    } else if (progress > 0) {
      newStatus = 'Em andamento';
    }

    // Update checklist dates
    const newChecklistDates = { ...(target.checklistDates || {}) };
    const newChecklistUsers = { ...(target.checklistUsers || {}) };
    if (value) {
      if (!newChecklistDates[etapa]) {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localNow = new Date(now.getTime() - offset * 60 * 1000);
        newChecklistDates[etapa] = localNow.toISOString().slice(0, 16);
      }
      // Registra o usuário que marcou (somente se ainda não houver um)
      if (!newChecklistUsers[etapa]) {
        newChecklistUsers[etapa] = usuarioLogado;
      }
    } else {
      delete newChecklistDates[etapa];
      delete newChecklistUsers[etapa];
    }

    const updatedInstancia: AtividadeInstancia = {
      ...target,
      checklists: newChecklists,
      checklistDates: newChecklistDates,
      checklistUsers: newChecklistUsers,
      status: newStatus,
    };

    // Update locally immediately
    const updatedInstancias = instancias.map((i) => (i.id === instanciaId ? updatedInstancia : i));
    setInstancias(updatedInstancias);

    try {
      await atividadesService.saveInstancia(updatedInstancia);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Save checklist step custom completion date/time
  const handleSaveStepDate = async (instanciaId: string, etapa: string, dateStr: string) => {
    const target = instancias.find((i) => i.id === instanciaId);
    if (!target) return;

    const newChecklistDates = {
      ...(target.checklistDates || {}),
      [etapa]: dateStr,
    };

    const updatedInstancia: AtividadeInstancia = {
      ...target,
      checklistDates: newChecklistDates,
    };

    setInstancias(instancias.map((i) => (i.id === instanciaId ? updatedInstancia : i)));

    try {
      await atividadesService.saveInstancia(updatedInstancia);
    } catch (err) {
      console.error(err);
    }
  };

  // Save values (specifically for DCTFWeb)
  const handleSaveTaxValores = async (
    instanciaId: string,
    valores: { valorInss: number; valorIrrf: number; valorReinf: number }
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

    setInstancias(instancias.map((i) => (i.id === instanciaId ? updatedInstancia : i)));

    try {
      await atividadesService.saveInstancia(updatedInstancia);
    } catch (err) {
      console.error(err);
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
