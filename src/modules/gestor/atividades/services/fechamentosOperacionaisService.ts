import { supabase } from '../../../../lib/supabase';

export type FechamentoStatus = 'Pendente' | 'Em andamento' | 'Concluída';

export interface FechamentoTarefa {
  id: string;
  titulo: string;
  categoria: string;
  frequencia: string;
  responsavel: string;
  vencimento: string | null;
  prioridade: string;
  status: FechamentoStatus;
  progresso: number;
}

export interface FechamentoOperacionalGrupo {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  regime: string;
  tipoEstabelecimento: string;
  competencia: string;
  responsavel: string;
  progressoGeral: number;
  statusGeral: FechamentoStatus;
  tarefas: FechamentoTarefa[];
  logo?: string;
}

export interface FechamentosOperacionais {
  grupos: FechamentoOperacionalGrupo[];
  metricas: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
}

const isFechamentosOperacionais = (value: unknown): value is FechamentosOperacionais => (
  Boolean(value)
  && typeof value === 'object'
  && Array.isArray((value as FechamentosOperacionais).grupos)
  && typeof (value as FechamentosOperacionais).metricas === 'object'
);

export const fechamentosOperacionaisService = {
  async listar(): Promise<FechamentosOperacionais> {
    const { data, error } = await supabase.rpc('get_fechamentos_operacionais');
    if (error) throw error;
    if (!isFechamentosOperacionais(data)) {
      throw new Error('O painel operacional retornou uma resposta inválida. Atualize as migrações do banco.');
    }
    return data;
  },
};
