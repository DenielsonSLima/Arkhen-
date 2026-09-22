import { supabase } from '../../../../lib/supabase';

export interface DashboardStats {
  empresasAtivas: number;
  total: number;
  done: number;
  pct: number;
  pendentes: number;
  atrasadas: number;
  agendaHoje: number;
  agendaSemana: number;
  usuarios: Array<{
    id: string;
    usuario: string;
    total: number;
    done: number;
    atrasadas: number;
    pct: number;
    periodos: Record<'diaria' | 'semanal' | 'mensal', { total: number; done: number; pct: number }>;
  }>;
}

export interface VencimentoAlerta {
  id: string;
  empresaNome: string;
  tipo: 'documento' | 'certificado';
  nome: string;
  dataValidade: string;
  diasRestantes: number;
}

export const inicioService = {
  async getDashboardData(): Promise<{ stats: DashboardStats }> {
    const { data, error } = await supabase.rpc('obter_inicio_operacional');
    if (error) throw error;
    if (!data || typeof data !== 'object' || !Array.isArray(data.usuarios)) {
      throw new Error('Não foi possível obter os indicadores do painel.');
    }
    return { stats: data as DashboardStats };
  },

  async getVencimentosProximos(): Promise<VencimentoAlerta[]> {
    const { data, error } = await supabase.rpc('obter_alertas_validade_inicio');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Não foi possível obter as validades dos documentos.');
    return data as VencimentoAlerta[];
  },
};
