import { supabase } from '../../../../lib/supabase';

export interface InicioSetupStatus {
  empresaCompleta: boolean;
  logoConfigurado: boolean;
  marcasDaguaConfiguradas: boolean;
  identidadeCompleta: boolean;
  clientesAtivos: number;
  clientesComModelos: number;
  modelosAtivos: number;
  modelosVinculados: boolean;
  rotinasAtivas: number;
  tarefasAtivas: number;
  operacaoPlanejada: boolean;
  usuariosAtivos: number;
  essenciaisConcluidos: number;
  essenciaisTotal: number;
  configuracaoEssencialCompleta: boolean;
  configuracaoRecomendadaCompleta: boolean;
}

const BOOLEAN_FIELDS: Array<keyof InicioSetupStatus> = [
  'empresaCompleta',
  'logoConfigurado',
  'marcasDaguaConfiguradas',
  'identidadeCompleta',
  'modelosVinculados',
  'operacaoPlanejada',
  'configuracaoEssencialCompleta',
  'configuracaoRecomendadaCompleta',
];

const COUNT_FIELDS: Array<keyof InicioSetupStatus> = [
  'clientesAtivos',
  'clientesComModelos',
  'modelosAtivos',
  'rotinasAtivas',
  'tarefasAtivas',
  'usuariosAtivos',
  'essenciaisConcluidos',
  'essenciaisTotal',
];

const isInicioSetupStatus = (value: unknown): value is InicioSetupStatus => {
  if (!value || typeof value !== 'object') return false;
  const status = value as Record<string, unknown>;
  return BOOLEAN_FIELDS.every((field) => typeof status[field] === 'boolean')
    && COUNT_FIELDS.every((field) => Number.isInteger(status[field]) && Number(status[field]) >= 0);
};

export const inicioSetupService = {
  async getStatus(): Promise<InicioSetupStatus> {
    const { data, error } = await supabase.rpc('obter_status_configuracao_inicio');
    if (error) {
      throw new Error(`Erro ao verificar a configuração inicial: ${error.message}`);
    }
    if (!isInicioSetupStatus(data)) {
      throw new Error('A configuração inicial retornou um formato inválido. Atualize as migrações do banco.');
    }
    return data;
  },
};
