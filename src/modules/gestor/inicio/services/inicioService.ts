import { supabase } from '../../../../lib/supabase';
import type {
  InicioDashboardData,
  VencimentoAlerta,
} from './inicioDashboardSummary';

export type { DashboardStats, VencimentoAlerta } from './inicioDashboardSummary';

const isDashboardData = (value: unknown): value is InicioDashboardData => (
  value !== null
  && typeof value === 'object'
  && 'stats' in value
  && 'summary' in value
);

export const inicioService = {
  async getDashboardData(): Promise<InicioDashboardData> {
    const { data, error } = await supabase.rpc('obter_resumo_inicio');

    if (error) {
      throw new Error(`Erro ao carregar o resumo operacional: ${error.message}`);
    }
    if (!isDashboardData(data)) {
      throw new Error('O resumo operacional retornou um formato inválido.');
    }

    return data;
  },

  async getVencimentosProximos(): Promise<VencimentoAlerta[]> {
    const dashboard = await this.getDashboardData();
    return dashboard.summary.alertas.itens;
  },
};
