import { useState, useEffect } from 'react';
import { inicioService } from '../services/inicioService';
import type { DashboardStats, AtividadeRecente, ObrigacaoAgendada, VencimentoAlerta } from '../services/inicioService';

export const useInicio = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [agenda, setAgenda] = useState<ObrigacaoAgendada[]>([]);
  const [vencimentosProximos, setVencimentosProximos] = useState<VencimentoAlerta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await inicioService.getDashboardData();
        setStats(data.stats);
        setAtividades(data.atividades);
        setAgenda(data.agenda);
        setVencimentosProximos(inicioService.getVencimentosProximos());
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return {
    stats,
    atividades,
    agenda,
    vencimentosProximos,
    isLoading,
  };
};

